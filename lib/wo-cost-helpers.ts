/**
 * Work Order — Actual Cost Calculation on Completion
 *
 * When a WO transitions to COMPLETED, this function calculates:
 * 1. Material cost (from ProductionBOM items × qty)
 * 2. Labor cost (from BOM steps, using actual time or estimated fallback)
 * 3. Overhead cost (proportional to labor, per station overheadPct)
 * 4. Cost variance % vs estimated cost
 *
 * 172 = standard Indonesian working hours per month (UU Ketenagakerjaan)
 */

import type { Prisma } from "@prisma/client"

const MONTHLY_WORK_MINUTES = 172 * 60 // 10,320 minutes

export async function calculateActualCostOnCompletion(
    tx: Prisma.TransactionClient,
    woId: string,
) {
    const wo = await tx.workOrder.findUnique({
        where: { id: woId },
        select: {
            estimatedCostTotal: true,
            productionBomId: true,
            actualQty: true,
            plannedQty: true,
        },
    })
    if (!wo?.productionBomId) return

    const qty = wo.actualQty || wo.plannedQty

    // 1. BOM items → material cost
    const bomItems = await tx.productionBOMItem.findMany({
        where: { bomId: wo.productionBomId },
        include: { material: { select: { costPrice: true } } },
    })

    let materialCost = 0
    for (const item of bomItems) {
        const itemQty = Number(item.quantityPerUnit || 0)
        const price = Number(item.material?.costPrice || 0)
        const waste = Number(item.wastePct || 0)
        materialCost += itemQty * price * (1 + waste / 100)
    }
    materialCost *= qty

    // 2. BOM steps → labor + overhead
    const steps = await tx.productionBOMStep.findMany({
        where: { bomId: wo.productionBomId },
        select: {
            laborMonthlySalary: true,
            durationMinutes: true,
            actualTimeTotal: true,
            useSubkon: true,
            station: {
                select: { overheadPct: true, operationType: true, costPerUnit: true },
            },
        },
    })

    let laborCost = 0
    let overheadCost = 0
    for (const step of steps) {
        const isSubkon =
            step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
        if (isSubkon) continue

        const salary = Number(step.laborMonthlySalary || 0)
        const actualTime = Number(step.actualTimeTotal || 0)
        const estTime = Number(step.durationMinutes || 0) * qty

        // Use actual time if recorded, otherwise fall back to estimated
        const timeUsed = actualTime > 0 ? actualTime : estTime
        const labor =
            salary > 0 && timeUsed > 0
                ? (salary * timeUsed) / MONTHLY_WORK_MINUTES
                : Number(step.station?.costPerUnit || 0) * qty
        laborCost += labor

        const pct = Number(step.station?.overheadPct || 0)
        if (pct > 0) overheadCost += (labor * pct) / 100
    }

    // 3. Totals + variance
    const actualCostTotal = materialCost + laborCost + overheadCost
    const estimated = Number(wo.estimatedCostTotal || 0)
    const variancePct =
        estimated > 0
            ? ((actualCostTotal - estimated) / estimated) * 100
            : null

    await tx.workOrder.update({
        where: { id: woId },
        data: {
            actualCostTotal,
            costVariancePct:
                variancePct != null
                    ? Math.round(variancePct * 100) / 100
                    : null,
        },
    })

    return { materialCost, laborCost, overheadCost, actualCostTotal }
}
