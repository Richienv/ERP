"use server"
import { prisma } from "@/lib/prisma"

export async function getDunningRules() {
  const rules = await prisma.dunningRule.findMany({
    where: { isActive: true },
    orderBy: { level: "asc" },
  })
  return { success: true, rules }
}

export async function upsertDunningRule(data: {
  level: number
  daysAfterDue: number
  action: string
  template?: string
  isActive?: boolean
}) {
  const rule = await prisma.dunningRule.upsert({
    where: { level: data.level },
    create: data,
    update: data,
  })
  return { success: true, rule }
}

export async function processDunning() {
  // 1. Get all active dunning rules ordered by level
  const rules = await prisma.dunningRule.findMany({
    where: { isActive: true },
    orderBy: { level: "asc" },
  })

  if (rules.length === 0) {
    return {
      success: true,
      processed: 0,
      escalated: 0,
      message: "Tidak ada aturan dunning aktif",
    }
  }

  // 2. Get all OVERDUE invoices (INV_OUT / AR) with outstanding balance
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      type: "INV_OUT",
      status: "OVERDUE",
      balanceDue: { gt: 0 },
    },
    include: { customer: { select: { name: true } } },
  })

  const now = new Date()
  const escalated: Array<{
    invoiceNumber: string
    customerName: string
    daysOverdue: number
    level: number
    action: string
    balanceDue: number
  }> = []

  // 3. For each overdue invoice, determine if it should escalate
  for (const inv of overdueInvoices) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Find highest applicable rule where daysAfterDue <= daysOverdue
    let applicableRule = null
    for (const rule of rules) {
      if (daysOverdue >= rule.daysAfterDue) {
        applicableRule = rule
      }
    }

    if (!applicableRule) continue

    // Skip if already at this level or higher
    if (
      inv.lastDunningLevel !== null &&
      applicableRule.level <= (inv.lastDunningLevel || 0)
    ) {
      continue
    }

    // Escalate: update invoice dunning state + log activity
    const nextRule = rules.find((r) => r.level > applicableRule!.level)

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        lastDunningLevel: applicableRule.level,
        nextDunningDate: nextRule
          ? new Date(
              now.getTime() +
                (nextRule.daysAfterDue - applicableRule.daysAfterDue) *
                  24 *
                  60 *
                  60 *
                  1000
            )
          : null,
      },
    })

    await prisma.collectionActivity.create({
      data: {
        invoiceId: inv.id,
        type: applicableRule.action,
        notes: `Auto-dunning level ${applicableRule.level}: ${applicableRule.action} (${daysOverdue} hari lewat jatuh tempo)`,
        outcome: "PENDING",
        createdBy: "SYSTEM",
      },
    })

    escalated.push({
      invoiceNumber: inv.number,
      customerName: inv.customer?.name || "",
      daysOverdue,
      level: applicableRule.level,
      action: applicableRule.action,
      balanceDue: Number(inv.balanceDue),
    })
  }

  // 4. Build summary by level
  const byLevel: Record<number, number> = {}
  for (const e of escalated) {
    byLevel[e.level] = (byLevel[e.level] || 0) + 1
  }

  return {
    success: true,
    processed: overdueInvoices.length,
    escalated: escalated.length,
    byLevel,
    items: escalated,
  }
}

export async function logCollectionActivity(data: {
  invoiceId: string
  type: string
  notes?: string
  outcome?: string
  nextAction?: string
  createdBy?: string
}) {
  const activity = await prisma.collectionActivity.create({
    data: {
      invoiceId: data.invoiceId,
      type: data.type,
      notes: data.notes,
      outcome: data.outcome,
      nextAction: data.nextAction ? new Date(data.nextAction) : undefined,
      createdBy: data.createdBy,
    },
  })
  return { success: true, activity }
}

export async function getCollectionHistory(invoiceId: string) {
  const activities = await prisma.collectionActivity.findMany({
    where: { invoiceId },
    orderBy: { date: "desc" },
  })
  return { success: true, activities }
}
