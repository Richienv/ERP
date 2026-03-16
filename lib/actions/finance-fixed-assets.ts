'use server'

import { withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { postJournalEntry } from "./finance-gl"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts"
import type { Prisma } from "@prisma/client"

async function getAuthUserId(): Promise<string> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? "system"
}

// ============================================================
// TYPES
// ============================================================

type FixedAssetCategoryInput = {
    code: string
    name: string
    description?: string
    defaultMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "UNITS_OF_PRODUCTION"
    defaultUsefulLife?: number
    defaultResidualPct?: number
    assetAccountId?: string
    accDepAccountId?: string
    depExpAccountId?: string
    gainLossAccountId?: string
}

type FixedAssetInput = {
    name: string
    categoryId: string
    purchaseDate: string
    capitalizationDate: string
    supplierId?: string
    purchaseCost: number
    residualValue: number
    usefulLifeMonths: number
    depreciationMethod: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "UNITS_OF_PRODUCTION"
    depreciationFrequency: "MONTHLY" | "YEARLY"
    depreciationStartDate: string
    location?: string
    department?: string
    serialNumber?: string
    notes?: string
    assetCode?: string
}

type MovementInput = {
    assetId: string
    type: "DISPOSAL" | "SALE" | "WRITE_OFF" | "TRANSFER"
    date: string
    proceeds?: number
    fromLocation?: string
    fromDepartment?: string
    toLocation?: string
    toDepartment?: string
    notes?: string
}

// ============================================================
// FIXED ASSET CATEGORIES
// ============================================================

let _categoriesSeeded = false

export async function getFixedAssetCategories() {
    try {
        return await withPrismaAuth(async (prisma) => {
            if (!_categoriesSeeded) {
                const defaults = [
                    { code: "FA-TAN", name: "Tanah", defaultUsefulLife: 0, defaultResidualPct: 100 },
                    { code: "FA-BNG", name: "Bangunan", defaultUsefulLife: 240, defaultResidualPct: 10 },
                    { code: "FA-KND", name: "Kendaraan", defaultUsefulLife: 96, defaultResidualPct: 10 },
                    { code: "FA-MSN", name: "Mesin & Peralatan", defaultUsefulLife: 96, defaultResidualPct: 5 },
                    { code: "FA-KMP", name: "Komputer & IT", defaultUsefulLife: 48, defaultResidualPct: 0 },
                    { code: "FA-FRN", name: "Furnitur & Inventaris", defaultUsefulLife: 48, defaultResidualPct: 5 },
                    { code: "FA-LIN", name: "Peralatan Kantor", defaultUsefulLife: 48, defaultResidualPct: 5 },
                ]
                for (const d of defaults) {
                    await prisma.fixedAssetCategory.upsert({
                        where: { code: d.code },
                        create: {
                            code: d.code,
                            name: d.name,
                            defaultMethod: "STRAIGHT_LINE",
                            defaultUsefulLife: d.defaultUsefulLife,
                            defaultResidualPct: d.defaultResidualPct,
                        },
                        update: {},
                    })
                }
                _categoriesSeeded = true
            }

            const categories = await prisma.fixedAssetCategory.findMany({
                include: {
                    assetAccount: { select: { id: true, code: true, name: true } },
                    accDepAccount: { select: { id: true, code: true, name: true } },
                    depExpAccount: { select: { id: true, code: true, name: true } },
                    gainLossAccount: { select: { id: true, code: true, name: true } },
                    _count: { select: { assets: true } },
                },
                orderBy: { code: "asc" },
            })
            return { success: true, categories }
        })
    } catch (error) {
        console.error("Failed to fetch fixed asset categories:", error)
        return { success: false, categories: [] }
    }
}

export async function createFixedAssetCategory(data: FixedAssetCategoryInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const category = await prisma.fixedAssetCategory.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description,
                    defaultMethod: data.defaultMethod || "STRAIGHT_LINE",
                    defaultUsefulLife: data.defaultUsefulLife || 60,
                    defaultResidualPct: data.defaultResidualPct || 0,
                    assetAccountId: data.assetAccountId || null,
                    accDepAccountId: data.accDepAccountId || null,
                    depExpAccountId: data.depExpAccountId || null,
                    gainLossAccountId: data.gainLossAccountId || null,
                },
            })
            return { success: true, category }
        })
    } catch (error) {
        console.error("Failed to create fixed asset category:", error)
        return { success: false, error: "Gagal membuat kategori aset tetap" }
    }
}

export async function updateFixedAssetCategory(id: string, data: Partial<FixedAssetCategoryInput>) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const category = await prisma.fixedAssetCategory.update({
                where: { id },
                data: {
                    ...(data.code !== undefined && { code: data.code }),
                    ...(data.name !== undefined && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.defaultMethod !== undefined && { defaultMethod: data.defaultMethod }),
                    ...(data.defaultUsefulLife !== undefined && { defaultUsefulLife: data.defaultUsefulLife }),
                    ...(data.defaultResidualPct !== undefined && { defaultResidualPct: data.defaultResidualPct }),
                    ...(data.assetAccountId !== undefined && { assetAccountId: data.assetAccountId || null }),
                    ...(data.accDepAccountId !== undefined && { accDepAccountId: data.accDepAccountId || null }),
                    ...(data.depExpAccountId !== undefined && { depExpAccountId: data.depExpAccountId || null }),
                    ...(data.gainLossAccountId !== undefined && { gainLossAccountId: data.gainLossAccountId || null }),
                },
            })
            return { success: true, category }
        })
    } catch (error) {
        console.error("Failed to update fixed asset category:", error)
        return { success: false, error: "Gagal memperbarui kategori" }
    }
}

