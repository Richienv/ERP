import { NextRequest, NextResponse } from 'next/server'
import { PaymentTerm, QuotationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const toText = (value: unknown) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

const isEnumValue = <T extends string>(value: unknown, enumValues: readonly T[]): value is T => {
    return typeof value === 'string' && enumValues.includes(value as T)
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const quotation = await prisma.quotation.findUnique({
            where: { id },
            select: {
                id: true,
                number: true,
                customerId: true,
                customerRef: true,
                quotationDate: true,
                validUntil: true,
                paymentTerm: true,
                deliveryTerm: true,
                subtotal: true,
                taxAmount: true,
                discountAmount: true,
                total: true,
                status: true,
                version: true,
                parentQuotationId: true,
                notes: true,
                internalNotes: true,
                createdAt: true,
                updatedAt: true,
                items: {
                    select: {
                        id: true,
                        quotationId: true,
                        productId: true,
                        description: true,
                        quantity: true,
                        unitPrice: true,
                        discount: true,
                        taxRate: true,
                        lineTotal: true,
                        createdAt: true,
                        updatedAt: true,
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                description: true,
                                unit: true,
                                costPrice: true,
                                sellingPrice: true,
                                productType: true,
                                color: true,
                                size: true,
                                composition: true,
                                isActive: true,
                            },
                        },
                    },
                },
            },
        })

        if (!quotation) {
            return NextResponse.json({ success: false, error: 'Quotation not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: quotation
        })
    } catch (error) {
        console.error('Error fetching quotation:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch quotation' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const customerId = toText(body.customerId)
        const items = Array.isArray(body.items) ? body.items : []

        if (!customerId) {
            return NextResponse.json({ success: false, error: 'Customer wajib dipilih' }, { status: 400 })
        }

        if (items.length === 0) {
            return NextResponse.json({ success: false, error: 'Minimal satu item quotation wajib diisi' }, { status: 400 })
        }

        // Calculate totals
        const normalizedItems = await Promise.all(items.map(async (item: any) => {
            const quantity = Math.max(0.001, toNumber(item.quantity, 1))
            const unitPrice = toNumber(item.unitPrice, 0)
            const discount = Math.max(0, Math.min(100, toNumber(item.discount, 0)))
            const taxRate = Math.max(0, Math.min(100, toNumber(item.taxRate, 11)))

            const lineSubtotal = quantity * unitPrice
            const discountAmount = lineSubtotal * (discount / 100)
            const afterDiscount = lineSubtotal - discountAmount
            const taxAmount = afterDiscount * (taxRate / 100)
            const lineTotal = afterDiscount + taxAmount

            return {
                productId: item.productId,
                description: toText(item.description),
                quantity,
                unitPrice,
                discount,
                taxRate,
                lineTotal,
                lineSubtotal,
                discountAmount,
                taxAmount
            }
        }))

        const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0)
        const discountAmount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0)
        const taxAmount = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0)
        const total = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)

        const paymentTerm = isEnumValue(body.paymentTerm, Object.values(PaymentTerm))
            ? body.paymentTerm
            : undefined

        const quotationDate = body.quotationDate ? new Date(body.quotationDate) : undefined
        const validUntil = body.validUntil ? new Date(body.validUntil) : undefined

        // Update quotation using a transaction to handle items deletion and creation
        const updatedQuotation = await prisma.$transaction(async (tx) => {
            // Delete existing items
            await tx.quotationItem.deleteMany({
                where: { quotationId: id }
            })

            // Update quotation and create new items
            return tx.quotation.update({
                where: { id },
                data: {
                    customerId,
                    customerRef: toText(body.customerRef),
                    quotationDate,
                    validUntil,
                    paymentTerm,
                    deliveryTerm: toText(body.deliveryTerm),
                    notes: toText(body.notes),
                    internalNotes: toText(body.internalNotes),
                    subtotal,
                    taxAmount,
                    discountAmount,
                    total,
                    items: {
                        create: normalizedItems.map(item => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount,
                            taxRate: item.taxRate,
                            lineTotal: item.lineTotal,
                        }))
                    }
                }
            })
        })

        return NextResponse.json({
            success: true,
            data: updatedQuotation,
            message: 'Quotation berhasil diperbarui'
        })

    } catch (error: any) {
        console.error('Error updating quotation:', error)
        return NextResponse.json({ success: false, error: 'Failed to update quotation' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.quotation.delete({
            where: { id }
        })
        return NextResponse.json({ success: true, message: 'Quotation deleted successfully' })
    } catch (error) {
        console.error('Error deleting quotation:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete quotation' }, { status: 500 })
    }
}
