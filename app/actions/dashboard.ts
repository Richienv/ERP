'use server'

import { withPrismaAuth, safeQuery, withRetry } from "@/lib/db"
import { getFinancialMetrics } from "@/lib/actions/finance"
import { 
    FALLBACK_DASHBOARD_SNAPSHOT,
    FALLBACK_PROCUREMENT_METRICS,
    FALLBACK_HR_METRICS,
    FALLBACK_PRODUCTION_METRICS,
    FALLBACK_PRODUCTION_STATUS,
    FALLBACK_MATERIAL_STATUS,
    FALLBACK_QUALITY_STATUS,
    FALLBACK_WORKFORCE_STATUS,
    FALLBACK_ACTIVITY_FEED,
    FALLBACK_EXECUTIVE_ALERTS
} from "@/lib/db-fallbacks"

export async function getLatestSnapshot() {
    try {
        const metrics = await getFinancialMetrics()
        return {
            totalRevenue: metrics.revenue,
            totalCost: 0,
            netProfit: metrics.netMargin,
            cashBalance: metrics.cashBalance,
            accountsReceivable: metrics.receivables,
            accountsPayable: metrics.payables,
            burnRate: metrics.burnRate,
            overdueInvoices: metrics.overdueInvoices,
            upcomingPayables: metrics.upcomingPayables,
            activeHeadcount: 0,
            avgEfficiency: 0,
        }
    } catch (error) {
        console.error("Failed to fetch dashboard snapshot:", error)
        return null
    }
}