export async function deleteFixedAssetCategory(id: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const count = await prisma.fixedAsset.count({ where: { categoryId: id } })
            if (count > 0) {
                return { success: false, error: `Kategori masih digunakan oleh ${count} aset` }
            }
            await prisma.fixedAssetCategory.delete({ where: { id } })
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to delete fixed asset category:", error)
        return { success: false, error: "Gagal menghapus kategori" }
    }
}

// ============================================================
// FIXED ASSETS
// ============================================================

export async function getFixedAssets(filters?: { status?: string; categoryId?: string; search?: string }) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where: Prisma.FixedAssetWhereInput = {}
            if (filters?.status) where.status = filters.status as any
            if (filters?.categoryId) where.categoryId = filters.categoryId
            if (filters?.search) {
                where.OR = [
                    { name: { contains: filters.search, mode: "insensitive" } },
                    { assetCode: { contains: filters.search, mode: "insensitive" } },
                    { serialNumber: { contains: filters.search, mode: "insensitive" } },
                ]
            }

            const assets = await prisma.fixedAsset.findMany({
                where,
                include: {
                    category: { select: { id: true, code: true, name: true } },
                    supplier: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            })

            // KPI summary
            const allAssets = await prisma.fixedAsset.findMany({
                select: { status: true, purchaseCost: true, accumulatedDepreciation: true, netBookValue: true },
            })
            const totalCost = allAssets.reduce((sum, a) => sum + Number(a.purchaseCost), 0)
            const totalAccDep = allAssets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation), 0)
            const totalNBV = allAssets.reduce((sum, a) => sum + Number(a.netBookValue), 0)
            const activeCount = allAssets.filter(a => a.status === "ACTIVE").length

            return {
                success: true,
                assets,
                summary: { totalAssets: allAssets.length, activeCount, totalCost, totalAccDep, totalNBV },
            }
        })
    } catch (error) {
        console.error("Failed to fetch fixed assets:", error)
        return { success: false, assets: [], summary: { totalAssets: 0, activeCount: 0, totalCost: 0, totalAccDep: 0, totalNBV: 0 } }
    }
}

export async function getFixedAssetDetail(id: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const asset = await prisma.fixedAsset.findUnique({
                where: { id },
                include: {
                    category: true,
                    supplier: { select: { id: true, name: true, code: true } },
                    depreciationSchedules: { orderBy: { periodNo: "asc" } },
                    depreciationEntries: {
                        include: { run: { select: { id: true, periodStart: true, periodEnd: true, status: true } } },
                        orderBy: { run: { periodStart: "asc" } },
                    },
                    movements: { orderBy: { date: "desc" } },
                },
            })
            if (!asset) return { success: false, error: "Aset tidak ditemukan" }
            return { success: true, asset }
        })
    } catch (error) {
        console.error("Failed to fetch fixed asset detail:", error)
        return { success: false, error: "Gagal memuat detail aset" }
    }
}

async function generateAssetCode(prisma: any): Promise<string> {
    const lastAsset = await prisma.fixedAsset.findFirst({
        orderBy: { assetCode: "desc" },
        select: { assetCode: true },
    })
    if (!lastAsset) return "FA-0001"
    const match = lastAsset.assetCode.match(/FA-(\d+)/)
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1
    return `FA-${String(nextNum).padStart(4, "0")}`
}

