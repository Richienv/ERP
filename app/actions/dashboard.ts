'use server'

import { withPrismaAuth, safeQuery, withRetry } from "@/lib/db"
import { getFinancialMetrics } from "@/lib/actions/finance"
import { PrismaClient } from "@prisma/client"
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

// ==============================================================================
// INTERNAL FETCHERS (Accepts Prisma Client / Transaction)
// ==============================================================================

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

async function fetchSnapshot(prisma: PrismaClient) {
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

async function fetchFinancialChartData(prisma: PrismaClient) {
    const today = startOfDay(new Date())
    const start7d = addDays(today, -6)
    const start6m = new Date(today)
    start6m.setMonth(start6m.getMonth() - 4)
    start6m.setDate(1)
    start6m.setHours(0, 0, 0, 0)

    const [cashAccounts, journalLines, arInvoices, apInvoices] = await Promise.all([
        // Query all ASSET accounts starting with '1' (cash/bank accounts)
        prisma.gLAccount.findMany({
            where: { type: 'ASSET', code: { startsWith: '1' } },
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
            bucket.rev += Number(jl.credit) - Number(jl.debit)
        } else if (jl.account.type === 'EXPENSE') {
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

    return { dataCash7d, dataReceivables, dataPayables, dataProfit }
}

async function fetchDeadStockValue(prisma: PrismaClient) {
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
}

async function fetchProcurementMetrics(prisma: PrismaClient) {
    // Run all queries in parallel for speed
    const [activePO, delayedPOs, pendingApprovalPOs, totalPRs, pendingPRs, poSummary, poByStatusRaw] = await Promise.all([
        prisma.purchaseOrder.count({
            where: { status: { in: ['PO_DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED'] } }
        }),
        prisma.purchaseOrder.findMany({
            where: {
                status: { notIn: ['RECEIVED', 'COMPLETED', 'CANCELLED'] },
                expectedDate: { lt: new Date() }
            },
            include: { supplier: true, items: { include: { product: true } } },
            take: 5
        }),
        prisma.purchaseOrder.findMany({
            where: { status: 'PENDING_APPROVAL' },
            include: {
                supplier: { select: { name: true, email: true, phone: true } },
                items: { include: { product: { select: { name: true, code: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        // PR counts for CEO visibility
        prisma.purchaseRequest.count(),
        prisma.purchaseRequest.count({ where: { status: 'PENDING' } }),
        // PO total value (non-cancelled)
        prisma.purchaseOrder.aggregate({
            _sum: { totalAmount: true },
            _count: true,
            where: { status: { notIn: ['CANCELLED'] } }
        }),
        // PO breakdown by status
        prisma.purchaseOrder.groupBy({
            by: ['status'],
            _count: true,
            where: { status: { notIn: ['CANCELLED'] } }
        }),
    ])

    const poByStatus: Record<string, number> = {}
    for (const g of poByStatusRaw) {
        poByStatus[g.status] = g._count
    }

    return {
        activeCount: activePO,
        totalPRs,
        pendingPRs,
        totalPOs: poSummary._count,
        totalPOValue: Number(poSummary._sum?.totalAmount ?? 0),
        poByStatus,
        delays: delayedPOs.map(po => ({
            id: po.id,
            number: po.number,
            supplierName: po.supplier.name,
            productName: po.items[0]?.product.name || 'Materials',
            daysLate: Math.floor((new Date().getTime() - (po.expectedDate?.getTime() || 0)) / (1000 * 3600 * 24))
        })),
        pendingApproval: pendingApprovalPOs.map(po => ({
            id: po.id,
            number: po.number,
            supplier: {
                name: po.supplier.name,
                email: po.supplier.email,
                phone: po.supplier.phone
            },
            totalAmount: Number(po.totalAmount || 0),
            netAmount: Number(po.netAmount || 0),
            itemCount: po.items.length,
            items: po.items.map(item => ({
                productName: item.product.name,
                productCode: item.product.code,
                quantity: item.quantity
            }))
        }))
    }
}

async function fetchHRMetrics(prisma: PrismaClient) {
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
}

async function fetchPendingLeaves(prisma: PrismaClient) {
    return await prisma.leaveRequest.count({
        where: { status: 'PENDING' }
    })
}

async function fetchAuditStatus(prisma: PrismaClient) {
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
}

async function fetchProductionMetrics(prisma: PrismaClient) {
    // Count both PLANNED and IN_PROGRESS work orders as "active"
    const activeWOs = await prisma.workOrder.count({
        where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } }
    })

    const snapshot = await prisma.executiveSnapshot.findFirst({ orderBy: { date: 'desc' } })

    // Also get total completed this month for production count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const completedThisMonth = await prisma.workOrder.aggregate({
        _sum: { actualQty: true },
        where: {
            status: { in: ['COMPLETED', 'IN_PROGRESS'] },
            startDate: { gte: startOfMonth }
        }
    })

    return {
        activeWorkOrders: activeWOs,
        totalProduction: snapshot?.totalProduction || completedThisMonth._sum?.actualQty || 0,
        efficiency: snapshot?.avgEfficiency?.toNumber() || 0
    }
}

async function fetchProductionStatus(prisma: PrismaClient) {
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
            progress: wo ? Math.min(100, Math.round((wo.actualQty / wo.plannedQty) * 100)) : 0,
            status: statusLabel,
            supervisor: '-',
            eta: wo?.dueDate ? wo.dueDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'
        }
    })
}

async function fetchMaterialStatus(prisma: PrismaClient) {
    const products = await prisma.product.findMany({
        where: { isActive: true },
        include: {
            stockLevels: {
                include: { warehouse: { select: { name: true, code: true, isActive: true } } }
            }
        },
        take: 200
    })

    const withStock = products.map(p => {
        const activeStockLevels = p.stockLevels.filter(sl => sl.warehouse.isActive)
        const totalStock = activeStockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
        // Use minStock if explicitly set (> 0), otherwise use a reasonable threshold:
        // For products that have stock, use 10% of total as threshold; else just 1
        const threshold = p.minStock > 0 ? p.minStock : Math.max(1, Math.ceil(totalStock * 0.1))

        return {
            ...p,
            totalStock,
            threshold,
            warehouseBreakdown: activeStockLevels.map(sl => ({
                warehouse: sl.warehouse.name,
                code: sl.warehouse.code,
                qty: sl.quantity
            }))
        }
    })

    // Filter low stock: products where totalStock <= threshold AND totalStock > 0
    // Plus all out-of-stock (totalStock = 0) that have at least one stockLevel record
    const lowStock = withStock
        .filter(p => {
            if (p.totalStock === 0 && p.stockLevels.length > 0) return true  // Out of stock
            if (p.minStock > 0 && p.totalStock <= p.minStock) return true     // Below explicit minStock
            return false
        })
        .sort((a, b) => a.totalStock - b.totalStock)
        .slice(0, 10)

    return lowStock.map(p => ({
        id: p.id,
        name: p.name,
        stockLevel: p.totalStock,
        minStock: p.minStock,
        unit: p.unit,
        status: p.totalStock === 0 ? 'critical' : 'warning',
        warehouseBreakdown: p.warehouseBreakdown
    }))
}

async function fetchQualityStatus(prisma: PrismaClient) {
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
        orderBy: { inspectionDate: 'desc' },
        select: { status: true }
    })
    const passed = last20.filter(i => i.status === 'PASS').length
    // If no inspections exist, return -1 to signal "no data" (different from 0%)
    const passRate = last20.length > 0 ? Number(((passed / last20.length) * 100).toFixed(1)) : -1

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
        totalInspections: last20.length,
        recentInspections: enrichedInspections
    }
}

async function fetchWorkforceStatus(prisma: PrismaClient) {
    // Count employees by status — include ACTIVE and ON_LEAVE
    const [activeCount, onLeaveCount, totalAll] = await Promise.all([
        prisma.employee.count({ where: { status: 'ACTIVE' } }),
        prisma.employee.count({ where: { status: 'ON_LEAVE' } }),
        prisma.employee.count({ where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } } })
    ])

    // Use totalAll as staff count (all non-terminated, non-inactive)
    const total = totalAll > 0 ? totalAll : activeCount

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const attendance = await prisma.attendance.findMany({
        where: { date: { gte: today } },
        include: { employee: true }
    })

    const present = attendance.length
    const late = attendance.filter(a => a.isLate).length

    // If no attendance records for today, check if it's a non-working day or no check-ins yet
    // Show meaningful rate: if total > 0 but no attendance, rate is 0 but still show staff count

    const topEmployeesRaw = await prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
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
        const status = att ? (att.isLate ? 'Late' : 'Present') :
            emp.status === 'ON_LEAVE' ? 'On Leave' : 'Absent'

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
}