function startOfDay(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

function addDays(date: Date, days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function getFinancialChartData() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const today = startOfDay(new Date())
            const start7d = addDays(today, -6)
            const start6m = new Date(today)
            start6m.setMonth(start6m.getMonth() - 4)
            start6m.setDate(1)
            start6m.setHours(0, 0, 0, 0)

            const [cashAccounts, journalLines, arInvoices, apInvoices] = await Promise.all([
                prisma.gLAccount.findMany({
                    where: { code: { in: ['1101', '1102'] } },
                    select: { id: true, code: true, type: true, balance: true }
                }),
                prisma.journalLine.findMany({
                    where: {
                        entry: {
                            status: 'POSTED',
                            date: { gte: start6m, lte: addDays(today, 1) }
                        }
                    },
                    select: {
                        debit: true,
                        credit: true,
                        account: { select: { id: true, code: true, type: true } },
                        entry: { select: { date: true } }
                    }
                }),
                prisma.invoice.findMany({
                    where: {
                        type: 'INV_OUT',
                        balanceDue: { gt: 0 },
                        status: { notIn: ['PAID', 'VOID', 'CANCELLED'] }
                    },
                    select: { dueDate: true, balanceDue: true }
                }),
                prisma.invoice.findMany({
                    where: {
                        type: 'INV_IN',
                        balanceDue: { gt: 0 },
                        status: { notIn: ['PAID', 'VOID', 'CANCELLED'] }
                    },
                    select: { dueDate: true, balanceDue: true }
                }),
            ])

            const cashAccountIds = new Set(cashAccounts.map(a => a.id))
            const cashStartingBalance = cashAccounts.reduce((sum, a) => sum + Number(a.balance), 0)

            const cashDailyDelta = new Map<string, number>()
            for (const jl of journalLines) {
                if (!cashAccountIds.has(jl.account.id)) continue
                const day = startOfDay(jl.entry.date)
                const key = day.toISOString().slice(0, 10)

                // Cash accounts are ASSET; increase = debit-credit
                const delta = Number(jl.debit) - Number(jl.credit)
                cashDailyDelta.set(key, (cashDailyDelta.get(key) || 0) + delta)
            }

            const dataCash7d: Array<{ name: string; val: number }> = []
            // Build running series from start7d..today using current balance as anchor
            // We back-calculate opening balance by subtracting deltas from start7d..today
            let sumDelta = 0
            for (let i = 0; i < 7; i++) {
                const d = addDays(start7d, i)
                const key = d.toISOString().slice(0, 10)
                sumDelta += cashDailyDelta.get(key) || 0
            }
            let running = cashStartingBalance - sumDelta
            for (let i = 0; i < 7; i++) {
                const d = addDays(start7d, i)
                const key = d.toISOString().slice(0, 10)
                running += cashDailyDelta.get(key) || 0
                dataCash7d.push({
                    name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    val: Number((running / 1_000_000).toFixed(2))
                })
            }

            const bucketInvoices = (invoices: Array<{ dueDate: Date; balanceDue: any }>, buckets: Array<{ name: string; from: number; to?: number }>) => {
                const out = buckets.map(b => ({ name: b.name, val: 0 }))
                for (const inv of invoices) {
                    const days = Math.floor((today.getTime() - startOfDay(inv.dueDate).getTime()) / (1000 * 3600 * 24))
                    // days <= 0 means not overdue
                    for (let i = 0; i < buckets.length; i++) {
                        const b = buckets[i]
                        const inRange = days >= b.from && (b.to === undefined ? true : days <= b.to)
                        if (inRange) {
                            out[i].val += Number(inv.balanceDue)
                            break
                        }
                    }
                }
                return out.map(x => ({ ...x, val: Number((x.val / 1_000_000).toFixed(2)) }))
            }

            const dataReceivables = bucketInvoices(arInvoices, [
                { name: 'Current', from: -10_000, to: 0 },
                { name: '30-60', from: 1, to: 60 },
                { name: '60-90', from: 61, to: 90 },
                { name: '>90', from: 91 }
            ])

            const dataPayables = bucketInvoices(apInvoices, [
                { name: 'Not Due', from: -10_000, to: 0 },
                { name: 'Due Soon', from: 1, to: 30 },
                { name: 'Overdue', from: 31 }
            ])

            const monthSeries = new Map<string, { rev: number; exp: number }>()
            const months: string[] = []
            for (let i = 4; i >= 0; i--) {
                const d = new Date(today)
                d.setMonth(d.getMonth() - i)
                const key = monthKey(d)
                months.push(key)
                monthSeries.set(key, { rev: 0, exp: 0 })
            }

            for (const jl of journalLines) {
                const key = monthKey(jl.entry.date)
                const bucket = monthSeries.get(key)
                if (!bucket) continue

                if (jl.account.type === 'REVENUE') {
                    // Revenue increases with credit
                    bucket.rev += Number(jl.credit) - Number(jl.debit)
                } else if (jl.account.type === 'EXPENSE') {
                    // Expense increases with debit
                    bucket.exp += Number(jl.debit) - Number(jl.credit)
                }
            }

            const dataProfit = months.map(m => {
                const v = monthSeries.get(m)!
                return {
                    name: m.split('-')[1],
                    rev: Number((v.rev / 1_000_000).toFixed(2)),
                    exp: Number((v.exp / 1_000_000).toFixed(2))
                }
            })

            return {
                dataCash7d,
                dataReceivables,
                dataPayables,
                dataProfit,
            }
        })
    } catch (error) {
        console.error("Failed to fetch financial chart data:", error)
        return {
            dataCash7d: [],
            dataReceivables: [],
            dataPayables: [],
            dataProfit: [],
        }
    }
}

export async function getDeadStockValue() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const cutoff = new Date()
            cutoff.setMonth(cutoff.getMonth() - 6)

            const products = await prisma.product.findMany({
                where: { isActive: true },
                include: {
                    stockLevels: true,
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true }
                    }
                },
                take: 300
            })

            let total = 0
            for (const p of products) {
                const qty = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                if (qty <= 0) continue

                const lastTx = p.transactions[0]?.createdAt
                if (lastTx && lastTx > cutoff) continue

                total += qty * Number(p.costPrice)
            }

            return total
        })
    } catch (error) {
        console.error("Failed to compute dead stock value:", error)
        return 0
    }
}