function generateDepreciationSchedule(
    purchaseCost: number,
    residualValue: number,
    usefulLifeMonths: number,
    method: string,
    frequency: string,
    startDate: Date,
) {
    const depreciableAmount = purchaseCost - residualValue
    const schedule: Array<{
        periodNo: number
        scheduledDate: Date
        depreciationAmount: number
        accumulatedAmount: number
        bookValueAfter: number
    }> = []

    if (method === "STRAIGHT_LINE") {
        const periods = frequency === "YEARLY" ? Math.ceil(usefulLifeMonths / 12) : usefulLifeMonths
        const perPeriod = depreciableAmount / periods

        let accumulated = 0
        for (let i = 1; i <= periods; i++) {
            const isLast = i === periods
            const amount = isLast ? depreciableAmount - accumulated : Math.round(perPeriod * 100) / 100
            accumulated += amount
            const date = new Date(startDate)
            if (frequency === "YEARLY") {
                date.setFullYear(date.getFullYear() + i - 1)
                date.setMonth(11)
                date.setDate(31)
            } else {
                date.setMonth(date.getMonth() + i - 1)
                // Last day of the month
                const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
                date.setDate(nextMonth.getDate())
            }
            schedule.push({
                periodNo: i,
                scheduledDate: date,
                depreciationAmount: Math.round(amount * 100) / 100,
                accumulatedAmount: Math.round(accumulated * 100) / 100,
                bookValueAfter: Math.round((purchaseCost - accumulated) * 100) / 100,
            })
        }
    } else if (method === "DECLINING_BALANCE") {
        const periods = frequency === "YEARLY" ? Math.ceil(usefulLifeMonths / 12) : usefulLifeMonths
        const rate = frequency === "YEARLY" ? (2 / (usefulLifeMonths / 12)) : (2 / usefulLifeMonths)

        let bookValue = purchaseCost
        let accumulated = 0
        for (let i = 1; i <= periods; i++) {
            let amount = Math.round(bookValue * rate * 100) / 100
            // Cannot go below residual value
            if (bookValue - amount < residualValue) {
                amount = Math.round((bookValue - residualValue) * 100) / 100
            }
            if (amount <= 0) break
            accumulated += amount
            bookValue -= amount
            const date = new Date(startDate)
            if (frequency === "YEARLY") {
                date.setFullYear(date.getFullYear() + i - 1)
                date.setMonth(11)
                date.setDate(31)
            } else {
                date.setMonth(date.getMonth() + i - 1)
                const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
                date.setDate(nextMonth.getDate())
            }
            schedule.push({
                periodNo: i,
                scheduledDate: date,
                depreciationAmount: Math.round(amount * 100) / 100,
                accumulatedAmount: Math.round(accumulated * 100) / 100,
                bookValueAfter: Math.round(bookValue * 100) / 100,
            })
        }
    }
    // UNITS_OF_PRODUCTION: schedule is generated per depreciation run, not upfront

    return schedule
}

export async function createFixedAsset(data: FixedAssetInput) {
    try {
        const userId = await getAuthUserId()
        return await withPrismaAuth(async (prisma) => {
            const assetCode = data.assetCode || await generateAssetCode(prisma)

            // Check for duplicate code
            const existing = await prisma.fixedAsset.findUnique({ where: { assetCode } })
            if (existing) return { success: false, error: `Kode aset ${assetCode} sudah digunakan` }

            const nbv = data.purchaseCost - 0 // No depreciation yet
            const asset = await prisma.fixedAsset.create({
                data: {
                    assetCode,
                    name: data.name,
                    categoryId: data.categoryId,
                    purchaseDate: new Date(data.purchaseDate),
                    capitalizationDate: new Date(data.capitalizationDate),
                    supplierId: data.supplierId || null,
                    purchaseCost: data.purchaseCost,
                    residualValue: data.residualValue,
                    usefulLifeMonths: data.usefulLifeMonths,
                    depreciationMethod: data.depreciationMethod,
                    depreciationFrequency: data.depreciationFrequency,
                    depreciationStartDate: new Date(data.depreciationStartDate),
                    location: data.location,
                    department: data.department,
                    serialNumber: data.serialNumber,
                    notes: data.notes,
                    netBookValue: nbv,
                    status: "ACTIVE",
                },
            })

            // Generate provisional depreciation schedule
            if (data.depreciationMethod !== "UNITS_OF_PRODUCTION") {
                const schedule = generateDepreciationSchedule(
                    data.purchaseCost,
                    data.residualValue,
                    data.usefulLifeMonths,
                    data.depreciationMethod,
                    data.depreciationFrequency,
                    new Date(data.depreciationStartDate),
                )
                if (schedule.length > 0) {
                    await prisma.fixedAssetDeprecSchedule.createMany({
                        data: schedule.map(s => ({
                            assetId: asset.id,
                            periodNo: s.periodNo,
                            scheduledDate: s.scheduledDate,
                            depreciationAmount: s.depreciationAmount,
                            accumulatedAmount: s.accumulatedAmount,
                            bookValueAfter: s.bookValueAfter,
                        })),
                    })
                }
            }

            // Audit log
            await prisma.auditLog.create({
                data: {
                    entityType: "FixedAsset",
                    entityId: asset.id,
                    action: "CREATE",
                    userId,
                    narrative: `Aset tetap "${asset.name}" (${assetCode}) didaftarkan dengan nilai ${data.purchaseCost}`,
                },
            })

            return { success: true, asset }
        })
    } catch (error) {
        console.error("Failed to create fixed asset:", error)
        return { success: false, error: "Gagal membuat aset tetap" }
    }
}

