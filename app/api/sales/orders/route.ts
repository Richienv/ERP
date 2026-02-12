import { NextRequest, NextResponse } from 'next/server'
import { PaymentTerm, SalesOrderStatus } from '@prisma/client'

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

async function generateSalesOrderNumber() {
  const now = new Date()
  const prefix = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  const last = await prisma.salesOrder.findFirst({
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

const normalizeOrderStatus = (status?: string | null) => {
  if (!status) return undefined
  if (status === 'PROCESSING') return SalesOrderStatus.IN_PROGRESS
  if (isEnumValue(status, Object.values(SalesOrderStatus))) return status
  return undefined
}

type NormalizedSalesOrderItem = {
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
    const status = normalizeOrderStatus(searchParams.get('status'))

    const where: any = {}

    if (search.trim()) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { quotation: { number: { contains: search, mode: 'insensitive' } } },
        { customerRef: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        quotation: {
          select: {
            id: true,
            number: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        orderDate: 'desc',
      },
      take: 300,
    })

    const mapped = orders.map((order) => ({
      id: order.id,
      number: order.number,
      customer: order.customer,
      quotationNumber: order.quotation?.number || null,
      customerRef: order.customerRef,
      orderDate: order.orderDate,
      requestedDate: order.requestedDate,
      status: order.status,
      paymentTerm: order.paymentTerm,
      subtotal: toNumber(order.subtotal),
      taxAmount: toNumber(order.taxAmount),
      discountAmount: toNumber(order.discountAmount),
      total: toNumber(order.total),
      itemCount: order._count.items,
      notes: order.notes || '',
      updatedAt: order.updatedAt,
    }))

    const summary = {
      totalOrders: mapped.length,
      totalValue: mapped.reduce((sum, order) => sum + order.total, 0),
      draft: mapped.filter((order) => order.status === SalesOrderStatus.DRAFT).length,
      confirmed: mapped.filter((order) => order.status === SalesOrderStatus.CONFIRMED).length,
      inProgress: mapped.filter((order) => order.status === SalesOrderStatus.IN_PROGRESS || String(order.status) === 'PROCESSING').length,
      delivered: mapped.filter((order) => order.status === SalesOrderStatus.DELIVERED).length,
      invoiced: mapped.filter((order) => order.status === SalesOrderStatus.INVOICED).length,
      completed: mapped.filter((order) => order.status === SalesOrderStatus.COMPLETED).length,
      cancelled: mapped.filter((order) => order.status === SalesOrderStatus.CANCELLED).length,
    }

    return NextResponse.json({
      success: true,
      data: mapped,
      summary,
    })
  } catch (error) {
    console.error('Error fetching sales orders:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sales orders',
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

    const orderPayload = body.salesOrder && typeof body.salesOrder === 'object' ? body.salesOrder : body
    const items = Array.isArray(body.items) ? body.items : []

    const customerId = toText(orderPayload.customerId)
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
          error: 'Minimal satu item pesanan wajib diisi',
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

    const normalizedItems: NormalizedSalesOrderItem[] = items.map((item: any) => {
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

    const quotationId = toText(orderPayload.quotationId)
    if (quotationId) {
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        select: { id: true, customerId: true },
      })

      if (!quotation) {
        return NextResponse.json(
          {
            success: false,
            error: 'Quotation tidak ditemukan',
          },
          {
            status: 404,
          }
        )
      }

      if (quotation.customerId !== customerId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Quotation tidak sesuai dengan customer yang dipilih',
          },
          {
            status: 400,
          }
        )
      }
    }

    const paymentTerm = isEnumValue(orderPayload.paymentTerm, Object.values(PaymentTerm))
      ? orderPayload.paymentTerm
      : PaymentTerm.NET_30

    const orderDate = orderPayload.orderDate ? new Date(orderPayload.orderDate) : new Date()
    const requestedDate = orderPayload.requestedDate ? new Date(orderPayload.requestedDate) : null

    if (Number.isNaN(orderDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tanggal pesanan tidak valid',
        },
        {
          status: 400,
        }
      )
    }

    const number = await generateSalesOrderNumber()

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: {
          number,
          customerId,
          quotationId: quotationId || null,
          customerRef: toText(orderPayload.customerRef),
          orderDate,
          requestedDate: requestedDate && !Number.isNaN(requestedDate.getTime()) ? requestedDate : null,
          paymentTerm,
          deliveryTerm: toText(orderPayload.deliveryTerm),
          subtotal,
          taxAmount,
          discountAmount,
          total,
          status: SalesOrderStatus.DRAFT,
          notes: toText(orderPayload.notes),
          internalNotes: toText(orderPayload.internalNotes),
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

      if (quotationId) {
        await tx.quotation.update({
          where: {
            id: quotationId,
          },
          data: {
            status: 'CONVERTED',
          },
        })
      }

      return created
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: order.id,
          number: order.number,
          customerName: order.customer.name,
          status: order.status,
          total: toNumber(order.total),
          itemCount: order._count.items,
        },
        message: 'Sales order berhasil dibuat',
      },
      {
        status: 201,
      }
    )
  } catch (error: any) {
    console.error('Error creating sales order:', error)

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
        error: 'Failed to create sales order',
      },
      {
        status: 500,
      }
    )
  }
}
