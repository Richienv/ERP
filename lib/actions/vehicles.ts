"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { VehicleType, VehicleStatus } from "@prisma/client"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ─────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────

export type VehicleListInput = {
    status?: VehicleStatus | "ALL"
    vehicleType?: VehicleType | "ALL"
    search?: string
    ownerCustomerId?: string | null  // null = own fleet only, undefined = all
}

export async function getVehicles(input?: VehicleListInput) {
    await requireAuth()

    const where: any = {}
    if (input?.status && input.status !== "ALL") where.status = input.status
    if (input?.vehicleType && input.vehicleType !== "ALL") where.vehicleType = input.vehicleType
    if (input?.ownerCustomerId !== undefined) {
        where.ownerCustomerId = input.ownerCustomerId
    }
    if (input?.search) {
        where.OR = [
            { plateNumber: { contains: input.search, mode: "insensitive" } },
            { brand: { contains: input.search, mode: "insensitive" } },
            { model: { contains: input.search, mode: "insensitive" } },
        ]
    }

    const vehicles = await prisma.vehicle.findMany({
        where,
        include: {
            warehouse: { select: { id: true, code: true, name: true } },
            ownerCustomer: { select: { id: true, code: true, name: true } },
            fixedAsset: { select: { id: true, assetCode: true, netBookValue: true } },
        },
        orderBy: [{ status: "asc" }, { plateNumber: "asc" }],
        take: 200,
    })

    // Compute compliance flags (STNK/KIR/asuransi expired or near-expiry)
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 86400_000)

    return vehicles.map((v) => {
        const stnkOverdue = v.stnkExpiry && v.stnkExpiry < now
        const stnkSoon = v.stnkExpiry && v.stnkExpiry >= now && v.stnkExpiry <= in30Days
        const kirOverdue = v.kirExpiry && v.kirExpiry < now
        const kirSoon = v.kirExpiry && v.kirExpiry >= now && v.kirExpiry <= in30Days
        const insuranceOverdue = v.insuranceExpiry && v.insuranceExpiry < now
        const insuranceSoon = v.insuranceExpiry && v.insuranceExpiry >= now && v.insuranceExpiry <= in30Days

        return {
            ...v,
            dailyRate: v.dailyRate ? Number(v.dailyRate) : null,
            monthlyRate: v.monthlyRate ? Number(v.monthlyRate) : null,
            engineHours: v.engineHours ? Number(v.engineHours) : null,
            fixedAsset: v.fixedAsset ? {
                id: v.fixedAsset.id,
                assetCode: v.fixedAsset.assetCode,
                netBookValue: Number(v.fixedAsset.netBookValue),
            } : null,
            compliance: {
                stnkOverdue: !!stnkOverdue,
                stnkSoon: !!stnkSoon,
                kirOverdue: !!kirOverdue,
                kirSoon: !!kirSoon,
                insuranceOverdue: !!insuranceOverdue,
                insuranceSoon: !!insuranceSoon,
                anyIssue: !!(stnkOverdue || stnkSoon || kirOverdue || kirSoon || insuranceOverdue || insuranceSoon),
            },
        }
    })
}

export async function getVehicleById(id: string) {
    await requireAuth()
    const v = await prisma.vehicle.findUnique({
        where: { id },
        include: {
            warehouse: { select: { id: true, code: true, name: true } },
            ownerCustomer: { select: { id: true, code: true, name: true } },
            fixedAsset: { select: { id: true, assetCode: true, name: true, netBookValue: true } },
        },
    })
    if (!v) return null
    return {
        ...v,
        dailyRate: v.dailyRate ? Number(v.dailyRate) : null,
        monthlyRate: v.monthlyRate ? Number(v.monthlyRate) : null,
        engineHours: v.engineHours ? Number(v.engineHours) : null,
        fixedAsset: v.fixedAsset ? {
            ...v.fixedAsset,
            netBookValue: Number(v.fixedAsset.netBookValue),
        } : null,
    }
}

