import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: any = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    const orderWhere: any = {
      status: { notIn: ['CANCELLED'] },
    }
    if (startDate || endDate) {
      orderWhere.orderDate = dateFilter
    }

    const salespersons = await prisma.salesperson.findMany({
      where: { isActive: true },
      include: {
        salesOrders: {
          where: orderWhere,
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            orderDate: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { orderDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const report = salespersons.map((sp) => {
      const commissionRate = toNumber(sp.commissionRate)
      const orders = sp.salesOrders.map((so) => {
        const total = toNumber(so.total)
        return {
          id: so.id,
          number: so.number,
          customerName: so.customer.name,
          total,
          commission: total * (commissionRate / 100),
          status: so.status,
          orderDate: so.orderDate,
        }
      })

      const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
      const totalCommission = orders.reduce((sum, o) => sum + o.commission, 0)

      return {
        id: sp.id,
        code: sp.code,
        name: sp.name,
        commissionRate,
        orderCount: orders.length,
        totalSales,
        totalCommission,
        orders,
      }
    })

    const grandTotalSales = report.reduce((sum, sp) => sum + sp.totalSales, 0)
    const grandTotalCommission = report.reduce((sum, sp) => sum + sp.totalCommission, 0)

    return NextResponse.json({
      success: true,
      data: report,
      summary: {
        salespersonCount: report.length,
        grandTotalSales,
        grandTotalCommission,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    })
  } catch (error) {
    console.error('Error generating commission report:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal membuat laporan komisi' },
      { status: 500 }
    )
  }
}