export async function updateFixedAsset(id: string, data: Partial<FixedAssetInput>) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.fixedAsset.findUnique({ where: { id } })
            if (!existing) return { success: false, error: "Aset tidak ditemukan" }
            if (existing.status !== "ACTIVE" && existing.status !== "DRAFT") {
                return { success: false, error: "Hanya aset aktif atau draf yang dapat diperbarui" }
            }

            // Check if depreciation has been posted — if so, limit what can be changed
            const postedCount = await prisma.fixedAssetDeprecEntry.count({
                where: { assetId: id, run: { status: "POSTED" } },
            })

            const updateData: any = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.location !== undefined) updateData.location = data.location
            if (data.department !== undefined) updateData.department = data.department
            if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber
            if (data.notes !== undefined) updateData.notes = data.notes

            // Financial fields only editable if no depreciation has been posted
            if (postedCount === 0) {
                if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost
                if (data.residualValue !== undefined) updateData.residualValue = data.residualValue
                if (data.usefulLifeMonths !== undefined) updateData.usefulLifeMonths = data.usefulLifeMonths
                if (data.depreciationMethod !== undefined) updateData.depreciationMethod = data.depreciationMethod
                if (data.depreciationFrequency !== undefined) updateData.depreciationFrequency = data.depreciationFrequency
                if (data.depreciationStartDate !== undefined) updateData.depreciationStartDate = new Date(data.depreciationStartDate)
                if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
                if (data.supplierId !== undefined) updateData.supplierId = data.supplierId || null
                if (data.purchaseDate !== undefined) updateData.purchaseDate = new Date(data.purchaseDate)
                if (data.capitalizationDate !== undefined) updateData.capitalizationDate = new Date(data.capitalizationDate)

                // Recalculate NBV
                const cost = data.purchaseCost ?? Number(existing.purchaseCost)
                const accDep = Number(existing.accumulatedDepreciation)
                updateData.netBookValue = cost - accDep
            }

            const asset = await prisma.fixedAsset.update({ where: { id }, data: updateData })

            // Regenerate schedule if financial fields changed and no posted depreciation
            if (postedCount === 0 && (data.purchaseCost !== undefined || data.residualValue !== undefined ||
                data.usefulLifeMonths !== undefined || data.depreciationMethod !== undefined ||
                data.depreciationFrequency !== undefined || data.depreciationStartDate !== undefined)) {
                await prisma.fixedAssetDeprecSchedule.deleteMany({ where: { assetId: id } })
                const method = data.depreciationMethod ?? existing.depreciationMethod
                if (method !== "UNITS_OF_PRODUCTION") {
                    const schedule = generateDepreciationSchedule(
                        data.purchaseCost ?? Number(existing.purchaseCost),
                        data.residualValue ?? Number(existing.residualValue),
                        data.usefulLifeMonths ?? existing.usefulLifeMonths,
                        method,
                        data.depreciationFrequency ?? existing.depreciationFrequency,
                        new Date(data.depreciationStartDate ?? existing.depreciationStartDate),
                    )
                    if (schedule.length > 0) {
                        await prisma.fixedAssetDeprecSchedule.createMany({
                            data: schedule.map(s => ({
                                assetId: id,
                                periodNo: s.periodNo,
                                scheduledDate: s.scheduledDate,
                                depreciationAmount: s.depreciationAmount,
                                accumulatedAmount: s.accumulatedAmount,
                                bookValueAfter: s.bookValueAfter,
                            })),
                        })
                    }
                }
            }

            return { success: true, asset }
        })
    } catch (error) {
        console.error("Failed to update fixed asset:", error)
        return { success: false, error: "Gagal memperbarui aset tetap" }
    }
}

// ============================================================
// DEPRECIATION RUN
// ============================================================

export async function previewDepreciationRun(periodStart: string, periodEnd: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const start = new Date(periodStart)
            const end = new Date(periodEnd)

            // Check fiscal period lock
            const lockedPeriod = await prisma.fiscalPeriod.findFirst({
                where: {
                    isClosed: true,
                    startDate: { lte: end },
                    endDate: { gte: start },
                },
            })
            if (lockedPeriod) {
                return { success: false, error: `Periode ${lockedPeriod.name} sudah dikunci. Tidak dapat menjalankan penyusutan.` }
            }

            // Check for duplicate run in same period
            const existingRun = await prisma.fixedAssetDeprecRun.findFirst({
                where: {
                    periodStart: start,
                    periodEnd: end,
                    status: "POSTED",
                },
            })
            if (existingRun) {
                return { success: false, error: "Penyusutan untuk periode ini sudah di-posting" }
            }

            // Get all active assets that have depreciation due within this period
            const assets = await prisma.fixedAsset.findMany({
                where: {
                    status: "ACTIVE",
                    depreciationStartDate: { lte: end },
                },
                include: {
                    category: {
                        include: {
                            depExpAccount: { select: { id: true, code: true, name: true } },
                            accDepAccount: { select: { id: true, code: true, name: true } },
                        },
                    },
                    depreciationSchedules: {
                        where: {
                            isPosted: false,
                            scheduledDate: { lte: end },
                        },
                        orderBy: { periodNo: "asc" },
                        take: 1, // Next unposted period
                    },
                },
            })

            // Build preview entries
            const entries = assets
                .filter(a => a.depreciationSchedules.length > 0)
                .map(a => {
                    const sched = a.depreciationSchedules[0]
                    return {
                        assetId: a.id,
                        assetCode: a.assetCode,
                        assetName: a.name,
                        categoryName: a.category.name,
                        depreciationAmount: Number(sched.depreciationAmount),
                        accumulatedAfter: Number(sched.accumulatedAmount),
                        bookValueAfter: Number(sched.bookValueAfter),
                        purchaseCost: Number(a.purchaseCost),
                        depExpAccount: a.category.depExpAccount,
                        accDepAccount: a.category.accDepAccount,
                    }
                })

            const total = entries.reduce((sum, e) => sum + e.depreciationAmount, 0)

            return { success: true, entries, totalDepreciation: total, periodStart, periodEnd }
        })
    } catch (error) {
        console.error("Failed to preview depreciation run:", error)
        return { success: false, error: "Gagal menyiapkan pratinjau penyusutan" }
    }
}

