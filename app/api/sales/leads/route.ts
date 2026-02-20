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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const where: any = {}

    if (search.trim()) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (isEnumValue(status, Object.values(LeadStatus))) {
      where.status = status
    }

    if (isEnumValue(priority, Object.values(Priority))) {
      where.priority = priority
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        {
          updatedAt: 'desc',
        },
      ],
      take: 500,
    })

    const mapped = leads.map((lead) => ({
      id: lead.id,
      title: lead.title,
      description: lead.description,
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      company: lead.company,
      estimatedValue: toNumber(lead.estimatedValue),
      probability: lead.probability,
      expectedClose: lead.expectedClose,
      assignedTo: lead.assignedTo,
      assignee: lead.assignee,
      customer: lead.customer,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    }))

    const closedStatuses = new Set<LeadStatus>([LeadStatus.WON, LeadStatus.LOST])

    const summary = {
      totalLeads: mapped.length,
      pipelineValue: mapped
        .filter((lead) => lead.status !== LeadStatus.LOST)
        .reduce((sum, lead) => sum + lead.estimatedValue, 0),
      hotLeads: mapped.filter((lead) => lead.probability >= 80 && !closedStatuses.has(lead.status as LeadStatus)).length,
      statusCounts: {
        NEW: mapped.filter((lead) => lead.status === LeadStatus.NEW).length,
        FOLLOW_UP: mapped.filter((lead) => lead.status === LeadStatus.FOLLOW_UP).length,
        WON: mapped.filter((lead) => lead.status === LeadStatus.WON).length,
        LOST: mapped.filter((lead) => lead.status === LeadStatus.LOST).length,
      },
    }

    return NextResponse.json({
      success: true,
      data: mapped,
      summary,
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch leads',
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

    const title = toText(body.title)
    const contactName = toText(body.contactName)

    if (!title || !contactName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Judul prospek dan nama kontak wajib diisi',
        },
        {
          status: 400,
        }
      )
    }

    const status = isEnumValue(body.status, Object.values(LeadStatus))
      ? body.status
      : LeadStatus.NEW

    const source = isEnumValue(body.source, Object.values(LeadSource))
      ? body.source
      : LeadSource.WEBSITE

    const priority = isEnumValue(body.priority, Object.values(Priority))
      ? body.priority
      : Priority.MEDIUM

    const probability = Math.max(0, Math.min(100, Math.trunc(toNumber(body.probability, 0))))
    const estimatedValue = toNumber(body.estimatedValue, 0)

    const lead = await prisma.lead.create({
      data: {
        customerId: toText(body.customerId),
        title,
        description: toText(body.description),
        source,
        status,
        priority,
        contactName,
        contactEmail: toText(body.contactEmail),
        contactPhone: toText(body.contactPhone),
        company: toText(body.company),
        estimatedValue: estimatedValue > 0 ? estimatedValue : null,
        probability,
        expectedClose: body.expectedClose ? new Date(body.expectedClose) : null,
        assignedTo: toText(body.assignedTo),
      },
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

    return NextResponse.json(
      {
        success: true,
        data: {
          ...lead,
          estimatedValue: toNumber(lead.estimatedValue),
        },
        message: 'Lead berhasil dibuat',
      },
      {
        status: 201,
      }
    )
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create lead',
      },
      {
        status: 500,
      }
    )
  }
}
