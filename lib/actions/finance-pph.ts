"use server"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { postJournalEntry } from "@/lib/actions/finance-gl"
import { ensureSystemAccounts, getCashAccountCode } from "@/lib/gl-accounts-server"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { getPPhLiabilityAccount } from "@/lib/pph-helpers"

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user
}

/** List withholding tax records with filters. Read-only — uses prisma singleton. */
export async function getWithholdingTaxes(filters?: {
  type?: string
  deposited?: boolean
  startDate?: string
  endDate?: string
}) {
  try {
    await requireAuth()
    const where: any = {}

    if (filters?.type) where.type = filters.type
    if (filters?.deposited !== undefined) where.deposited = filters.deposited
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
    }

    const records = await prisma.withholdingTax.findMany({
      where,
      include: {
        payment: { select: { number: true, date: true } },
        invoice: {
          select: {
            number: true,
            supplierId: true,
            customerId: true,
            supplier: { select: { name: true } },
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, data: records }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** Batch mark withholding taxes as deposited + post GL entry (DR Utang PPh, CR Bank). */
export async function markWithholdingDeposited(data: {
  ids: string[]
  depositDate: string
  depositRef: string
  bankAccountCode?: string
  method?: "CASH" | "TRANSFER"
}) {
  try {
    await requireAuth()
    await assertPeriodOpen(new Date(data.depositDate))
    await ensureSystemAccounts()

    const records = await prisma.withholdingTax.findMany({
      where: { id: { in: data.ids }, deposited: false },
    })

    if (records.length === 0) {
      return { success: false, error: "Tidak ada PPh yang perlu disetor" }
    }

    // Group by type for GL posting
    const byType = new Map<string, number>()
    for (const r of records) {
      const current = byType.get(r.type) || 0
      byType.set(r.type, current + Number(r.amount))
    }

    const bankCode = getCashAccountCode(data.method || "TRANSFER", data.bankAccountCode)
    const totalAmount = records.reduce((sum, r) => sum + Number(r.amount), 0)

    const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = []

    for (const [type, amount] of byType) {
      glLines.push({
        accountCode: getPPhLiabilityAccount(type as any),
        debit: amount,
        credit: 0,
        description: `Setor PPh ${type === "PPH_23" ? "23" : type === "PPH_4_2" ? "4(2)" : "21"}`,
      })
    }

    glLines.push({
      accountCode: bankCode,
      debit: 0,
      credit: totalAmount,
      description: `Setor pajak - ${data.depositRef}`,
    })

    const glResult = await postJournalEntry({
      description: `Penyetoran PPh - ${data.depositRef}`,
      date: new Date(data.depositDate),
      reference: data.depositRef,
      lines: glLines,
    })

    if (!glResult?.success) {
      return { success: false, error: "Gagal posting jurnal penyetoran PPh" }
    }

    // Mark records as deposited
    await prisma.withholdingTax.updateMany({
      where: { id: { in: data.ids } },
      data: {
        deposited: true,
        depositDate: new Date(data.depositDate),
        depositRef: data.depositRef,
      },
    })

    return { success: true, count: records.length, totalAmount }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/** PPh summary for a period — grouped by type + direction. */
export async function getPPhSummary(period?: { startDate: string; endDate: string }) {
  try {
    await requireAuth()

    const where: any = {}
    if (period) {
      where.createdAt = {
        gte: new Date(period.startDate),
        lte: new Date(period.endDate),
      }
    }

    const records = await prisma.withholdingTax.findMany({ where })

    const summary = {
      pph21: { total: 0, deposited: 0, outstanding: 0, count: 0 },
      pph23: { total: 0, deposited: 0, outstanding: 0, count: 0 },
      pph4_2: { total: 0, deposited: 0, outstanding: 0, count: 0 },
    }

    for (const r of records) {
      const amount = Number(r.amount)
      const key = r.type === "PPH_21" ? "pph21" : r.type === "PPH_23" ? "pph23" : "pph4_2"
      summary[key].total += amount
      summary[key].count++
      if (r.deposited) {
        summary[key].deposited += amount
      } else {
        summary[key].outstanding += amount
      }
    }

    return { success: true, data: summary }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