export async function postDepreciationRun(periodStart: string, periodEnd: string, notes?: string) {
    try {
        const userId = await getAuthUserId()
        return await withPrismaAuth(async (prisma) => {
            const start = new Date(periodStart)
            const end = new Date(periodEnd)

            // Re-validate: no locked period
            const lockedPeriod = await prisma.fiscalPeriod.findFirst({
                where: { isClosed: true, startDate: { lte: end }, endDate: { gte: start } },
            })
            if (lockedPeriod) {
                return { success: false, error: `Periode ${lockedPeriod.name} sudah dikunci` }
            }

            // Re-validate: no duplicate
            const existingRun = await prisma.fixedAssetDeprecRun.findFirst({
                where: { periodStart: start, periodEnd: end, status: "POSTED" },
            })
            if (existingRun) {
                return { success: false, error: "Penyusutan untuk periode ini sudah di-posting" }
            }

            // Get eligible assets
            const assets = await prisma.fixedAsset.findMany({
                where: { status: "ACTIVE", depreciationStartDate: { lte: end } },
                include: {
                    category: {
                        include: {
                            depExpAccount: true,
                            accDepAccount: true,
                        },
                    },
                    depreciationSchedules: {
                        where: { isPosted: false, scheduledDate: { lte: end } },
                        orderBy: { periodNo: "asc" },
                        take: 1,
                    },
                },
            })

            const eligibleAssets = assets.filter(a => a.depreciationSchedules.length > 0)
            if (eligibleAssets.length === 0) {
                return { success: false, error: "Tidak ada aset yang memerlukan penyusutan untuk periode ini" }
            }

            let totalDep = 0
            const entryData: Array<{
                assetId: string
                depreciationAmount: number
                accumulatedAfter: number
                bookValueAfter: number
                scheduleId: string
                depExpAccountId: string | null
                accDepAccountId: string | null
            }> = []

            for (const asset of eligibleAssets) {
                const sched = asset.depreciationSchedules[0]
                const depAmount = Number(sched.depreciationAmount)
                totalDep += depAmount
                entryData.push({
                    assetId: asset.id,
                    depreciationAmount: depAmount,
                    accumulatedAfter: Number(sched.accumulatedAmount),
                    bookValueAfter: Number(sched.bookValueAfter),
                    scheduleId: sched.id,
                    depExpAccountId: asset.category.depExpAccountId,
                    accDepAccountId: asset.category.accDepAccountId,
                })
            }

            // Create the depreciation run
            const run = await prisma.fixedAssetDeprecRun.create({
                data: {
                    periodStart: start,
                    periodEnd: end,
                    status: "POSTED",
                    totalAssets: eligibleAssets.length,
                    totalDepreciation: totalDep,
                    postedBy: userId,
                    postedAt: new Date(),
                    notes,
                },
            })

            // Create entries + journal entries + update asset balances
            // Uses postJournalEntry() which correctly handles GL balance direction per account type
            await ensureSystemAccounts()

            for (const entry of entryData) {
                let journalEntryId: string | null = null

                if (entry.depExpAccountId && entry.accDepAccountId) {
                    const assetInfo = eligibleAssets.find(a => a.id === entry.assetId)!
                    // Look up account codes for postJournalEntry (it uses codes, not IDs)
                    const depExpAccount = await prisma.gLAccount.findUnique({ where: { id: entry.depExpAccountId }, select: { code: true } })
                    const accDepAccount = await prisma.gLAccount.findUnique({ where: { id: entry.accDepAccountId }, select: { code: true } })

                    if (depExpAccount && accDepAccount) {
                        // DR Beban Penyusutan (6290), CR Akumulasi Penyusutan (1590)
                        // postJournalEntry handles GL balance updates correctly per account type
                        const glResult = await postJournalEntry({
                            description: `Penyusutan ${assetInfo.name} (${assetInfo.assetCode}) - ${periodStart} s/d ${periodEnd}`,
                            date: end,
                            reference: `DEP-${run.id.substring(0, 8)}`,
                            lines: [
                                { accountCode: depExpAccount.code, debit: entry.depreciationAmount, credit: 0, description: `Beban penyusutan - ${assetInfo.name}` },
                                { accountCode: accDepAccount.code, debit: 0, credit: entry.depreciationAmount, description: `Akumulasi penyusutan - ${assetInfo.name}` },
                            ],
                        })
                        if (glResult?.success && (glResult as any).id) {
                            journalEntryId = (glResult as any).id
                        } else {
                            throw new Error(`Jurnal penyusutan gagal untuk ${assetInfo.name}: ${(glResult as any)?.error || 'Unknown error'}`)
                        }
                    } else {
                        throw new Error(`Akun GL tidak ditemukan untuk kategori ${assetInfo.category.name}. Pastikan kategori memiliki akun Beban Penyusutan dan Akumulasi Penyusutan.`)
                    }
                }

                await prisma.fixedAssetDeprecEntry.create({
                    data: {
                        runId: run.id,
                        assetId: entry.assetId,
                        depreciationAmount: entry.depreciationAmount,
                        accumulatedAfter: entry.accumulatedAfter,
                        bookValueAfter: entry.bookValueAfter,
                        journalEntryId,
                    },
                })

                // Mark schedule as posted
                await prisma.fixedAssetDeprecSchedule.update({
                    where: { id: entry.scheduleId },
                    data: { isPosted: true },
                })

                // Update asset accumulated depreciation & NBV
                await prisma.fixedAsset.update({
                    where: { id: entry.assetId },
                    data: {
                        accumulatedDepreciation: entry.accumulatedAfter,
                        netBookValue: entry.bookValueAfter,
                        ...(entry.bookValueAfter <= Number(eligibleAssets.find(a => a.id === entry.assetId)!.residualValue)
                            ? { status: "FULLY_DEPRECIATED" }
                            : {}),
                    },
                })
            }

            // Audit log
            await prisma.auditLog.create({
                data: {
                    entityType: "FixedAssetDeprecRun",
                    entityId: run.id,
                    action: "CREATE",
                    userId,
                    narrative: `Penyusutan diposting untuk ${eligibleAssets.length} aset, total Rp ${totalDep.toLocaleString("id-ID")}`,
                },
            })

            return { success: true, run, entriesCount: eligibleAssets.length, totalDepreciation: totalDep }
        })
    } catch (error) {
        console.error("Failed to post depreciation run:", error)
        return { success: false, error: "Gagal memposting penyusutan" }
    }
}