export async function getProcurementMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const activePO = await prisma.purchaseOrder.count({
                where: { status: { in: ['PO_DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED'] } }
            })

            const delayedPOs = await prisma.purchaseOrder.findMany({
                where: {
                    status: { notIn: ['RECEIVED', 'COMPLETED', 'CANCELLED'] },
                    expectedDate: { lt: new Date() }
                },
                include: { supplier: true, items: { include: { product: true } } },
                take: 5
            })

            return {
                activeCount: activePO,
                delays: delayedPOs.map(po => ({
                    id: po.id,
                    number: po.number,
                    supplierName: po.supplier.name,
                    productName: po.items[0]?.product.name || 'Materials',
                    daysLate: Math.floor((new Date().getTime() - (po.expectedDate?.getTime() || 0)) / (1000 * 3600 * 24))
                }))
            }
        })
    } catch (error) {
        console.error("Failed to fetch procurement metrics:", error)
        return { activeCount: 0, delays: [] }
    }
}

export async function getHRMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const salaryAgg = await prisma.employee.aggregate({
                _sum: { baseSalary: true },
                where: { status: 'ACTIVE' }
            })

            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const lateAttendance = await prisma.attendance.findMany({
                where: {
                    date: { gte: today },
                    isLate: true
                },
                include: { employee: true },
                take: 5
            })

            return {
                totalSalary: salaryAgg._sum.baseSalary?.toNumber() || 0,
                lateEmployees: lateAttendance.map(att => ({
                    id: att.employee.id,
                    name: `${att.employee.firstName} ${att.employee.lastName || ''}`,
                    department: att.employee.department,
                    checkInTime: att.checkIn ? att.checkIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
                }))
            }
        })
    } catch (error) {
        console.error("Failed to fetch HR metrics:", error)
        return { totalSalary: 0, lateEmployees: [] }
    }
}

export async function getPendingLeaves() {
    try {
        return await withPrismaAuth(async (prisma) => {
            return await prisma.leaveRequest.count({
                where: { status: 'PENDING' }
            })
        })
    } catch (error) {
        console.error("Failed to fetch pending leaves:", error)
        return 0
    }
}

export async function getAuditStatus() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const audit = await prisma.stockAudit.findFirst({
                where: { status: 'SCHEDULED' },
                orderBy: { scheduledDate: 'asc' },
                include: { warehouse: true }
            })

            if (!audit) return null

            return {
                date: audit.scheduledDate,
                warehouseName: audit.warehouse.name
            }
        })
    } catch (error) {
        console.error("Failed to fetch audit status:", error)
        return null
    }
}

export async function getProductionMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const activeWOs = await prisma.workOrder.count({
                where: { status: 'IN_PROGRESS' }
            })

            const snapshot = await prisma.executiveSnapshot.findFirst({ orderBy: { date: 'desc' } })

            return {
                activeWorkOrders: activeWOs,
                totalProduction: snapshot?.totalProduction || 0,
                efficiency: snapshot?.avgEfficiency?.toNumber() || 0
            }
        })
    } catch (error) {
        console.error("Failed to fetch production metrics:", error)
        return { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 }
    }
}

export async function getProductionStatus() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const machines = await prisma.machine.findMany({
                orderBy: { name: 'asc' },
                take: 6,
                include: {
                    workOrders: {
                        where: { status: 'IN_PROGRESS' },
                        orderBy: { startDate: 'desc' },
                        take: 1,
                        include: { product: true }
                    }
                }
            })

            return machines.map(m => {
                const wo = m.workOrders[0]
                const statusLabel = m.status === 'RUNNING' ? 'Running' :
                    m.status === 'IDLE' ? 'Idle' :
                    m.status === 'BREAKDOWN' ? 'Down' :
                    m.status === 'MAINTENANCE' ? 'Maintenance' : m.status

                return {
                    id: m.code || m.id,
                    name: m.name,
                    job: wo?.number || '-',
                    desc: wo?.product?.name || 'No Active Job',
                    progress: wo ? Math.min(100, Math.round((wo.completedQty / wo.quantity) * 100)) : 0,
                    status: statusLabel,
                    supervisor: '-',
                    eta: wo?.endDate ? wo.endDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'
                }
            })
        })
    } catch (error) {
        console.error("Failed to fetch production status:", error)
        return []
    }
}


