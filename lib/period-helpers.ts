import { prisma } from "@/lib/db"

/**
 * Throws if the fiscal period for `date` is closed.
 * Call this at the TOP of any financial mutation — before status changes.
 *
 * Uses singleton prisma (no auth needed for read-only FiscalPeriod lookup).
 * Safe to call inside or outside withPrismaAuth.
 */
export async function assertPeriodOpen(date: Date): Promise<void> {
    try {
        const d = new Date(date)
        const month = d.getMonth() + 1
        const year = d.getFullYear()

        const period = await prisma.fiscalPeriod.findUnique({
            where: { year_month: { year, month } },
        })

        if (period?.isClosed) {
            throw new Error(
                `Periode fiskal ${period.name} sudah ditutup. Tidak bisa posting ke periode ini.`
            )
        }
    } catch (error: any) {
        // Re-throw if the period is genuinely closed (our own error)
        if (error?.message?.includes("Periode fiskal")) throw error

        // Only swallow Prisma "table/record missing" errors — these mean the
        // FiscalPeriod feature hasn't been migrated/used yet, so we treat the
        // period as open. Any other error (connection failure, timeout,
        // permission) MUST propagate so callers don't silently allow
        // back-dated transactions during an infra outage.
        const code = error?.code
        if (code === "P2021" || code === "P2025") {
            console.warn("[assertPeriodOpen] FiscalPeriod table/record missing — treating period as open:", error?.message)
            return
        }

        throw error
    }
}