export async function getDepreciationRuns() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const runs = await prisma.fixedAssetDeprecRun.findMany({
                include: { _count: { select: { entries: true } } },
                orderBy: { createdAt: "desc" },
            })
            return { success: true, runs }
        })
    } catch (error) {
        console.error("Failed to fetch depreciation runs:", error)
        return { success: false, runs: [] }
    }
}

export async function getDepreciationRunDetail(runId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const run = await prisma.fixedAssetDeprecRun.findUnique({
                where: { id: runId },
                include: {
                    entries: {
                        include: {
                            asset: { select: { id: true, assetCode: true, name: true, purchaseCost: true } },
                            journalEntry: { select: { id: true, reference: true } },
                        },
                    },
                },
            })
            if (!run) return { success: false, error: "Run tidak ditemukan" }
            return { success: true, run }
        })
    } catch (error) {
        console.error("Failed to fetch depreciation run detail:", error)
        return { success: false, error: "Gagal memuat detail" }
    }
}

export async function reverseDepreciationRun(runId: string) {
    try {
        const userId = await getAuthUserId()
        return await withPrismaAuth(async (prisma) => {
            const run = await prisma.fixedAssetDeprecRun.findUnique({
                where: { id: runId },
                include: {
                    entries: { include: { asset: true, journalEntry: { include: { lines: true } } } },
                },
            })
            if (!run) return { success: false, error: "Run tidak ditemukan" }
            if (run.status !== "POSTED") return { success: false, error: "Hanya run yang sudah diposting yang dapat dibatalkan" }

            // Check fiscal period lock
            const lockedPeriod = await prisma.fiscalPeriod.findFirst({
                where: { isClosed: true, startDate: { lte: run.periodEnd }, endDate: { gte: run.periodStart } },
            })
            if (lockedPeriod) {
                return { success: false, error: `Periode ${lockedPeriod.name} sudah dikunci. Tidak dapat membatalkan penyusutan.` }
            }

            // Reverse each entry
            for (const entry of run.entries) {
                // Void journal entry
                if (entry.journalEntryId) {
                    await prisma.journalEntry.update({
                        where: { id: entry.journalEntryId },
                        data: { status: "VOID" },
                    })

                    // Reverse GL balances
                    if (entry.journalEntry) {
                        for (const line of entry.journalEntry.lines) {
                            const adjustment = Number(line.debit) - Number(line.credit)
                            if (adjustment !== 0) {
                                await prisma.gLAccount.update({
                                    where: { id: line.accountId },
                                    data: { balance: { decrement: Math.abs(adjustment) * (adjustment > 0 ? 1 : -1) } },
                                })
                            }
                        }
                    }
                }

                // Revert asset NBV and accumulated depreciation
                const newAccDep = Number(entry.asset.accumulatedDepreciation) - Number(entry.depreciationAmount)
                const newNBV = Number(entry.asset.purchaseCost) - newAccDep
                await prisma.fixedAsset.update({
                    where: { id: entry.assetId },
                    data: {
                        accumulatedDepreciation: Math.max(newAccDep, 0),
                        netBookValue: newNBV,
                        status: "ACTIVE", // Reactivate if was FULLY_DEPRECIATED
                    },
                })

                // Un-post the schedule entry
                const schedule = await prisma.fixedAssetDeprecSchedule.findFirst({
                    where: { assetId: entry.assetId, accumulatedAmount: Number(entry.accumulatedAfter), isPosted: true },
                })
                if (schedule) {
                    await prisma.fixedAssetDeprecSchedule.update({
                        where: { id: schedule.id },
                        data: { isPosted: false },
                    })
                }
            }

            // Mark run as reversed
            await prisma.fixedAssetDeprecRun.update({
                where: { id: runId },
                data: { status: "REVERSED", reversedBy: userId, reversedAt: new Date() },
            })

            await prisma.auditLog.create({
                data: {
                    entityType: "FixedAssetDeprecRun",
                    entityId: runId,
                    action: "STATUS_CHANGE",
                    userId,
                    narrative: `Penyusutan periode ${run.periodStart.toISOString().slice(0, 10)} s/d ${run.periodEnd.toISOString().slice(0, 10)} dibatalkan`,
                },
            })

            return { success: true }
        })
    } catch (error) {
        console.error("Failed to reverse depreciation run:", error)
        return { success: false, error: "Gagal membatalkan penyusutan" }
    }
}