// Cached Material Status
export async function getMaterialStatus() {
    try {
        return await withPrismaAuth(async (prisma) => {
                const products = await prisma.product.findMany({
                    where: { isActive: true },
                    include: { stockLevels: true },
                    take: 100
                })

                const withStock = products.map(p => ({
                    ...p,
                    totalStock: p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                }))

                // Filter low stock (e.g., below 100 or minStock)
                const lowStock = withStock
                    .filter(p => p.totalStock <= (p.minStock || 100))
                    .sort((a, b) => a.totalStock - b.totalStock)
                    .slice(0, 5)

                return lowStock.map(p => ({
                    id: p.id,
                    name: p.name,
                    stockLevel: p.totalStock,
                    unit: p.unit,
                    status: p.totalStock === 0 ? 'critical' : 'warning',
                    lastRestock: 'Recently' // Placeholder
                }))
        })
    } catch (error) {
        console.error("Failed to fetch material status:", error)
        return []
    }
}

// Cached Quality Status
export async function getQualityStatus() {
    try {
        return await withPrismaAuth(async (prisma) => {
                const inspections = await prisma.qualityInspection.findMany({
                    orderBy: { inspectionDate: 'desc' },
                    take: 5,
                    include: {
                        material: true,
                        inspector: true,
                        defects: true
                    }
                })

                const last20 = await prisma.qualityInspection.findMany({
                    take: 20,
                    select: { status: true }
                })
                const passed = last20.filter(i => i.status === 'PASS').length
                const passRate = last20.length > 0 ? Number(((passed / last20.length) * 100).toFixed(1)) : 100

                const enrichedInspections = inspections.map(i => ({
                    id: i.id,
                    batch: i.batchNumber,
                    material: i.material.name,
                    inspector: `${i.inspector.firstName.charAt(0)}. ${i.inspector.lastName || ''}`,
                    result: i.status === 'PASS' ? 'Pass' : 'Fail',
                    defectType: i.defects.length > 0 ? i.defects[0].type + ': ' + i.defects[0].description : null,
                    date: i.inspectionDate.toISOString(),
                    score: Number(i.score)
                }))

                return {
                    passRate,
                    recentInspections: enrichedInspections
                }
        })
    } catch (error) {
        console.error("Failed to fetch quality status:", error)
        return { passRate: 0, recentInspections: [] }
    }
}

// Cached Workforce Status
export async function getWorkforceStatus() {
    try {
        return await withPrismaAuth(async (prisma) => {
                const total = await prisma.employee.count({ where: { status: 'ACTIVE' } })
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const attendance = await prisma.attendance.findMany({
                    where: { date: { gte: today } },
                    include: { employee: true }
                })

                const present = attendance.length
                const late = attendance.filter(a => a.isLate).length

                const topEmployeesRaw = await prisma.employee.findMany({
                    where: { status: 'ACTIVE' },
                    orderBy: { baseSalary: 'desc' },
                    take: 5,
                    include: {
                        attendance: {
                            where: { date: { gte: today } }
                        },
                        tasks: {
                            where: { status: { in: ['IN_PROGRESS', 'PENDING'] } },
                            orderBy: { priority: 'desc' },
                            take: 1,
                            include: {
                                purchaseOrder: true,
                                workOrder: true
                            }
                        }
                    }
                })

                const topEmployees = topEmployeesRaw.map(emp => {
                    const att = emp.attendance[0]
                    const status = att ? (att.isLate ? 'Late' : 'Present') : 'Absent'

                    const task = emp.tasks[0]
                    let currentTask = 'Available'

                    if (task) {
                        if (task.purchaseOrder) currentTask = `Review ${task.purchaseOrder.number}`
                        else if (task.workOrder) currentTask = `Monitor ${task.workOrder.number}`
                        else currentTask = task.title
                    }

                    return {
                        id: emp.id,
                        name: `${emp.firstName} ${emp.lastName || ''}`,
                        position: emp.position,
                        department: emp.department,
                        salary: Number(emp.baseSalary),
                        attendance: status,
                        currentTask,
                        checkIn: att?.checkIn ? att.checkIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
                    }
                })

                return {
                    attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
                    presentCount: present,
                    lateCount: late,
                    totalStaff: total,
                    topEmployees
                }
        })
    } catch (error) {
        console.error("Failed to fetch workforce status:", error)
        return { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] }
    }
}