async function fetchActivityFeed(prisma: PrismaClient) {
    const [invoices, movements, employees, purchaseOrders, salesOrders] = await Promise.all([
        prisma.invoice.findMany({
            take: 3,
            orderBy: { issueDate: 'desc' },
            include: { customer: { select: { name: true } }, supplier: { select: { name: true } } }
        }),
        prisma.inventoryTransaction.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: { product: true, warehouse: { select: { name: true } } }
        }),
        prisma.employee.findMany({ take: 2, orderBy: { joinDate: 'desc' } }),
        prisma.purchaseOrder.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: { supplier: { select: { name: true } } }
        }),
        prisma.salesOrder.findMany({
            take: 3,
            orderBy: { orderDate: 'desc' },
            include: { customer: { select: { name: true } } }
        })
    ])

    const activities = [
        ...invoices.map(i => ({
            id: `inv-${i.id}`,
            type: 'invoice' as const,
            title: `Invoice ${i.number}`,
            description: i.type === 'INV_OUT'
                ? `Faktur ke ${i.customer?.name || 'pelanggan'}`
                : `Tagihan dari ${i.supplier?.name || 'vendor'}`,
            timestamp: i.issueDate.toISOString(),
            user: 'Finance'
        })),
        ...movements.map(m => {
            const isInbound = ['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN'].includes(m.type)
            const typeLabel = isInbound ? 'Masuk' : 'Keluar'
            return {
                id: `tx-${m.id}`,
                type: 'inventory' as const,
                title: `${typeLabel} ${m.product.name}`,
                description: `${m.quantity} ${m.product.unit || 'pcs'} @ ${m.warehouse?.name || 'Gudang'}`,
                timestamp: m.createdAt.toISOString(),
                user: m.performedBy || 'Warehouse'
            }
        }),
        ...employees.map(e => ({
            id: `emp-${e.id}`,
            type: 'hire' as const,
            title: `Karyawan Baru`,
            description: `${e.firstName} ${e.lastName || ''} - ${e.department}`,
            timestamp: e.joinDate.toISOString(),
            user: 'HR'
        })),
        ...purchaseOrders.map(po => ({
            id: `po-${po.id}`,
            type: 'procurement' as const,
            title: `PO ${po.number}`,
            description: `${po.supplier.name} - ${po.status.replace(/_/g, ' ').toLowerCase()}`,
            timestamp: po.createdAt.toISOString(),
            user: 'Procurement'
        })),
        ...salesOrders.map(so => ({
            id: `so-${so.id}`,
            type: 'sales' as const,
            title: `SO ${so.number}`,
            description: `${so.customer.name} - ${so.status.toLowerCase()}`,
            timestamp: so.orderDate.toISOString(),
            user: 'Sales'
        }))
    ]

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
}

