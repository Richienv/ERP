import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Kontrak Kotak Masuk Operasi (inbox CEO dashboard):
 * setiap baris antrian wajib punya tombol aksi, pemilik tugas, dan
 * link ke layar kerja yang tepat — bukan cuma halaman indeks.
 */

type QueryArgs = { where?: Record<string, any> } | undefined

const h = vi.hoisted(() => {
    const handlers: Record<string, (args: QueryArgs) => unknown> = {}
    const fallback: Record<string, unknown> = {
        count: 0,
        aggregate: { _sum: {}, _count: { _all: 0 } },
        findMany: [],
        findFirst: null,
    }
    const prisma = new Proxy(
        {},
        {
            get(_target, model: string) {
                return new Proxy(
                    {},
                    {
                        get(_t, operation: string) {
                            return async (args: QueryArgs) => {
                                const handler = handlers[`${model}.${operation}`]
                                if (handler) return handler(args)
                                if (operation in fallback) return fallback[operation]
                                return null
                            }
                        },
                    },
                )
            },
        },
    )
    return { handlers, prisma }
})

vi.mock("@/lib/db", () => ({ prisma: h.prisma }))

const { getMiningCommandPulse } = await import("@/lib/actions/mining-command")
const { queueNumber, SEVERITY_LABEL, MODULE_LABEL } = await import("@/components/mining/command-pulse")

const BARE_VEHICLE = { id: "veh-bare-1", plateNumber: "KT 8811 AB", brand: "Komatsu", model: "PC200-8" }
const EXPIRING_SOON = {
    id: "veh-doc-2",
    plateNumber: "KT 1234 XY",
    stnkExpiry: new Date(Date.now() + 3 * 86400_000),
    kirExpiry: null,
    insuranceExpiry: null,
}
const EXPIRING_LATER = {
    id: "veh-doc-1",
    plateNumber: "KT 9999 ZZ",
    stnkExpiry: new Date(Date.now() + 25 * 86400_000),
    kirExpiry: null,
    insuranceExpiry: null,
}

function emptyBooks() {
    Object.keys(h.handlers).forEach((key) => delete h.handlers[key])
}

function seedBusyMine() {
    h.handlers["gLAccount.findMany"] = () => [{ balance: 250_000_000 }]
    h.handlers["invoice.aggregate"] = (args) => {
        const where = args?.where ?? {}
        if (where.type === "INV_OUT" && where.dueDate) {
            return { _sum: { balanceDue: 900_000_000 }, _count: { _all: 4 } }
        }
        if (where.type === "INV_OUT" && where.status === "DRAFT") {
            return { _sum: { totalAmount: 120_000_000 }, _count: { _all: 2 } }
        }
        if (where.type === "INV_IN" && where.status === "DRAFT") {
            return { _sum: { totalAmount: 310_000_000 }, _count: { _all: 3 } }
        }
        if (where.type === "INV_OUT") return { _sum: { balanceDue: 1_500_000_000 }, _count: { _all: 9 } }
        return { _sum: { balanceDue: 700_000_000 }, _count: { _all: 6 } }
    }
    h.handlers["invoice.findMany"] = () => [
        { id: "bill-1", number: "BILL-001", balanceDue: 50_000_000, dueDate: new Date() },
        { id: "bill-2", number: "BILL-002", balanceDue: 25_000_000, dueDate: new Date() },
    ]
    h.handlers["vehicle.count"] = (args) => (args?.where?.fixedAssetId === null ? 2 : 3)
    h.handlers["vehicle.findFirst"] = () => BARE_VEHICLE
    h.handlers["vehicle.findMany"] = () => [EXPIRING_LATER, EXPIRING_SOON]
    h.handlers["purchaseOrder.aggregate"] = () => ({ _sum: { totalAmount: 80_000_000 }, _count: { _all: 2 } })
    h.handlers["purchaseOrder.findFirst"] = () => ({ id: "po-77", number: "PO-2026-077" })
    h.handlers["purchaseRequest.count"] = () => 1
    h.handlers["leaveRequest.count"] = () => 2
}