// ============================================================
// ASSET MOVEMENTS (Disposal, Sale, Write-Off, Transfer)
// ============================================================

export async function createAssetMovement(data: MovementInput) {
    try {
        const userId = await getAuthUserId()
        return await withPrismaAuth(async (prisma) => {
            const asset = await prisma.fixedAsset.findUnique({
                where: { id: data.assetId },
                include: {
                    category: {
                        include: {
                            assetAccount: true,
                            accDepAccount: true,
                            gainLossAccount: true,
                        },
                    },
                },
            })
            if (!asset) return { success: false, error: "Aset tidak ditemukan" }
            if (asset.status !== "ACTIVE" && asset.status !== "FULLY_DEPRECIATED") {
                return { success: false, error: "Hanya aset aktif atau disusutkan penuh yang dapat dipindahkan/dihapus" }
            }

            const movementDate = new Date(data.date)

            // Check fiscal period lock
            const lockedPeriod = await prisma.fiscalPeriod.findFirst({
                where: { isClosed: true, startDate: { lte: movementDate }, endDate: { gte: movementDate } },
            })
            if (lockedPeriod) {
                return { success: false, error: `Periode ${lockedPeriod.name} sudah dikunci` }
            }

            const nbv = Number(asset.netBookValue)
            const cost = Number(asset.purchaseCost)
            const accDep = Number(asset.accumulatedDepreciation)

            let journalEntryId: string | null = null
            let gainLoss: number | null = null
            let newStatus: string = asset.status

            if (data.type === "TRANSFER") {
                // Transfer only changes location/department, no accounting impact
                await prisma.fixedAsset.update({
                    where: { id: data.assetId },
                    data: {
                        location: data.toLocation ?? asset.location,
                        department: data.toDepartment ?? asset.department,
                    },
                })
            } else {
                // DISPOSAL, SALE, WRITE_OFF — remove asset from books
                const proceeds = data.proceeds || 0
                gainLoss = proceeds - nbv

                const assetAccountId = asset.category.assetAccountId
                const accDepAccountId = asset.category.accDepAccountId
                const gainLossAccountId = asset.category.gainLossAccountId

                if (assetAccountId && accDepAccountId) {
                    // Look up account codes for postJournalEntry
                    const assetAcc = await prisma.gLAccount.findUnique({ where: { id: assetAccountId }, select: { code: true } })
                    const accDepAcc = await prisma.gLAccount.findUnique({ where: { id: accDepAccountId }, select: { code: true } })
                    const gainLossAcc = gainLossAccountId
                        ? await prisma.gLAccount.findUnique({ where: { id: gainLossAccountId }, select: { code: true } })
                        : null

                    if (assetAcc && accDepAcc) {
                        const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = []

                        // DR: Bank/Cash for sale proceeds (if SALE with proceeds > 0)
                        if (data.type === "SALE" && proceeds > 0) {
                            glLines.push({ accountCode: SYS_ACCOUNTS.BANK_BCA, debit: proceeds, credit: 0, description: `Hasil penjualan aset - ${asset.name}` })
                        }

                        // DR: Akumulasi Penyusutan (remove contra-asset)
                        if (accDep > 0) {
                            glLines.push({ accountCode: accDepAcc.code, debit: accDep, credit: 0, description: `Hapus akumulasi penyusutan - ${asset.name}` })
                        }

                        // DR/CR: Gain/Loss on disposal
                        if (gainLoss !== 0 && gainLossAcc) {
                            if (gainLoss > 0) {
                                glLines.push({ accountCode: gainLossAcc.code, debit: 0, credit: gainLoss, description: `Keuntungan ${data.type === "SALE" ? "penjualan" : "penghapusan"} - ${asset.name}` })
                            } else {
                                glLines.push({ accountCode: gainLossAcc.code, debit: Math.abs(gainLoss), credit: 0, description: `Kerugian ${data.type === "SALE" ? "penjualan" : "penghapusan"} - ${asset.name}` })
                            }
                        }

                        // CR: Fixed Asset (remove original cost)
                        glLines.push({ accountCode: assetAcc.code, debit: 0, credit: cost, description: `Hapus harga perolehan - ${asset.name}` })

                        // Post via postJournalEntry (handles GL balance direction correctly)
                        await ensureSystemAccounts()
                        const glResult = await postJournalEntry({
                            description: `${data.type === "SALE" ? "Penjualan" : data.type === "WRITE_OFF" ? "Hapus buku" : "Penghapusan"} aset ${asset.name} (${asset.assetCode})`,
                            date: movementDate,
                            reference: `FA-${data.type}-${asset.assetCode}`,
                            lines: glLines,
                        })
                        if (glResult?.success && (glResult as any).id) {
                            journalEntryId = (glResult as any).id
                        } else {
                            throw new Error(`Jurnal pelepasan aset gagal: ${(glResult as any)?.error || 'Unknown error'}`)
                        }
                    }
                }

                newStatus = data.type === "SALE" ? "SOLD" : data.type === "WRITE_OFF" ? "WRITTEN_OFF" : "DISPOSED"
                await prisma.fixedAsset.update({
                    where: { id: data.assetId },
                    data: { status: newStatus as any },
                })
            }

            const movement = await prisma.fixedAssetMovement.create({
                data: {
                    assetId: data.assetId,
                    type: data.type,
                    date: movementDate,
                    proceeds: data.proceeds,
                    gainLoss,
                    fromLocation: data.type === "TRANSFER" ? asset.location : null,
                    fromDepartment: data.type === "TRANSFER" ? asset.department : null,
                    toLocation: data.toLocation,
                    toDepartment: data.toDepartment,
                    notes: data.notes,
                    journalEntryId,
                    executedBy: userId,
                },
            })

            await prisma.auditLog.create({
                data: {
                    entityType: "FixedAssetMovement",
                    entityId: movement.id,
                    action: "CREATE",
                    userId,
                    narrative: `Pergerakan aset: ${data.type} - ${asset.name} (${asset.assetCode})`,
                },
            })

            return { success: true, movement }
        })
    } catch (error) {
        console.error("Failed to create asset movement:", error)
        return { success: false, error: "Gagal mencatat pergerakan aset" }
    }
}

