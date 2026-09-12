import { afterEach, describe, expect, it, vi } from "vitest"
import {
    buildWarRoomBuckets,
    classifyExpiry,
    daysUntilExpiry,
    formatDaysRemaining,
    vehicleDocStatuses,
} from "@/components/fleet/expiry-buckets"

function mockToday() {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 15, 30, 0)) // 11 Sep 2026 15:30
}

function daysFromToday(offset: number): Date {
    const d = new Date(2026, 8, 11)
    d.setDate(d.getDate() + offset)
    return d
}

describe("daysUntilExpiry", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns null when expiry is missing or invalid", () => {
        mockToday()
        expect(daysUntilExpiry(null)).toBeNull()
        expect(daysUntilExpiry(undefined)).toBeNull()
        expect(daysUntilExpiry("")).toBeNull()
        expect(daysUntilExpiry("bukan-tanggal")).toBeNull()
    })

    it("returns 0 for today even when the clock is after midnight", () => {
        mockToday()
        expect(daysUntilExpiry(new Date(2026, 8, 11, 0, 0, 0))).toBe(0)
        expect(daysUntilExpiry("2026-09-11")).toBe(0)
        expect(daysUntilExpiry(new Date(Date.UTC(2026, 8, 11, 0, 0, 0, 0)))).toBe(0)
    })

    it("returns negative when overdue and positive when still valid", () => {
        mockToday()
        expect(daysUntilExpiry(daysFromToday(-12))).toBe(-12)
        expect(daysUntilExpiry(daysFromToday(14))).toBe(14)
        expect(daysUntilExpiry(daysFromToday(30))).toBe(30)
        expect(daysUntilExpiry(daysFromToday(31))).toBe(31)
    })
})

describe("classifyExpiry", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("marks empty dates as MISSING", () => {
        mockToday()
        expect(classifyExpiry(null)).toBe("MISSING")
    })

    it("marks yesterday as OVERDUE and today / day-30 as DUE_SOON", () => {
        mockToday()
        expect(classifyExpiry(daysFromToday(-1))).toBe("OVERDUE")
        expect(classifyExpiry(daysFromToday(0))).toBe("DUE_SOON")
        expect(classifyExpiry(daysFromToday(30))).toBe("DUE_SOON")
        expect(classifyExpiry(daysFromToday(31))).toBe("OK")
    })
})

describe("formatDaysRemaining", () => {
    it("uses Bahasa copy for missing, overdue, due-today, and remaining days", () => {
        expect(formatDaysRemaining(null)).toBe("Belum tercatat")
        expect(formatDaysRemaining(-1)).toBe("Habis 1 hari lalu")
        expect(formatDaysRemaining(-12)).toBe("Habis 12 hari lalu")
        expect(formatDaysRemaining(0)).toBe("Jatuh tempo hari ini")
        expect(formatDaysRemaining(1)).toBe("1 hari tersisa")
        expect(formatDaysRemaining(8)).toBe("8 hari tersisa")
    })
})

describe("vehicleDocStatuses", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("classifies STNK, KIR, and asuransi independently", () => {
        mockToday()
        const docs = vehicleDocStatuses({
            stnkExpiry: daysFromToday(-5),
            kirExpiry: daysFromToday(10),
            insuranceExpiry: daysFromToday(90),
        })
        expect(docs.map((d) => [d.kind, d.bucket, d.daysRemaining])).toEqual([
            ["STNK", "OVERDUE", -5],
            ["KIR", "DUE_SOON", 10],
            ["ASURANSI", "OK", 90],
        ])
    })
})

describe("buildWarRoomBuckets", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    const fleet = [
        {
            id: "v1",
            plateNumber: "KT 8801 TB",
            stnkExpiry: daysFromToday(-12),
            kirExpiry: daysFromToday(14),
            insuranceExpiry: daysFromToday(200),
        },
        {
            id: "v2",
            plateNumber: "KT 8812 TB",
            stnkExpiry: daysFromToday(8),
            kirExpiry: null,
            insuranceExpiry: daysFromToday(-3),
        },
        {
            id: "v3",
            plateNumber: "KT 9900 XX",
            stnkExpiry: daysFromToday(120),
            kirExpiry: daysFromToday(90),
            insuranceExpiry: daysFromToday(60),
        },
    ]

    it("splits overdue vs due-in-30 and counts unique plates", () => {
        mockToday()
        const room = buildWarRoomBuckets(fleet)

        expect(room.overdueVehicleCount).toBe(2)
        expect(room.dueSoonVehicleCount).toBe(2)
        expect(room.actionVehicleCount).toBe(2)
        expect(room.missingVehicleCount).toBe(1)

        expect(room.overdue.map((r) => r.plateNumber)).toEqual(["KT 8801 TB", "KT 8812 TB"])
        expect(room.overdue[0].docs.map((d) => d.kind)).toEqual(["STNK"])
        expect(room.overdue[1].docs.map((d) => d.kind)).toEqual(["ASURANSI"])

        expect(room.dueSoon.map((r) => r.plateNumber)).toEqual(["KT 8812 TB", "KT 8801 TB"])
        expect(room.dueSoon.find((r) => r.id === "v1")?.docs.map((d) => d.kind)).toEqual(["KIR"])
        expect(room.dueSoon.find((r) => r.id === "v2")?.docs.map((d) => d.kind)).toEqual(["STNK"])

        expect(room.missing[0]).toMatchObject({
            plateNumber: "KT 8812 TB",
            docs: [expect.objectContaining({ kind: "KIR", bucket: "MISSING" })],
        })
    })

    it("sorts overdue by oldest lapse and due-soon by nearest date", () => {
        mockToday()
        const room = buildWarRoomBuckets([
            {
                id: "late",
                plateNumber: "KT 1000 AA",
                stnkExpiry: daysFromToday(-2),
                kirExpiry: null,
                insuranceExpiry: null,
            },
            {
                id: "older",
                plateNumber: "KT 1001 AA",
                stnkExpiry: daysFromToday(-40),
                kirExpiry: null,
                insuranceExpiry: null,
            },
        ])
        expect(room.overdue.map((r) => r.id)).toEqual(["older", "late"])
    })

    it("ignores healthy units from the action count", () => {
        mockToday()
        const room = buildWarRoomBuckets([
            {
                id: "ok",
                plateNumber: "KT 1111 OK",
                stnkExpiry: daysFromToday(200),
                kirExpiry: daysFromToday(200),
                insuranceExpiry: daysFromToday(200),
            },
        ])
        expect(room.actionVehicleCount).toBe(0)
        expect(room.overdue).toEqual([])
        expect(room.dueSoon).toEqual([])
    })

    it("lets the same plate appear in both overdue and due-soon for different docs", () => {
        mockToday()
        const room = buildWarRoomBuckets([
            {
                id: "mix",
                plateNumber: "KT 8801 TB",
                stnkExpiry: daysFromToday(-1),
                kirExpiry: daysFromToday(5),
                insuranceExpiry: daysFromToday(400),
            },
        ])
        expect(room.overdue).toHaveLength(1)
        expect(room.dueSoon).toHaveLength(1)
        expect(room.actionVehicleCount).toBe(1)
        expect(room.overdue[0].plateNumber).toBe("KT 8801 TB")
        expect(room.dueSoon[0].plateNumber).toBe("KT 8801 TB")
    })
})
