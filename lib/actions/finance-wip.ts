"use server"

import { prisma } from "@/lib/prisma"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts"
import { postJournalEntry } from "@/lib/actions/finance-gl"

// Garment industry WIP completion stages — aligned with GarmentStage enum
// materials: fraction of material cost absorbed at this stage
// conversion: fraction of labor+overhead cost absorbed at this stage
const WIP_STAGES: Record<string, { materials: number; conversion: number }> = {
  CUTTING:    { materials: 1.0, conversion: 0.20 },
  SEWING:     { materials: 1.0, conversion: 0.50 },
  FINISHING:  { materials: 1.0, conversion: 0.75 },
  QC:         { materials: 1.0, conversion: 0.90 },
  PACKING:    { materials: 1.0, conversion: 1.00 },
}

/**
 * Calculate WIP valuation for all open work orders.
 * Uses weighted-average cost method: materialCost * materialFactor + conversionCost * conversionFactor.
 * Material is 100% absorbed from CUTTING onwards (fabric already cut),
 * conversion (labor + overhead) scales with stage progression.
 */
export async function calculateWIPValuation(asOfDate?: string) {
  const date = asOfDate ? new Date(asOfDate) : new Date()

  // Find all open work orders (IN_PROGRESS or PLANNED with some production)
  const openWOs = await prisma.workOrder.findMany({
    where: {
      status: { in: ['IN_PROGRESS', 'PLANNED'] },
    },
    include: {
      product: true,
    },
  })

  const items = openWOs.map(wo => {
    // Approximate split: 70% materials, 30% conversion (labor + overhead)
    // In future, this can pull from BOM actual material costs
    const materialCost = Number(wo.estimatedCostTotal || 0) * 0.7
    const conversionCost = Number(wo.estimatedCostTotal || 0) * 0.3
    const stage = wo.stage || 'CUTTING'
    const stageFactors = WIP_STAGES[stage] || WIP_STAGES.CUTTING

    const wipValue = (materialCost * stageFactors.materials) + (conversionCost * stageFactors.conversion)
    const daysOpen = Math.floor((date.getTime() - wo.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    return {
      workOrderId: wo.id,
      workOrderNumber: wo.number,
      productName: wo.product?.name || '',
      stage,
      completionPct: stageFactors.conversion * 100,
      materialCost,
      conversionCost,
      wipValue: Math.round(wipValue),
      daysOpen,
      bucket: daysOpen <= 30 ? '0-30' as const : daysOpen <= 60 ? '31-60' as const : '60+' as const,
    }
  })

  const totalWIP = items.reduce((sum, i) => sum + i.wipValue, 0)

  // Get current GL balance for WIP account
  const wipAccount = await prisma.gLAccount.findUnique({ where: { code: SYS_ACCOUNTS.WIP } })
  const currentGLBalance = Number(wipAccount?.balance || 0)
  const adjustment = totalWIP - currentGLBalance

  return {
    success: true,
    asOfDate: date.toISOString(),
    items,
    summary: {
      totalWIP,
      currentGLBalance,
      adjustment,
      workOrderCount: items.length,
      byBucket: {
        current: items.filter(i => i.bucket === '0-30').reduce((s, i) => s + i.wipValue, 0),
        d31_60: items.filter(i => i.bucket === '31-60').reduce((s, i) => s + i.wipValue, 0),
        d60_plus: items.filter(i => i.bucket === '60+').reduce((s, i) => s + i.wipValue, 0),
      },
    },
  }
}

/**
 * Post WIP adjustment journal entry to reconcile GL WIP balance with calculated WIP.
 *
 * Double-entry pattern:
 *   WIP increases → DR WIP (1320), CR COGS (5000) — work absorbed, reduces period expense
 *   WIP decreases → DR COGS (5000), CR WIP (1320) — work released to expense
 *
 * This follows accrual-basis manufacturing accounting (PSAK 14 / IAS 2).
 */
export async function postWIPAdjustment(asOfDate?: string) {
  const valuation = await calculateWIPValuation(asOfDate)
  if (!valuation.success) return valuation

  const { adjustment } = valuation.summary
  if (Math.abs(adjustment) < 1) {
    return { success: true, message: 'WIP sudah sesuai, tidak perlu penyesuaian', adjustment: 0 }
  }

  await ensureSystemAccounts()

  const lines = adjustment > 0
    ? [
        { accountCode: SYS_ACCOUNTS.WIP, debit: adjustment, credit: 0, description: 'Penyesuaian WIP naik' },
        { accountCode: SYS_ACCOUNTS.COGS, debit: 0, credit: adjustment, description: 'Penyesuaian HPP' },
      ]
    : [
        { accountCode: SYS_ACCOUNTS.COGS, debit: Math.abs(adjustment), credit: 0, description: 'Penyesuaian HPP' },
        { accountCode: SYS_ACCOUNTS.WIP, debit: 0, credit: Math.abs(adjustment), description: 'Penyesuaian WIP turun' },
      ]

  const result = await postJournalEntry({
    description: `Penyesuaian WIP periode ${new Date().toLocaleDateString('id-ID')}`,
    date: new Date(),
    reference: `WIP-ADJ-${new Date().toISOString().slice(0, 7)}`,
    lines,
  })

  if (!result.success) {
    return { success: false, error: 'Gagal posting jurnal WIP', detail: result }
  }

  // Update WO wipValue fields after successful GL posting
  for (const item of valuation.items) {
    await prisma.workOrder.update({
      where: { id: item.workOrderId },
      data: {
        wipValue: item.wipValue,
        completionPct: item.completionPct,
        lastWIPValuationDate: new Date(),
      },
    })
  }

  return {
    success: true,
    adjustment,
    totalWIP: valuation.summary.totalWIP,
    currentGLBalance: valuation.summary.currentGLBalance,
    workOrderCount: valuation.summary.workOrderCount,
    byBucket: valuation.summary.byBucket,
  }
}
