import { NextRequest, NextResponse } from 'next/server'
import { LeadSource, LeadStatus, Priority } from '@prisma/client'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const data: Record<string, any> = {}

    if (body.title !== undefined) data.title = toText(body.title)
    if (body.description !== undefined) data.description = toText(body.description)
    if (body.contactName !== undefined) data.contactName = toText(body.contactName)
    if (body.contactEmail !== undefined) data.contactEmail = toText(body.contactEmail)
    if (body.contactPhone !== undefined) data.contactPhone = toText(body.contactPhone)
    if (body.company !== undefined) data.company = toText(body.company)
    if (body.assignedTo !== undefined) data.assignedTo = toText(body.assignedTo)
    if (body.customerId !== undefined) data.customerId = toText(body.customerId)

    if (body.estimatedValue !== undefined) {
      const estimatedValue = toNumber(body.estimatedValue, 0)
      data.estimatedValue = estimatedValue > 0 ? estimatedValue : null
    }

    if (body.probability !== undefined) {
      data.probability = Math.max(0, Math.min(100, Math.trunc(toNumber(body.probability, 0))))
    }

    if (body.expectedClose !== undefined) {
      data.expectedClose = body.expectedClose ? new Date(body.expectedClose) : null
    }

    if (isEnumValue(body.status, Object.values(LeadStatus))) {
      data.status = body.status
    }

    if (isEnumValue(body.source, Object.values(LeadSource))) {
      data.source = body.source
    }

    if (isEnumValue(body.priority, Object.values(Priority))) {
      data.priority = body.priority
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tidak ada perubahan data',
        },
        {
          status: 400,
        }
      )
    }

    const lead = await prisma.lead.update({
      where: { id },
      data,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        estimatedValue: toNumber(lead.estimatedValue),
      },
      message: 'Lead berhasil diperbarui',
    })
  } catch (error: any) {
    console.error('Error updating lead:', error)

    if (error?.code === 'P2025') {
      return NextResponse.json(
        {
          success: false,
          error: 'Lead tidak ditemukan',
        },
        {
          status: 404,
        }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update lead',
      },
      {
        status: 500,
      }
    )
  }
}
