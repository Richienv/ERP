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

async function generateQuotationNumber() {
  const now = new Date()
  const prefix = `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  const last = await prisma.quotation.findFirst({
    where: {
      number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
  })

  let sequence = 1
  if (last?.number) {
    const match = last.number.match(/-(\d+)$/)
    if (match) {
      sequence = Number(match[1]) + 1
    }
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`
}

type NormalizedQuotationItem = {
  productId: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  lineSubtotal: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId') || undefined

    const where: any = {
      customerId,
    }

    if (search.trim()) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (isEnumValue(status, Object.values(QuotationStatus))) {
      where.status = status
    }

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        quotationDate: 'desc',
      },
      take: 200,
    })

    return NextResponse.json({
      success: true,
      data: quotations.map((quotation) => ({
        id: quotation.id,
        number: quotation.number,
        customerId: quotation.customerId,
        customerName: quotation.customer.name,
        customerCode: quotation.customer.code,
        quotationDate: quotation.quotationDate,
        validUntil: quotation.validUntil,
        paymentTerm: quotation.paymentTerm,
        status: quotation.status,
        subtotal: toNumber(quotation.subtotal),
        taxAmount: toNumber(quotation.taxAmount),
        discountAmount: toNumber(quotation.discountAmount),
        total: toNumber(quotation.total),
        itemCount: quotation._count.items,
        notes: quotation.notes,
      })),
    })
  } catch (error) {
    console.error('Error fetching quotations:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch quotations',
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const customerId = toText(body.customerId)
    const items = Array.isArray(body.items) ? body.items : []

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer wajib dipilih',
        },
        {
          status: 400,
        }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Minimal satu item quotation wajib diisi',
        },
        {
          status: 400,
        }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    })

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer tidak ditemukan',
        },
        {
          status: 404,
        }
      )
    }

    const productIds = Array.from(new Set(items.map((item: any) => toText(item.productId)).filter(Boolean))) as string[]
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
      },
    })

    const productMap = new Map(products.map((product) => [product.id, product]))

    const normalizedItems: NormalizedQuotationItem[] = items.map((item: any) => {
      const productId = toText(item.productId)
      if (!productId) {
        throw new Error('Produk item tidak valid')
      }

      const product = productMap.get(productId)
      if (!product) {
        throw new Error('Produk tidak ditemukan')
      }

      const quantity = Math.max(0.001, toNumber(item.quantity, 1))
      const unitPrice = toNumber(item.unitPrice, toNumber(product.sellingPrice))
      const discount = Math.max(0, Math.min(100, toNumber(item.discount, 0)))
      const taxRate = Math.max(0, Math.min(100, toNumber(item.taxRate, 11)))

      const lineSubtotal = quantity * unitPrice
      const discountAmount = lineSubtotal * (discount / 100)
      const afterDiscount = lineSubtotal - discountAmount
      const taxAmount = afterDiscount * (taxRate / 100)
      const lineTotal = afterDiscount + taxAmount

      return {
        productId,
        description: toText(item.description) || product.name,
        quantity,
        unitPrice,
        discount,
        taxRate,
        lineSubtotal,
        discountAmount,
        taxAmount,
        lineTotal,
      }
    })

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0)
    const discountAmount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0)
    const taxAmount = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0)
    const total = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)

    const number = await generateQuotationNumber()
    const paymentTerm = isEnumValue(body.paymentTerm, Object.values(PaymentTerm))
      ? body.paymentTerm
      : PaymentTerm.NET_30

    const quotationDate = body.quotationDate ? new Date(body.quotationDate) : new Date()
    const validUntil = body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    if (Number.isNaN(validUntil.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tanggal valid until tidak valid',
        },
        {
          status: 400,
        }
      )
    }

    const quotation = await prisma.quotation.create({
      data: {
        number,
        customerId,
        customerRef: toText(body.customerRef),
        quotationDate,
        validUntil,
        paymentTerm,
        deliveryTerm: toText(body.deliveryTerm),
        subtotal,
        taxAmount,
        discountAmount,
        total,
        status: QuotationStatus.DRAFT,
        notes: toText(body.notes),
        internalNotes: toText(body.internalNotes),
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: quotation.id,
          number: quotation.number,
          customerName: quotation.customer.name,
          status: quotation.status,
          total: toNumber(quotation.total),
          itemCount: quotation._count.items,
        },
        message: 'Quotation berhasil dibuat',
      },
      {
        status: 201,
      }
    )
  } catch (error: any) {
    console.error('Error creating quotation:', error)

    if (error?.message === 'Produk item tidak valid' || error?.message === 'Produk tidak ditemukan') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 400,
        }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create quotation',
      },
      {
        status: 500,
      }
    )
  }
}
