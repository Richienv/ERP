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

    const [customers, products, quotations, employees, customerCategories] = await Promise.all([
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
          creditLimit: true,
          totalOrderValue: true,
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
      prisma.employee.findMany({
        where: {
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
          OR: [
            { position: { contains: 'sales', mode: 'insensitive' } },
            { department: { contains: 'sales', mode: 'insensitive' } },
            { position: { contains: 'marketing', mode: 'insensitive' } },
            { department: { contains: 'marketing', mode: 'insensitive' } },
            { position: { contains: 'account manager', mode: 'insensitive' } },
            { position: { contains: 'business dev', mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          department: true,
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
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

    const mappedUsers = employees.map((emp) => ({
      id: emp.id,
      name: [emp.firstName, emp.lastName].filter(Boolean).join(' '),
      email: emp.email,
    }))

    const mappedCustomers = customers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      isProspect: c.isProspect,
      paymentTerm: c.paymentTerm,
      creditStatus: c.creditStatus,
      creditLimit: toNumber(c.creditLimit),
      totalOrderValue: toNumber(c.totalOrderValue),
    }))

    return NextResponse.json({
      success: true,
      data: {
        customers: mappedCustomers,
        products: mappedProducts,
        quotations: mappedQuotations,
        users: mappedUsers,
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
