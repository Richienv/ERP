import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}

const toText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function generateSalespersonCode() {
  const last = await prisma.salesperson.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  let sequence = 1
  if (last?.code) {
    const match = last.code.match(/SP-(\d+)$/)
    if (match) sequence = Number(match[1]) + 1
  }

  return `SP-${String(sequence).padStart(3, '0')}`
}

export async function GET() {
  try {
    await requireAuth()

    const salespersons = await prisma.salesperson.findMany({
      include: {
        _count: {
          select: {
            salesOrders: true,
            quotations: true,
          },
        },
        salesOrders: {
          where: {
            status: { notIn: ['CANCELLED'] },
          },
          select: {
            total: true,
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const mapped = salespersons.map((sp) => {
      const totalSales = sp.salesOrders.reduce((sum, so) => sum + toNumber(so.total), 0)
      const commissionRate = toNumber(sp.commissionRate)
      const commissionEarned = totalSales * (commissionRate / 100)

      return {
        id: sp.id,
        code: sp.code,
        name: sp.name,
        phone: sp.phone,
        email: sp.email,
        commissionRate,
        isActive: sp.isActive,
        orderCount: sp._count.salesOrders,
        quotationCount: sp._count.quotations,
        totalSales,
        commissionEarned,
        createdAt: sp.createdAt,
        updatedAt: sp.updatedAt,
      }
    })

    const summary = {
      total: mapped.length,
      active: mapped.filter((sp) => sp.isActive).length,
      totalSalesAll: mapped.reduce((sum, sp) => sum + sp.totalSales, 0),
      totalCommissionAll: mapped.reduce((sum, sp) => sum + sp.commissionEarned, 0),
    }

    return NextResponse.json({ success: true, data: mapped, summary })
  } catch (error) {
    console.error('Error fetching salespersons:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data salesperson' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()

    const name = toText(body.name)
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nama salesperson wajib diisi' },
        { status: 400 }
      )
    }

    const code = toText(body.code) || await generateSalespersonCode()

    // Check uniqueness
    const existing = await prisma.salesperson.findUnique({
      where: { code },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kode ${code} sudah digunakan` },
        { status: 409 }
      )
    }

    const commissionRate = Math.max(0, Math.min(100, toNumber(body.commissionRate, 0)))

    const salesperson = await prisma.salesperson.create({
      data: {
        code,
        name,
        phone: toText(body.phone),
        email: toText(body.email),
        commissionRate,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: salesperson,
        message: 'Salesperson berhasil dibuat',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating salesperson:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Kode salesperson sudah digunakan' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Gagal membuat salesperson' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()

    const id = toText(body.id)
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID salesperson wajib diisi' },
        { status: 400 }
      )
    }

    const name = toText(body.name)
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nama salesperson wajib diisi' },
        { status: 400 }
      )
    }

    const commissionRate = Math.max(0, Math.min(100, toNumber(body.commissionRate, 0)))

    const salesperson = await prisma.salesperson.update({
      where: { id },
      data: {
        name,
        phone: toText(body.phone) ?? null,
        email: toText(body.email) ?? null,
        commissionRate,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      },
    })

    return NextResponse.json({
      success: true,
      data: salesperson,
      message: 'Salesperson berhasil diperbarui',
    })
  } catch (error: any) {
    console.error('Error updating salesperson:', error)
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Salesperson tidak ditemukan' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui salesperson' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID salesperson wajib diisi' },
        { status: 400 }
      )
    }

    // Check if salesperson has any orders
    const orderCount = await prisma.salesOrder.count({
      where: { salespersonId: id },
    })

    if (orderCount > 0) {
      // Soft delete - just deactivate
      await prisma.salesperson.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        success: true,
        message: 'Salesperson dinonaktifkan (ada pesanan terkait)',
      })
    }

    await prisma.salesperson.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Salesperson berhasil dihapus',
    })
  } catch (error: any) {
    console.error('Error deleting salesperson:', error)
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Salesperson tidak ditemukan' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus salesperson' },
      { status: 500 }
    )
  }
}
