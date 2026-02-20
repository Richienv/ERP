import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        legalName: body.legalName !== undefined ? body.legalName : existing.legalName,
        customerType: body.customerType ?? existing.customerType,
        npwp: body.npwp !== undefined ? body.npwp : existing.npwp,
        nik: body.nik !== undefined ? body.nik : existing.nik,
        taxAddress: body.taxAddress !== undefined ? body.taxAddress : existing.taxAddress,
        isTaxable: body.isTaxable !== undefined ? body.isTaxable : existing.isTaxable,
        taxStatus: body.taxStatus ?? existing.taxStatus,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        email: body.email !== undefined ? body.email : existing.email,
        website: body.website !== undefined ? body.website : existing.website,
        creditLimit: body.creditLimit !== undefined ? body.creditLimit : existing.creditLimit,
        creditTerm: body.creditTerm !== undefined ? body.creditTerm : existing.creditTerm,
        paymentTerm: body.paymentTerm ?? existing.paymentTerm,
        creditStatus: body.creditStatus ?? existing.creditStatus,
        currency: body.currency ?? existing.currency,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        isProspect: body.isProspect !== undefined ? body.isProspect : existing.isProspect,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error updating customer:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        addresses: {
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        quotations: {
          select: {
            id: true,
            number: true,
            quotationDate: true,
            status: true,
            total: true,
          },
          orderBy: {
            quotationDate: 'desc',
          },
          take: 20,
        },
        salesOrders: {
          select: {
            id: true,
            number: true,
            orderDate: true,
            status: true,
            total: true,
          },
          orderBy: {
            orderDate: 'desc',
          },
          take: 20,
        },
        Invoice: {
          select: {
            id: true,
            number: true,
            issueDate: true,
            status: true,
            totalAmount: true,
            type: true,
          },
          orderBy: {
            issueDate: 'desc',
          },
          take: 20,
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
        },
        {
          status: 404,
        }
      )
    }

    const transactions = [
      ...customer.quotations.map((item) => ({
        id: item.id,
        type: 'quotation',
        number: item.number,
        date: item.quotationDate,
        status: item.status,
        amount: toNumber(item.total),
      })),
      ...customer.salesOrders.map((item) => ({
        id: item.id,
        type: 'salesOrder',
        number: item.number,
        date: item.orderDate,
        status: item.status,
        amount: toNumber(item.total),
      })),
      ...customer.Invoice.map((item) => ({
        id: item.id,
        type: 'invoice',
        number: item.number,
        date: item.issueDate,
        status: item.status,
        amount: toNumber(item.totalAmount),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    return NextResponse.json({
      success: true,
      data: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        legalName: customer.legalName,
        customerType: customer.customerType,
        category: customer.category,
        npwp: customer.npwp,
        nik: customer.nik,
        taxStatus: customer.taxStatus,
        isTaxable: customer.isTaxable,
        phone: customer.phone,
        email: customer.email,
        website: customer.website,
        creditLimit: toNumber(customer.creditLimit),
        creditTerm: customer.creditTerm,
        paymentTerm: customer.paymentTerm,
        creditStatus: customer.creditStatus,
        totalOrderValue: toNumber(customer.totalOrderValue),
        lastOrderDate: customer.lastOrderDate,
        currency: customer.currency,
        isActive: customer.isActive,
        isProspect: customer.isProspect,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        addresses: customer.addresses,
        contacts: customer.contacts,
        transactions,
        summary: {
          quotationCount: customer.quotations.length,
          salesOrderCount: customer.salesOrders.length,
          invoiceCount: customer.Invoice.length,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customer detail',
      },
      {
        status: 500,
      }
    )
  }
}