async function fetchExecutiveAlerts(prisma: PrismaClient) {
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
}


async function fetchTotalInventoryValue(prisma: PrismaClient) {
    const stockLevels = await prisma.stockLevel.findMany({
        include: {
            product: { select: { costPrice: true, sellingPrice: true, isActive: true, name: true } },
            warehouse: { select: { id: true, name: true, code: true, isActive: true } }
        }
    })
    let value = 0
    let itemCount = 0
    const warehouseMap = new Map<string, { name: string; code: string; value: number; itemCount: number; productCount: number }>()

    for (const sl of stockLevels) {
        if (!sl.product.isActive || sl.quantity <= 0) continue
        if (!sl.warehouse.isActive) continue

        // Use costPrice if set, otherwise fall back to sellingPrice
        const costPrice = Number(sl.product.costPrice)
        const sellingPrice = Number(sl.product.sellingPrice)
        const unitPrice = costPrice > 0 ? costPrice : sellingPrice

        const lineValue = sl.quantity * unitPrice
        value += lineValue
        itemCount += sl.quantity

        // Aggregate per warehouse
        const whKey = sl.warehouse.id
        const existing = warehouseMap.get(whKey)
        if (existing) {
            existing.value += lineValue
            existing.itemCount += sl.quantity
            existing.productCount += 1
        } else {
            warehouseMap.set(whKey, {
                name: sl.warehouse.name,
                code: sl.warehouse.code,
                value: lineValue,
                itemCount: sl.quantity,
                productCount: 1
            })
        }
    }

    const warehouses = Array.from(warehouseMap.values())
        .sort((a, b) => b.value - a.value)

    return { value, itemCount, warehouses }
}

// ==============================================================================
// PUBLIC AGGREGATED ACTION (Fetch Everything in One Transaction)
// ==============================================================================

