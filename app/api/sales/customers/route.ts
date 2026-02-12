import { NextRequest, NextResponse } from 'next/server'
import { CreditStatus, CustomerType, PaymentTerm, TaxStatus } from '@prisma/client'

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

async function generateCustomerCode() {
  const year = new Date().getFullYear()
  const prefix = `CUST-${year}`
  const count = await prisma.customer.count({
    where: {
      code: {
        startsWith: prefix,
      },
    },
  })

  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const filterStatus = (searchParams.get('status') || 'all').toLowerCase()
    const creditStatus = searchParams.get('creditStatus')
    const customerType = searchParams.get('customerType')

    const where: any = {}

    if (search.trim()) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (filterStatus === 'active') {
      where.isActive = true
    } else if (filterStatus === 'inactive') {
      where.isActive = false
    } else if (filterStatus === 'prospect') {
      where.isProspect = true
    }

    if (isEnumValue(customerType, Object.values(CustomerType))) {
      where.customerType = customerType
    }

    if (isEnumValue(creditStatus, Object.values(CreditStatus))) {
      where.creditStatus = creditStatus
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        addresses: {
          where: {
            isPrimary: true,
          },
          select: {
            kabupaten: true,
            provinsi: true,
          },
          take: 1,
        },
      },
      orderBy: [
        {
          isProspect: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
    })

    const mapped = customers.map((customer) => ({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      legalName: customer.legalName,
      customerType: customer.customerType,
      categoryName: customer.category?.name || null,
      npwp: customer.npwp,
      phone: customer.phone || '-',
      email: customer.email || '-',
      city: customer.addresses[0]?.kabupaten || '-',
      province: customer.addresses[0]?.provinsi || null,
      creditLimit: toNumber(customer.creditLimit),
      creditStatus: customer.creditStatus,
      totalOrderValue: toNumber(customer.totalOrderValue),
      lastOrderDate: customer.lastOrderDate,
      isActive: customer.isActive,
      isProspect: customer.isProspect,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }))

    const summary = {
      totalCustomers: mapped.filter((item) => !item.isProspect).length,
      totalProspects: mapped.filter((item) => item.isProspect).length,
      activeCustomers: mapped.filter((item) => item.isActive).length,
      creditWatch: mapped.filter((item) => item.creditStatus === 'WATCH' || item.creditStatus === 'HOLD' || item.creditStatus === 'BLOCKED').length,
      totalRevenue: mapped.reduce((sum, item) => sum + item.totalOrderValue, 0),
    }

    return NextResponse.json({
      success: true,
      data: mapped,
      summary,
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers',
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

    const name = toText(body.name)
    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nama pelanggan wajib diisi',
        },
        {
          status: 400,
        }
      )
    }

    const incomingCode = toText(body.code)
    const code = incomingCode || await generateCustomerCode()

    if (incomingCode) {
      const existing = await prisma.customer.findUnique({
        where: { code },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Kode pelanggan ${code} sudah digunakan`,
          },
          {
            status: 409,
          }
        )
      }
    }

    const customerType = isEnumValue(body.customerType, Object.values(CustomerType))
      ? body.customerType
      : CustomerType.COMPANY

    const taxStatus = isEnumValue(body.taxStatus, Object.values(TaxStatus))
      ? body.taxStatus
      : TaxStatus.PKP

    const paymentTerm = isEnumValue(body.paymentTerm, Object.values(PaymentTerm))
      ? body.paymentTerm
      : PaymentTerm.NET_30

    const customer = await prisma.customer.create({
      data: {
        code,
        name,
        legalName: toText(body.legalName),
        customerType,
        categoryId: toText(body.categoryId),
        npwp: toText(body.npwp),
        nik: toText(body.nik),
        taxAddress: toText(body.taxAddress),
        isTaxable: typeof body.isTaxable === 'boolean' ? body.isTaxable : true,
        taxStatus,
        phone: toText(body.phone),
        email: toText(body.email),
        website: toText(body.website),
        creditLimit: toNumber(body.creditLimit, 0),
        creditTerm: Math.max(0, Math.trunc(toNumber(body.creditTerm, 30))),
        paymentTerm,
        currency: toText(body.currency) || 'IDR',
        priceListId: toText(body.priceListId),
        salesPersonId: toText(body.salesPersonId),
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        isProspect: typeof body.isProspect === 'boolean' ? body.isProspect : false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        customerType: true,
        isActive: true,
        isProspect: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: customer,
        message: 'Customer berhasil dibuat',
      },
      {
        status: 201,
      }
    )
  } catch (error: any) {
    console.error('Error creating customer:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'Kode pelanggan sudah digunakan',
        },
        {
          status: 409,
        }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create customer',
      },
      {
        status: 500,
      }
    )
  }
}
