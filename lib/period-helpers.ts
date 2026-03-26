import { prisma } from "@/lib/db"

/**
 * Throws if the fiscal period for `date` is closed.
 * Call this at the TOP of any financial mutation — before status changes.
 *
 * Uses singleton prisma (no auth needed for read-only FiscalPeriod lookup).
 * Safe to call inside or outside withPrismaAuth.
 */
export async function assertPeriodOpen(date: Date): Promise<void> {
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
}