// Cached Activity Feed
export async function getActivityFeed() {
    try {
        return await withPrismaAuth(async (prisma) => {
                const [invoices, movements, employees] = await Promise.all([
                    prisma.invoice.findMany({ take: 3, orderBy: { issueDate: 'desc' } }),
                    prisma.inventoryTransaction.findMany({ take: 3, orderBy: { createdAt: 'desc' }, include: { product: true } }),
                    prisma.employee.findMany({ take: 3, orderBy: { joinDate: 'desc' } })
                ])

                const activities = [
                    ...invoices.map(i => ({
                        id: `inv-${i.id}`,
                        type: 'finance',
                        message: `New Invoice ${i.number}`,
                        time: i.issueDate.toISOString(),
                        user: 'System'
                    })),
                    ...movements.map(m => ({
                        id: `tx-${m.id}`,
                        type: 'inventory',
                        message: `${m.type} ${m.quantity} ${m.product.name}`,
                        time: m.createdAt.toISOString(),
                        user: m.performedBy || 'Warehouse'
                    })),
                    ...employees.map(e => ({
                        id: `emp-${e.id}`,
                        type: 'hr',
                        message: `New Hire: ${e.firstName}`,
                        time: e.joinDate.toISOString(),
                        user: 'HR'
                    }))
                ]

                // Sort by time desc
                return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)
        })
    } catch (error) {
        console.error("Failed to fetch activity feed:", error)
        return []
    }
}

// Cached Executive Alerts
export async function getExecutiveAlerts() {
    try {
        return await withPrismaAuth(async (prisma) => {
                const breakdowns = await prisma.machine.findMany({
                    where: { status: 'BREAKDOWN' },
                    take: 2
                })

                const qcFails = await prisma.qualityInspection.findMany({
                    where: { status: 'FAIL' },
                    orderBy: { inspectionDate: 'desc' },
                    take: 2,
                    include: {
                        material: true,
                        workOrder: true,
                        defects: true,
                    }
                })

                const alerts = [
                    ...breakdowns.map(m => ({
                        id: m.id,
                        type: "Machine Breakdown",
                        title: `${m.name}`,
                        message: "Critical failure reported.",
                        impact: "High",
                        details: "Maintenance team notified.",
                        severity: "critical",
                        machine: m.code
                    })),
                    ...qcFails.map(q => ({
                        id: q.id,
                        type: "Quality Failure",
                        title: q.workOrder?.number ? `WO ${q.workOrder.number}` : `Batch ${q.batchNumber}`,
                        message: `${q.material.name} failed inspection (score ${Number(q.score).toFixed(0)})`,
                        impact: q.defects?.[0]?.type ? String(q.defects[0].type) : "High",
                        details: q.defects?.[0]?.description || q.notes || "Inspection failed",
                        severity: "critical",
                        machine: q.batchNumber
                    }))
                ]

                return alerts.slice(0, 2)
        })
    } catch (error) {
        console.error("Failed to fetch executive alerts:", error)
        return []
    }
}