export async function getDashboardData() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [
                financialChart,
                deadStock,
                procurement,
                hr,
                leaves,
                audit,
                prodMetrics,
                prodStatus,
                materialStatus,
                qualityStatus,
                workforceStatus,
                activityFeed,
                executiveAlerts,
                inventoryValue
            ] = await Promise.all([
                fetchFinancialChartData(prisma).catch(() => ({ dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] })),
                fetchDeadStockValue(prisma).catch(() => 0),
                fetchProcurementMetrics(prisma).catch(() => ({ activeCount: 0, delays: [] as any[], pendingApproval: [] as any[], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} as Record<string, number> })),
                fetchHRMetrics(prisma).catch(() => ({ totalSalary: 0, lateEmployees: [] })),
                fetchPendingLeaves(prisma).catch(() => 0),
                fetchAuditStatus(prisma).catch(() => null),
                fetchProductionMetrics(prisma).catch(() => ({ activeWorkOrders: 0, totalProduction: 0, efficiency: 0 })),
                fetchProductionStatus(prisma).catch(() => []),
                fetchMaterialStatus(prisma).catch(() => []),
                fetchQualityStatus(prisma).catch(() => ({ passRate: -1, totalInspections: 0, recentInspections: [] })),
                fetchWorkforceStatus(prisma).catch(() => ({ attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] })),
                fetchActivityFeed(prisma).catch(() => []),
                fetchExecutiveAlerts(prisma).catch(() => []),
                fetchTotalInventoryValue(prisma).catch(() => ({ value: 0, itemCount: 0 }))
            ])

            return {
                financialChart,
                deadStock,
                procurement,
                hr,
                leaves,
                audit,
                prodMetrics,
                prodStatus,
                materialStatus,
                qualityStatus,
                workforceStatus,
                activityFeed,
                executiveAlerts,
                inventoryValue
            }
        }, { maxWait: 15000, timeout: 20000 })
    } catch (error) {
        console.error("Failed to fetch dashboard aggregated data:", error)
        // Ensure graceful fallback structure matches expected return
        return {
            financialChart: { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] },
            deadStock: 0,
            procurement: { activeCount: 0, delays: [] as any[], pendingApproval: [] as any[], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} as Record<string, number> },
            hr: { totalSalary: 0, lateEmployees: [] },
            leaves: 0,
            audit: null,
            prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
            prodStatus: [],
            materialStatus: [],
            qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
            workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
            activityFeed: [],
            executiveAlerts: [],
            inventoryValue: { value: 0, itemCount: 0 }
        }
    }
}


// ==============================================================================
// STREAMING-FRIENDLY GROUP FETCHERS
// Each group opens its own lightweight transaction so React can stream them
// ==============================================================================

/** Group A: Financial snapshot — uses Supabase directly (no Prisma tx needed) */
export async function getDashboardFinancials() {
    try {
        const metrics = await getFinancialMetrics()
        return {
            cashBalance: metrics.cashBalance,
            revenue: metrics.revenue,
            netMargin: metrics.netMargin,
            burnRate: metrics.burnRate,
            receivables: metrics.receivables,
            payables: metrics.payables,
            overdueInvoices: metrics.overdueInvoices,
            upcomingPayables: metrics.upcomingPayables,
        }
    } catch (error) {
        console.error("getDashboardFinancials failed:", error)
        return {
            cashBalance: 0, revenue: 0, netMargin: 0, burnRate: 0,
            receivables: 0, payables: 0, overdueInvoices: [], upcomingPayables: [],
        }
    }
}

/** Group B: Operations data (Prisma) — procurement, production, inventory, workforce */
export async function getDashboardOperations() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [procurement, prodMetrics, materialStatus, qualityStatus, workforceStatus, leaves, inventoryValue] = await Promise.all([
                fetchProcurementMetrics(prisma).catch(() => ({ activeCount: 0, delays: [] as any[], pendingApproval: [] as any[], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} as Record<string, number> })),
                fetchProductionMetrics(prisma).catch(() => ({ activeWorkOrders: 0, totalProduction: 0, efficiency: 0 })),
                fetchMaterialStatus(prisma).catch(() => []),
                fetchQualityStatus(prisma).catch(() => ({ passRate: -1, totalInspections: 0, recentInspections: [] })),
                fetchWorkforceStatus(prisma).catch(() => ({ attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] })),
                fetchPendingLeaves(prisma).catch(() => 0),
                fetchTotalInventoryValue(prisma).catch(() => ({ value: 0, itemCount: 0, warehouses: [] })),
            ])
            return { procurement, prodMetrics, materialStatus, qualityStatus, workforceStatus, leaves, inventoryValue }
        }, { maxWait: 5000, timeout: 8000 })
    } catch (error) {
        console.error("getDashboardOperations failed:", error)
        return {
            procurement: { activeCount: 0, delays: [] as any[], pendingApproval: [] as any[], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} as Record<string, number> },
            prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
            materialStatus: [],
            qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
            workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
            leaves: 0,
            inventoryValue: { value: 0, itemCount: 0, warehouses: [] },
        }
    }
}

