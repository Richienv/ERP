import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || undefined

    const [customers, products, quotations, users, customerCategories] = await Promise.all([
      prisma.customer.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isProspect: true,
          paymentTerm: true,
          creditStatus: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          sellingPrice: true,
          costPrice: true,
          stockLevels: {
            select: {
              quantity: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.quotation.findMany({
        where: {
          customerId,
          status: {
            in: ['DRAFT', 'SENT', 'ACCEPTED'],
          },
        },
        select: {
          id: true,
          number: true,
          customerId: true,
          total: true,
          status: true,
        },
        orderBy: {
          quotationDate: 'desc',
        },
        take: 200,
      }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.customerCategory.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ])

    const mappedProducts = products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      sellingPrice: toNumber(product.sellingPrice),
      costPrice: toNumber(product.costPrice),
      stock: product.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
    }))

    const mappedQuotations = quotations.map((quotation) => ({
      ...quotation,
      total: toNumber(quotation.total),
    }))

    return NextResponse.json({
      success: true,
      data: {
        customers,
        products: mappedProducts,
        quotations: mappedQuotations,
        users,
        customerCategories,
      },
    })
  } catch (error) {
    console.error('Error fetching sales options:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sales options',
      },
      {
        status: 500,
      }
    )
  }
}
