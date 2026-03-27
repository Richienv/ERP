import { prisma } from "@/lib/db"

/**
 * Get the exchange rate (middleRate) for a currency on a given date.
 * Returns 1 for IDR. Throws if no rate found for foreign currency.
 * Uses the most recent rate on or before the given date.
 */
export async function getExchangeRate(currencyCode: string, date: Date): Promise<number> {
    if (currencyCode === "IDR") return 1

    const rate = await prisma.exchangeRate.findFirst({
        where: {
            currency: { code: currencyCode },
            date: { lte: date },
        },
        orderBy: { date: "desc" },
        select: { middleRate: true },
    })

    if (!rate) {
        throw new Error(`Kurs ${currencyCode} belum tersedia untuk tanggal ini. Tambahkan kurs di halaman Mata Uang.`)
    }

    return Number(rate.middleRate)
}

/**
 * Convert a foreign currency amount to IDR using the given exchange rate.
 */
export function convertToIDR(amount: number, exchangeRate: number): number {
    return Math.round(amount * exchangeRate * 100) / 100
}