// ============================================================
// REPORTS
// ============================================================

export async function getAssetRegisterReport() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const assets = await prisma.fixedAsset.findMany({
                include: {
                    category: { select: { name: true, code: true } },
                    supplier: { select: { name: true } },
                },
                orderBy: [{ category: { code: "asc" } }, { assetCode: "asc" }],
            })
            return { success: true, assets }
        })
    } catch (error) {
        console.error("Failed to generate asset register report:", error)
        return { success: false, assets: [] }
    }
}

export async function getDepreciationScheduleReport(assetId?: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where: Prisma.FixedAssetDeprecScheduleWhereInput = {}
            if (assetId) where.assetId = assetId

            const schedules = await prisma.fixedAssetDeprecSchedule.findMany({
                where,
                include: {
                    asset: { select: { assetCode: true, name: true, purchaseCost: true, residualValue: true } },
                },
                orderBy: [{ asset: { assetCode: "asc" } }, { periodNo: "asc" }],
            })
            return { success: true, schedules }
        })
    } catch (error) {
        console.error("Failed to generate depreciation schedule report:", error)
        return { success: false, schedules: [] }
    }
}

export async function getAssetMovementReport(startDate?: string, endDate?: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where: Prisma.FixedAssetMovementWhereInput = {}
            if (startDate || endDate) {
                where.date = {}
                if (startDate) where.date.gte = new Date(startDate)
                if (endDate) where.date.lte = new Date(endDate)
            }
            const movements = await prisma.fixedAssetMovement.findMany({
                where,
                include: {
                    asset: { select: { assetCode: true, name: true, purchaseCost: true } },
                },
                orderBy: { date: "desc" },
            })
            return { success: true, movements }
        })
    } catch (error) {
        console.error("Failed to generate asset movement report:", error)
        return { success: false, movements: [] }
    }
}

export async function getNetBookValueSummary() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const assets = await prisma.fixedAsset.findMany({
                where: { status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] } },
                include: { category: { select: { id: true, name: true, code: true } } },
                orderBy: { category: { code: "asc" } },
            })

            // Group by category
            const byCategory: Record<string, { name: string; totalCost: number; totalAccDep: number; totalNBV: number; count: number }> = {}
            for (const a of assets) {
                const key = a.category.id
                if (!byCategory[key]) {
                    byCategory[key] = { name: a.category.name, totalCost: 0, totalAccDep: 0, totalNBV: 0, count: 0 }
                }
                byCategory[key].totalCost += Number(a.purchaseCost)
                byCategory[key].totalAccDep += Number(a.accumulatedDepreciation)
                byCategory[key].totalNBV += Number(a.netBookValue)
                byCategory[key].count++
            }

            return { success: true, summary: Object.values(byCategory), assets }
        })
    } catch (error) {
        console.error("Failed to generate NBV summary:", error)
        return { success: false, summary: [], assets: [] }
    }
}

// ============================================================
// GL ACCOUNTS HELPER (for dropdowns)
// ============================================================

export async function getGLAccountsForFixedAssets() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                select: { id: true, code: true, name: true, type: true },
                orderBy: { code: "asc" },
            })
            return { success: true, accounts }
        })
    } catch (error) {
        console.error("Failed to fetch GL accounts:", error)
        return { success: false, accounts: [] }
    }
}

export async function getSuppliersForFixedAssets() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const suppliers = await prisma.supplier.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true },
                orderBy: { name: "asc" },
            })
            return { success: true, suppliers }
        })
    } catch (error) {
        console.error("Failed to fetch suppliers:", error)
        return { success: false, suppliers: [] }
    }
}