beforeEach(() => {
    emptyBooks()
})

describe("Kotak Masuk Operasi — antrian aksi", () => {
    it("memberi setiap baris satu tombol aksi dan pemilik tugas", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()

        expect(pulse.actions.length).toBeGreaterThan(0)
        for (const action of pulse.actions) {
            expect(action.cta.length).toBeGreaterThan(0)
            expect(action.owner.length).toBeGreaterThan(0)
            expect(action.href.startsWith("/")).toBe(true)
            expect(action.title.length).toBeGreaterThan(0)
        }
    })

    it("mengurutkan Segera dulu, lalu nilai rupiah terbesar", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()

        const tones = pulse.actions.map((a) => a.tone)
        const rank = { critical: 0, warn: 1, go: 2 } as const
        const ranks = tones.map((t) => rank[t])
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b))

        const criticals = pulse.actions.filter((a) => a.tone === "critical")
        const amounts = criticals.map((a) => a.amount ?? 0)
        expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    })

    it("mengarahkan bill draft ke daftar bill yang sudah difilter DRAFT", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()
        const billDraft = pulse.actions.find((a) => a.id === "bill-draft")

        expect(billDraft).toBeDefined()
        expect(billDraft?.href).toBe("/finance/bills?status=DRAFT")
        expect(billDraft?.cta).toBe("Setujui")
        expect(billDraft?.count).toBe(3)
        expect(billDraft?.amount).toBe(310_000_000)
    })

    it("mengarahkan armada ke halaman unitnya, bukan daftar armada", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()

        const capitalize = pulse.actions.find((a) => a.id === "fleet-asset")
        expect(capitalize?.href).toBe(`/fleet/${BARE_VEHICLE.id}`)
        expect(capitalize?.detail).toContain(BARE_VEHICLE.plateNumber)

        const docs = pulse.actions.find((a) => a.id === "fleet-docs")
        expect(docs?.href).toBe(`/fleet/${EXPIRING_SOON.id}`)
        expect(docs?.tone).toBe("critical")
        expect(docs?.detail).toContain(EXPIRING_SOON.plateNumber)
    })

    it("menyorot PO yang menunggu approval lewat deep link highlight", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()
        const po = pulse.actions.find((a) => a.id === "po-approve")

        expect(po?.href).toBe("/procurement/orders?highlight=po-77")
        expect(po?.detail).toContain("PO-2026-077")
    })

    it("menghitung ringkasan antrian untuk header inbox", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()

        const { queue, actions } = pulse
        expect(queue.total).toBe(queue.segera + queue.mingguIni + queue.terjadwal)
        expect(queue.segera).toBeGreaterThan(0)
        expect(queue.amountHeld).toBeGreaterThanOrEqual(
            actions.reduce((sum, a) => sum + (a.amount ?? 0), 0),
        )
    })

    it("mengembalikan antrian bersih ketika tidak ada tunggakan", async () => {
        const pulse = await getMiningCommandPulse()

        expect(pulse.actions).toHaveLength(0)
        expect(pulse.queue).toEqual({
            total: 0,
            segera: 0,
            mingguIni: 0,
            terjadwal: 0,
            amountHeld: 0,
        })
        expect(pulse.integrity.booksHealthy).toBe(true)
    })
})

describe("Kotak Masuk Operasi — tampilan antrian", () => {
    it("menomori antrian dua digit seperti inbox", () => {
        expect(queueNumber(0)).toBe("01")
        expect(queueNumber(8)).toBe("09")
        expect(queueNumber(11)).toBe("12")
    })

    it("memakai label urgensi dan modul dalam Bahasa Indonesia", async () => {
        seedBusyMine()
        const pulse = await getMiningCommandPulse()

        expect(SEVERITY_LABEL).toEqual({
            critical: "Segera",
            warn: "Minggu ini",
            go: "Terjadwal",
        })
        for (const action of pulse.actions) {
            expect(SEVERITY_LABEL[action.tone]).toBeTruthy()
            expect(MODULE_LABEL[action.module]).toBeTruthy()
        }
    })
})
