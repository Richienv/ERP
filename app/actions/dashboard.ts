'use server'

import { withPrismaAuth } from "@/lib/db"
import { getFinancialMetrics } from "@/lib/actions/finance"
import { PRStatus, PrismaClient } from "@prisma/client"

const STOCK_OPNAME_PREFIX = "STOCK_OPNAME_REQUEST::"
const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"

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

async function fetchSnapshot(_prisma: PrismaClient) {
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
    const [
        activePO,
        poDraftCount,
        poPendingApprovalCount,
        poApprovedCount,
        poActiveExecutionCount,
        poCompletedCount,
        poRejectedCancelledCount,
        prDraftCount,
        prRequestedCount,
        prApprovedCount,
        prConvertedCount,
        prRejectedCancelledCount,
        delayedPOsRaw,
        pendingApprovalPOsRaw,
        recentPOsRaw,
        recentPRsRaw
    ] = await Promise.all([
        prisma.purchaseOrder.count({
            where: { status: { in: ['PO_DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED'] } }
        }),
        prisma.purchaseOrder.count({ where: { status: 'PO_DRAFT' } }),
        prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
        prisma.purchaseOrder.count({ where: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] } } }),
        prisma.purchaseOrder.count({ where: { status: { in: ['RECEIVED', 'COMPLETED'] } } }),
        prisma.purchaseOrder.count({ where: { status: { in: ['REJECTED', 'CANCELLED'] } } }),
        prisma.purchaseRequest.count({ where: { status: PRStatus.DRAFT } }),
        prisma.purchaseRequest.count({ where: { status: PRStatus.PENDING } }),
        prisma.purchaseRequest.count({ where: { status: PRStatus.APPROVED } }),
        prisma.purchaseRequest.count({ where: { status: PRStatus.PO_CREATED } }),
        prisma.purchaseRequest.count({ where: { status: { in: [PRStatus.REJECTED, PRStatus.CANCELLED] } } }),
        prisma.purchaseOrder.findMany({
            where: {
                status: { notIn: ['RECEIVED', 'COMPLETED', 'CANCELLED'] },
                expectedDate: { lt: new Date() }
            },
            select: { id: true, number: true, expectedDate: true, supplierId: true },
            take: 5
        }),
        prisma.purchaseOrder.findMany({
            where: { status: 'PENDING_APPROVAL' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, number: true, supplierId: true, totalAmount: true, netAmount: true },
            take: 5
        }),
        prisma.purchaseOrder.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, number: true, status: true, supplierId: true, totalAmount: true, netAmount: true, createdAt: true },
            take: 10,
        }),
        prisma.purchaseRequest.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, number: true, status: true, requesterId: true, createdAt: true },
            take: 10,
        })
    ])

    const poIds = [...new Set([...pendingApprovalPOsRaw.map((po) => po.id), ...recentPOsRaw.map((po) => po.id)])]
    const supplierIds = [...new Set([...delayedPOsRaw.map((po) => po.supplierId), ...pendingApprovalPOsRaw.map((po) => po.supplierId), ...recentPOsRaw.map((po) => po.supplierId)])]
    const requesterIds = [...new Set(recentPRsRaw.map((pr) => pr.requesterId))]
    const prIds = [...new Set(recentPRsRaw.map((pr) => pr.id))]

    const [poItems, suppliers, requesters, prItemCounts] = await Promise.all([
        poIds.length > 0
            ? prisma.purchaseOrderItem.findMany({
                where: { purchaseOrderId: { in: poIds } },
                select: { purchaseOrderId: true, productId: true, quantity: true }
            })
            : Promise.resolve([]),
        supplierIds.length > 0
            ? prisma.supplier.findMany({
                where: { id: { in: supplierIds } },
                select: { id: true, name: true, email: true, phone: true }
            })
            : Promise.resolve([]),
        requesterIds.length > 0
            ? prisma.employee.findMany({
                where: { id: { in: requesterIds } },
                select: { id: true, firstName: true, lastName: true }
            })
            : Promise.resolve([]),
        prIds.length > 0
            ? prisma.purchaseRequestItem.groupBy({
                by: ['purchaseRequestId'],
                _count: { _all: true },
                where: { purchaseRequestId: { in: prIds } }
            })
            : Promise.resolve([])
    ])

    const productIds = [...new Set(poItems.map((item) => item.productId))]
    const products = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true }
        })
        : []

    const supplierMap = new Map(suppliers.map((s) => [s.id, s]))
    const requesterMap = new Map(requesters.map((e) => [e.id, e]))
    const productMap = new Map(products.map((p) => [p.id, p]))
    const prItemCountMap = new Map(prItemCounts.map((r) => [r.purchaseRequestId, r._count._all || 0]))
    const itemsByPO = new Map<string, Array<{ productName: string; productCode: string; quantity: number }>>()
    const qtyByPO = new Map<string, number>()

    for (const item of poItems) {
        const product = productMap.get(item.productId)
        const line = {
            productName: product?.name || item.productId,
            productCode: product?.code || "-",
            quantity: Number(item.quantity || 0)
        }
        itemsByPO.set(item.purchaseOrderId, [...(itemsByPO.get(item.purchaseOrderId) || []), line])
        qtyByPO.set(item.purchaseOrderId, (qtyByPO.get(item.purchaseOrderId) || 0) + Number(item.quantity || 0))
    }

    const pendingRequestsCount = prRequestedCount
    const pendingRequests = recentPRsRaw.filter((pr) => pr.status === PRStatus.PENDING).slice(0, 5)

    return {
        activeCount: activePO,
        pendingRequestsCount,
        poStatusSummary: {
            draft: poDraftCount,
            requested: poPendingApprovalCount,
            approved: poApprovedCount,
            active: poActiveExecutionCount,
            completed: poCompletedCount,
            blocked: poRejectedCancelledCount,
        },
        prStatusSummary: {
            draft: prDraftCount,
            requested: prRequestedCount,
            approved: prApprovedCount,
            converted: prConvertedCount,
            blocked: prRejectedCancelledCount,
        },
        delays: delayedPOsRaw.map(po => ({
            id: po.id,
            number: po.number,
            supplierName: supplierMap.get(po.supplierId)?.name || 'Unknown',
            productName: 'Materials',
            daysLate: Math.floor((new Date().getTime() - (po.expectedDate?.getTime() || 0)) / (1000 * 3600 * 24))
        })),
        pendingApproval: pendingApprovalPOsRaw.map(po => ({
            id: po.id,
            number: po.number,
            supplier: {
                name: supplierMap.get(po.supplierId)?.name || 'Unknown',
                email: supplierMap.get(po.supplierId)?.email || null,
                phone: supplierMap.get(po.supplierId)?.phone || null
            },
            totalAmount: Number(po.totalAmount || 0),
            netAmount: Number(po.netAmount || 0),
            itemCount: (itemsByPO.get(po.id) || []).length,
            items: itemsByPO.get(po.id) || []
        })),
        pendingRequests: pendingRequests.map((pr) => ({
            id: pr.id,
            number: pr.number,
            requesterName: `${requesterMap.get(pr.requesterId)?.firstName || ''} ${requesterMap.get(pr.requesterId)?.lastName || ''}`.trim() || '-',
            itemCount: prItemCountMap.get(pr.id) || 0,
            status: pr.status
        })),
        recentPOs: recentPOsRaw.map((po) => ({
            id: po.id,
            number: po.number,
            status: po.status,
            supplierName: supplierMap.get(po.supplierId)?.name || 'Unknown',
            itemQty: qtyByPO.get(po.id) || 0,
            totalAmount: Number(po.netAmount || po.totalAmount || 0),
            date: po.createdAt.toISOString(),
        })),
        recentPRs: recentPRsRaw.map((pr) => ({
            id: pr.id,
            number: pr.number,
            status: pr.status,
            requesterName: `${requesterMap.get(pr.requesterId)?.firstName || ''} ${requesterMap.get(pr.requesterId)?.lastName || ''}`.trim() || '-',
            itemCount: prItemCountMap.get(pr.id) || 0,
            date: pr.createdAt.toISOString(),
        })),
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
    const activeWOs = await prisma.workOrder.count({
        where: { status: 'IN_PROGRESS' }
    })

    const snapshot = await prisma.executiveSnapshot.findFirst({ orderBy: { date: 'desc' } })

    return {
        activeWorkOrders: activeWOs,
        totalProduction: snapshot?.totalProduction || 0,
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
}

async function fetchWorkforceStatus(prisma: PrismaClient) {
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
}

async function fetchActivityFeed(prisma: PrismaClient) {
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

    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)
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

    const [pendingStockOpnameTasks, pendingPayrollTasks] = await Promise.all([
        prisma.employeeTask.count({
            where: {
                status: "PENDING",
                notes: { startsWith: STOCK_OPNAME_PREFIX },
            },
        }),
        prisma.employeeTask.count({
            where: {
                status: "PENDING",
                notes: { startsWith: PAYROLL_RUN_PREFIX },
                relatedId: { startsWith: "PAYROLL-" },
            },
        }),
    ])

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
        })),
        ...(pendingStockOpnameTasks > 0 ? [{
            id: "stock-opname-pending",
            type: "Stock Opname Approval",
            title: `${pendingStockOpnameTasks} adjustment menunggu approval`,
            message: "Permintaan stock opname membutuhkan approval manager/boss.",
            impact: "High",
            details: "Cek modul Gudang > Stock Opname Adjustment.",
            severity: "warning",
            machine: "WAREHOUSE"
        }] : []),
        ...(pendingPayrollTasks > 0 ? [{
            id: "payroll-pending",
            type: "Payroll Approval",
            title: `${pendingPayrollTasks} payroll run pending`,
            message: "Payroll period belum disetujui/disburse.",
            impact: "High",
            details: "Cek SDM > Payroll untuk approval dan batch disbursement.",
            severity: "warning",
            machine: "HR"
        }] : []),
    ]

    return alerts.slice(0, 4)
}