/** Group C: Activity feed + alerts (Prisma, lightweight) */
export async function getDashboardActivity() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [activityFeed, executiveAlerts] = await Promise.all([
                fetchActivityFeed(prisma).catch(() => []),
                fetchExecutiveAlerts(prisma).catch(() => []),
            ])
            return { activityFeed, executiveAlerts }
        }, { maxWait: 5000, timeout: 8000 })
    } catch (error) {
        console.error("getDashboardActivity failed:", error)
        return { activityFeed: [], executiveAlerts: [] }
    }
}

/** Group D: Chart data (Prisma, separate so it doesn't block operations) */
export async function getDashboardCharts() {
    try {
        return await withPrismaAuth(async (prisma) => {
            return fetchFinancialChartData(prisma)
        }, { maxWait: 5000, timeout: 8000 })
    } catch (error) {
        console.error("getDashboardCharts failed:", error)
        return { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] }
    }
}

// ==============================================================================
// PUBLIC INDIVIDUAL ACTIONS (Fallback / Backward Compatibility)
// ==============================================================================

export async function getLatestSnapshot() {
    return fetchSnapshot({} as any) // Assuming fetchSnapshot doesn't actually use prisma, or we refactor getFinancialMetrics
}

export async function getFinancialChartData() {
    try {
        return await withPrismaAuth(async (prisma) => fetchFinancialChartData(prisma))
    } catch (error) {
        console.error("Failed to fetch financial chart data:", error)
        return { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] }
    }
}

export async function getDeadStockValue() {
    try {
        return await withPrismaAuth(async (prisma) => fetchDeadStockValue(prisma))
    } catch (error) {
        console.error("Failed to compute dead stock value:", error)
        return 0
    }
}

export async function getProcurementMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => fetchProcurementMetrics(prisma))
    } catch (error) {
        console.error("Failed to fetch procurement metrics:", error)
        return { activeCount: 0, delays: [] }
    }
}

export async function getHRMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => fetchHRMetrics(prisma))
    } catch (error) {
        console.error("Failed to fetch HR metrics:", error)
        return { totalSalary: 0, lateEmployees: [] }
    }
}

export async function getPendingLeaves() {
    try {
        return await withPrismaAuth(async (prisma) => fetchPendingLeaves(prisma))
    } catch (error) {
        console.error("Failed to fetch pending leaves:", error)
        return 0
    }
}

export async function getAuditStatus() {
    try {
        return await withPrismaAuth(async (prisma) => fetchAuditStatus(prisma))
    } catch (error) {
        console.error("Failed to fetch audit status:", error)
        return null
    }
}

export async function getProductionMetrics() {
    try {
        return await withPrismaAuth(async (prisma) => fetchProductionMetrics(prisma))
    } catch (error) {
        console.error("Failed to fetch production metrics:", error)
        return { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 }
    }
}

export async function getProductionStatus() {
    try {
        return await withPrismaAuth(async (prisma) => fetchProductionStatus(prisma))
    } catch (error) {
        console.error("Failed to fetch production status:", error)
        return []
    }
}

export async function getMaterialStatus() {
    try {
        return await withPrismaAuth(async (prisma) => fetchMaterialStatus(prisma))
    } catch (error) {
        console.error("Failed to fetch material status:", error)
        return []
    }
}

export async function getQualityStatus() {
    try {
        return await withPrismaAuth(async (prisma) => fetchQualityStatus(prisma))
    } catch (error) {
        console.error("Failed to fetch quality status:", error)
        return { passRate: 0, recentInspections: [] }
    }
}

export async function getWorkforceStatus() {
    try {
        return await withPrismaAuth(async (prisma) => fetchWorkforceStatus(prisma))
    } catch (error) {
        console.error("Failed to fetch workforce status:", error)
        return { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] }
    }
}

export async function getActivityFeed() {
    try {
        return await withPrismaAuth(async (prisma) => fetchActivityFeed(prisma))
    } catch (error) {
        console.error("Failed to fetch activity feed:", error)
        return []
    }
}

export async function getExecutiveAlerts() {
    try {
        return await withPrismaAuth(async (prisma) => fetchExecutiveAlerts(prisma))
    } catch (error) {
        console.error("Failed to fetch executive alerts:", error)
        return []
    }
}
