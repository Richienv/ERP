/**
 * Pure STNK / KIR / asuransi expiry buckets for the fleet compliance war room.
 * Calendar-day math (start of local day) so "jatuh tempo hari ini" is due-soon, not overdue.
 */

export const DOC_KINDS = ["STNK", "KIR", "ASURANSI"] as const
export type DocKind = (typeof DOC_KINDS)[number]
export type ExpiryBucket = "OVERDUE" | "DUE_SOON" | "OK" | "MISSING"

export const DOC_KIND_LABEL: Record<DocKind, string> = {
    STNK: "STNK",
    KIR: "KIR",
    ASURANSI: "Asuransi",
}

export const SOON_WINDOW_DAYS = 30
const MS_PER_DAY = 86_400_000

export type VehicleExpiryFields = {
    id: string
    plateNumber: string
    stnkExpiry?: Date | string | null
    kirExpiry?: Date | string | null
    insuranceExpiry?: Date | string | null
}

export type DocStatus = {
    kind: DocKind
    label: string
    bucket: ExpiryBucket
    expiry: Date | null
    daysRemaining: number | null
}

export type WarRoomVehicleRow = {
    id: string
    plateNumber: string
    docs: DocStatus[]
}

function startOfLocalDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseExpiry(expiry: Date | string | null | undefined): Date | null {
    if (expiry == null || expiry === "") return null
    if (typeof expiry === "string") {
        const dateOnly = expiry.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateOnly) {
            return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
        }
        const parsed = new Date(expiry)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    if (Number.isNaN(expiry.getTime())) return null
    // Prisma @db.Date typically arrives as UTC midnight — treat that as a calendar date.
    if (
        expiry.getUTCHours() === 0 &&
        expiry.getUTCMinutes() === 0 &&
        expiry.getUTCSeconds() === 0 &&
        expiry.getUTCMilliseconds() === 0
    ) {
        return new Date(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate())
    }
    return expiry
}

export function daysUntilExpiry(
    expiry: Date | string | null | undefined,
    now: Date = new Date(),
): number | null {
    const exp = parseExpiry(expiry)
    if (!exp) return null
    return Math.round((startOfLocalDay(exp).getTime() - startOfLocalDay(now).getTime()) / MS_PER_DAY)
}

export function classifyExpiry(
    expiry: Date | string | null | undefined,
    now: Date = new Date(),
    soonDays: number = SOON_WINDOW_DAYS,
): ExpiryBucket {
    const days = daysUntilExpiry(expiry, now)
    if (days === null) return "MISSING"
    if (days < 0) return "OVERDUE"
    if (days <= soonDays) return "DUE_SOON"
    return "OK"
}

export function formatDaysRemaining(days: number | null): string {
    if (days === null) return "Belum tercatat"
    if (days < 0) {
        const n = Math.abs(days)
        return n === 1 ? "Habis 1 hari lalu" : `Habis ${n} hari lalu`
    }
    if (days === 0) return "Jatuh tempo hari ini"
    if (days === 1) return "1 hari tersisa"
    return `${days} hari tersisa`
}

export function formatExpiryDate(expiry: Date | string | null | undefined): string {
    const d = parseExpiry(expiry)
    if (!d) return "—"
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function expiryForKind(
    v: Pick<VehicleExpiryFields, "stnkExpiry" | "kirExpiry" | "insuranceExpiry">,
    kind: DocKind,
): Date | string | null | undefined {
    if (kind === "STNK") return v.stnkExpiry
    if (kind === "KIR") return v.kirExpiry
    return v.insuranceExpiry
}

export function vehicleDocStatuses(
    v: Pick<VehicleExpiryFields, "stnkExpiry" | "kirExpiry" | "insuranceExpiry">,
    now: Date = new Date(),
): DocStatus[] {
    return DOC_KINDS.map((kind) => {
        const raw = expiryForKind(v, kind)
        const expiry = parseExpiry(raw)
        return {
            kind,
            label: DOC_KIND_LABEL[kind],
            bucket: classifyExpiry(raw, now),
            expiry,
            daysRemaining: daysUntilExpiry(raw, now),
        }
    })
}

function pushDoc(
    map: Map<string, WarRoomVehicleRow>,
    vehicle: VehicleExpiryFields,
    doc: DocStatus,
) {
    const existing = map.get(vehicle.id)
    if (existing) {
        existing.docs.push(doc)
        return
    }
    map.set(vehicle.id, {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        docs: [doc],
    })
}

function worstDays(row: WarRoomVehicleRow): number {
    return Math.min(...row.docs.map((d) => d.daysRemaining ?? Number.POSITIVE_INFINITY))
}

export function buildWarRoomBuckets(vehicles: VehicleExpiryFields[], now: Date = new Date()) {
    const overdueMap = new Map<string, WarRoomVehicleRow>()
    const dueSoonMap = new Map<string, WarRoomVehicleRow>()
    const missingMap = new Map<string, WarRoomVehicleRow>()
    const actionIds = new Set<string>()

    for (const vehicle of vehicles) {
        for (const doc of vehicleDocStatuses(vehicle, now)) {
            if (doc.bucket === "OVERDUE") {
                pushDoc(overdueMap, vehicle, doc)
                actionIds.add(vehicle.id)
            } else if (doc.bucket === "DUE_SOON") {
                pushDoc(dueSoonMap, vehicle, doc)
                actionIds.add(vehicle.id)
            } else if (doc.bucket === "MISSING") {
                pushDoc(missingMap, vehicle, doc)
            }
        }
    }

    const overdue = [...overdueMap.values()].sort((a, b) => worstDays(a) - worstDays(b))
    const dueSoon = [...dueSoonMap.values()].sort((a, b) => worstDays(a) - worstDays(b))
    const missing = [...missingMap.values()].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "id"))

    return {
        overdue,
        dueSoon,
        missing,
        overdueVehicleCount: overdue.length,
        dueSoonVehicleCount: dueSoon.length,
        missingVehicleCount: missing.length,
        actionVehicleCount: actionIds.size,
    }
}