async function fetchSDMApprovalQueue(prisma: PrismaClient) {
    const [pendingLeaves, pendingStockOpname, pendingPayroll] = await Promise.all([
        prisma.leaveRequest.count({ where: { status: "PENDING" } }),
        prisma.employeeTask.count({
            where: {
                status: "PENDING",
                notes: { startsWith: STOCK_OPNAME_PREFIX },
            },
        }),
        prisma.employeeTask.count({
            where: {
                status: "PENDING",
                notes: { startsWith: PAYROLL_RUN_PREFIX },
                relatedId: { startsWith: "PAYROLL-" },
            },
        }),
    ])

    return {
        pendingLeaves,
        pendingStockOpname,
        pendingPayroll,
        totalPending: pendingLeaves + pendingStockOpname + pendingPayroll,
    }
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
                sdmApprovals
            ] = await Promise.all([
                fetchFinancialChartData(prisma).catch(() => ({ dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] })),
                fetchDeadStockValue(prisma).catch(() => 0),
                fetchProcurementMetrics(prisma).catch(() => ({
                    activeCount: 0,
                    pendingRequestsCount: 0,
                    poStatusSummary: { draft: 0, requested: 0, approved: 0, active: 0, completed: 0, blocked: 0 },
                    prStatusSummary: { draft: 0, requested: 0, approved: 0, converted: 0, blocked: 0 },
                    delays: [],
                    pendingApproval: [],
                    pendingRequests: [],
                    recentPOs: [],
                    recentPRs: []
                })),
                fetchHRMetrics(prisma).catch(() => ({ totalSalary: 0, lateEmployees: [] })),
                fetchPendingLeaves(prisma).catch(() => 0),
                fetchAuditStatus(prisma).catch(() => null),
                fetchProductionMetrics(prisma).catch(() => ({ activeWorkOrders: 0, totalProduction: 0, efficiency: 0 })),
                fetchProductionStatus(prisma).catch(() => []),
                fetchMaterialStatus(prisma).catch(() => []),
                fetchQualityStatus(prisma).catch(() => ({ passRate: 0, recentInspections: [] })),
                fetchWorkforceStatus(prisma).catch(() => ({ attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] })),
                fetchActivityFeed(prisma).catch(() => []),
                fetchExecutiveAlerts(prisma).catch(() => []),
                fetchSDMApprovalQueue(prisma).catch(() => ({ pendingLeaves: 0, pendingStockOpname: 0, pendingPayroll: 0, totalPending: 0 }))
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
                sdmApprovals
            }
        }, { maxWait: 15000, timeout: 20000 })
    } catch (error) {
        console.error("Failed to fetch dashboard aggregated data:", error)
        // Ensure graceful fallback structure matches expected return
        return {
            financialChart: { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] },
            deadStock: 0,
            procurement: {
                activeCount: 0,
                pendingRequestsCount: 0,
                poStatusSummary: { draft: 0, requested: 0, approved: 0, active: 0, completed: 0, blocked: 0 },
                prStatusSummary: { draft: 0, requested: 0, approved: 0, converted: 0, blocked: 0 },
                delays: [],
                pendingApproval: [],
                pendingRequests: [],
                recentPOs: [],
                recentPRs: []
            },
            hr: { totalSalary: 0, lateEmployees: [] },
            leaves: 0,
            audit: null,
            prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
            prodStatus: [],
            materialStatus: [],
            qualityStatus: { passRate: 0, recentInspections: [] },
            workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
            activityFeed: [],
            executiveAlerts: [],
            sdmApprovals: { pendingLeaves: 0, pendingStockOpname: 0, pendingPayroll: 0, totalPending: 0 }
        }
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
        return {
            activeCount: 0,
            pendingRequestsCount: 0,
            poStatusSummary: { draft: 0, requested: 0, approved: 0, active: 0, completed: 0, blocked: 0 },
            prStatusSummary: { draft: 0, requested: 0, approved: 0, converted: 0, blocked: 0 },
            delays: [],
            pendingApproval: [],
            pendingRequests: [],
            recentPOs: [],
            recentPRs: []
        }
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