// Stats untuk dashboard
export async function getVehicleStats() {
    await requireAuth()
    const [byStatus, totalCount, expiringDocs] = await Promise.all([
        prisma.vehicle.groupBy({
            by: ["status"],
            _count: { _all: true },
            where: { isActive: true },
        }),
        prisma.vehicle.count({ where: { isActive: true } }),
        prisma.vehicle.count({
            where: {
                isActive: true,
                OR: [
                    { stnkExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
                    { kirExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
                    { insuranceExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
                ],
            },
        }),
    ])
    return {
        total: totalCount,
        byStatus: byStatus.reduce((acc, b) => ({ ...acc, [b.status]: b._count._all }), {} as Record<string, number>),
        expiringDocsCount: expiringDocs,
    }
}

// ─────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────

export type CreateVehicleInput = {
    plateNumber: string
    vin?: string | null
    engineNumber?: string | null
    brand: string
    model: string
    variant?: string | null
    year: number
    color?: string | null
    bpkbNumber?: string | null
    stnkNumber?: string | null
    stnkExpiry?: string | null  // ISO date
    kirNumber?: string | null
    kirExpiry?: string | null
    insurancePolicyNumber?: string | null
    insuranceExpiry?: string | null
    insurer?: string | null
    vehicleType: VehicleType
    status?: VehicleStatus
    warehouseId?: string | null
    currentLocation?: string | null
    odometer?: number | null
    engineHours?: number | null
    dailyRate?: number | null
    monthlyRate?: number | null
    ownerCustomerId?: string | null
    notes?: string | null
}

export async function createVehicle(input: CreateVehicleInput) {
    try {
        await requireAuth()
        if (!input.plateNumber?.trim()) {
            return { success: false as const, error: "Plat nomor wajib diisi" }
        }
        if (!input.brand?.trim() || !input.model?.trim()) {
            return { success: false as const, error: "Merk dan model wajib diisi" }
        }
        if (!input.year || input.year < 1990 || input.year > new Date().getFullYear() + 1) {
            return { success: false as const, error: "Tahun tidak valid" }
        }

        const v = await prisma.vehicle.create({
            data: {
                plateNumber: input.plateNumber.trim().toUpperCase(),
                vin: input.vin || null,
                engineNumber: input.engineNumber || null,
                brand: input.brand.trim(),
                model: input.model.trim(),
                variant: input.variant || null,
                year: input.year,
                color: input.color || null,
                bpkbNumber: input.bpkbNumber || null,
                stnkNumber: input.stnkNumber || null,
                stnkExpiry: input.stnkExpiry ? new Date(input.stnkExpiry) : null,
                kirNumber: input.kirNumber || null,
                kirExpiry: input.kirExpiry ? new Date(input.kirExpiry) : null,
                insurancePolicyNumber: input.insurancePolicyNumber || null,
                insuranceExpiry: input.insuranceExpiry ? new Date(input.insuranceExpiry) : null,
                insurer: input.insurer || null,
                vehicleType: input.vehicleType,
                status: input.status ?? "AVAILABLE",
                warehouseId: input.warehouseId || null,
                currentLocation: input.currentLocation || null,
                odometer: input.odometer ?? null,
                engineHours: input.engineHours ?? null,
                dailyRate: input.dailyRate ?? null,
                monthlyRate: input.monthlyRate ?? null,
                ownerCustomerId: input.ownerCustomerId || null,
                notes: input.notes || null,
            },
        })

        revalidatePath("/fleet")
        return { success: true as const, id: v.id, plateNumber: v.plateNumber }
    } catch (error: any) {
        if (error?.code === "P2002") {
            return { success: false as const, error: `Plat nomor "${input.plateNumber}" sudah terdaftar` }
        }
        console.error("[createVehicle] error:", error)
        return { success: false as const, error: error?.message || "Gagal membuat vehicle" }
    }
}

export async function updateVehicle(id: string, patch: Partial<CreateVehicleInput>) {
    try {
        await requireAuth()
        const data: any = {}
        for (const k of Object.keys(patch) as (keyof CreateVehicleInput)[]) {
            const v = patch[k] as any
            if (v === undefined) continue
            if (k === "stnkExpiry" || k === "kirExpiry" || k === "insuranceExpiry") {
                data[k] = v ? new Date(v as string) : null
            } else if (k === "plateNumber") {
                data[k] = (v as string).trim().toUpperCase()
            } else {
                data[k] = v
            }
        }

        await prisma.vehicle.update({ where: { id }, data })
        revalidatePath("/fleet")
        revalidatePath(`/fleet/${id}`)
        return { success: true as const }
    } catch (error: any) {
        if (error?.code === "P2002") {
            return { success: false as const, error: "Plat nomor sudah terdaftar" }
        }
        console.error("[updateVehicle] error:", error)
        return { success: false as const, error: error?.message || "Gagal update vehicle" }
    }
}

export type CapitalizeVehicleInput = {
    purchaseCost: number
    purchaseDate?: string
    usefulLifeMonths?: number
    residualValue?: number
    fundingSource?: "OPENING_BALANCE" | "BANK" | "CASH" | "CREDIT"
}

/**
 * Daftarkan kendaraan milik perusahaan sebagai aset tetap.
 * Membuat FixedAsset (kategori FA-KND), posting GL perolehan, lalu tautkan 1:1 ke Vehicle.
 */
export async function capitalizeVehicleAsAsset(vehicleId: string, input: CapitalizeVehicleInput) {
    try {
        await requireAuth()
        const cost = Number(input.purchaseCost)
        if (!cost || cost <= 0) {
            return { success: false as const, error: "Nilai perolehan harus lebih dari 0" }
        }

        const vehicle = await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: {
                id: true,
                plateNumber: true,
                brand: true,
                model: true,
                year: true,
                vin: true,
                currentLocation: true,
                warehouse: { select: { name: true } },
                ownerCustomerId: true,
                fixedAssetId: true,
                isActive: true,
            },
        })
        if (!vehicle) return { success: false as const, error: "Armada tidak ditemukan" }
        if (vehicle.fixedAssetId) {
            return { success: false as const, error: "Armada ini sudah terdaftar sebagai aset tetap" }
        }
        if (vehicle.ownerCustomerId) {
            return { success: false as const, error: "Kendaraan milik customer tidak bisa dikapitalisasi sebagai aset perusahaan" }
        }

        const { createFixedAsset, getFixedAssetCategories, createFixedAssetCategory } = await import(
            "@/lib/actions/finance-fixed-assets"
        )
        const { ensureFixedAssetAccounts } = await import("@/lib/gl-accounts-server")
        const { SYS_ACCOUNTS } = await import("@/lib/gl-accounts")

        await ensureFixedAssetAccounts()

        let categoriesResult = await getFixedAssetCategories()
        let category = categoriesResult.categories?.find((c) => c.code === "FA-KND")
        if (!category) {
            const vehicleAccount = await prisma.gLAccount.findUnique({
                where: { code: SYS_ACCOUNTS.FA_VEHICLE },
                select: { id: true },
            })
            const accDep = await prisma.gLAccount.findUnique({
                where: { code: SYS_ACCOUNTS.ACC_DEPRECIATION },
                select: { id: true },
            })
            const depExp = await prisma.gLAccount.findUnique({
                where: { code: SYS_ACCOUNTS.DEPRECIATION },
                select: { id: true },
            })
            const created = await createFixedAssetCategory({
                code: "FA-KND",
                name: "Kendaraan & Alat Berat",
                description: "Armada operasional tambang — kendaraan, truk, alat berat",
                defaultMethod: "STRAIGHT_LINE",
                defaultUsefulLife: 60,
                defaultResidualPct: 10,
                assetAccountId: vehicleAccount?.id,
                accDepAccountId: accDep?.id,
                depExpAccountId: depExp?.id,
            })
            if (!created.success || !created.category) {
                return { success: false as const, error: created.error || "Gagal membuat kategori aset Kendaraan" }
            }
            category = { ...created.category, defaultResidualPct: Number(created.category.defaultResidualPct) } as any
        }

        const purchaseDate = input.purchaseDate || new Date().toISOString().slice(0, 10)
        const usefulLifeMonths = input.usefulLifeMonths || category.defaultUsefulLife || 60
        const residualPct = Number(category.defaultResidualPct || 10)
        const residualValue = input.residualValue ?? Math.round(cost * (residualPct / 100))
        const assetName = `${vehicle.brand} ${vehicle.model} ${vehicle.plateNumber}`.trim()

        const created = await createFixedAsset({
            name: assetName,
            categoryId: category.id,
            purchaseDate,
            capitalizationDate: purchaseDate,
            purchaseCost: cost,
            residualValue,
            usefulLifeMonths,
            depreciationMethod: "STRAIGHT_LINE",
            depreciationFrequency: "MONTHLY",
            depreciationStartDate: purchaseDate,
            location: vehicle.currentLocation || vehicle.warehouse?.name || undefined,
            department: "Operasional Tambang",
            serialNumber: vehicle.vin || undefined,
            notes: `Dikapitalisasi dari armada ${vehicle.plateNumber}`,
            fundingSource: input.fundingSource || "OPENING_BALANCE",
        })

        if (!created.success || !created.asset) {
            return { success: false as const, error: created.error || "Gagal membuat aset tetap" }
        }

        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { fixedAssetId: created.asset.id },
        })

        revalidatePath("/fleet")
        revalidatePath(`/fleet/${vehicle.id}`)
        revalidatePath("/finance/fixed-assets")
        revalidatePath("/finance")

        return {
            success: true as const,
            assetId: created.asset.id,
            assetCode: created.asset.assetCode,
            name: created.asset.name,
        }
    } catch (error: any) {
        console.error("[capitalizeVehicleAsAsset] error:", error)
        return { success: false as const, error: error?.message || "Gagal kapitalisasi armada" }
    }
}

export async function deleteVehicle(id: string) {
    try {
        await requireAuth()
        // Soft delete dulu — cek belum ada rental contract aktif (TODO setelah module rental dibuat).
        await prisma.vehicle.update({ where: { id }, data: { isActive: false, status: "INACTIVE" } })
        revalidatePath("/fleet")
        return { success: true as const }
    } catch (error: any) {
        console.error("[deleteVehicle] error:", error)
        return { success: false as const, error: error?.message || "Gagal hapus vehicle" }
    }
}
