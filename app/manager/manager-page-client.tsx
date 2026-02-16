"use client"

import { OperationsDashboard } from "@/components/manager/operations-dashboard"
import { ProductionLineStatus } from "@/components/manager/production-line-status"
import { ManagerTaskBoard } from "@/components/manager/task-board"
import { MaterialTrackingCard } from "@/components/manager/material-tracking-card"
import { StaffTrackingCard } from "@/components/manager/staff-tracking-card"
import { QualityTrackingCard } from "@/components/manager/quality-tracking-card"
import type { ManagerTasksData, AssignableEmployee, AssignableOrder, ManagerDashboardStats } from "@/lib/actions/tasks"

interface ManagerPageClientProps {
    tasks: ManagerTasksData
    employees: AssignableEmployee[]
    orders: AssignableOrder[]
    dashboard: ManagerDashboardStats
}

export function ManagerPageClient({ tasks, employees, orders, dashboard }: ManagerPageClientProps) {
    // Transform dashboard data for sub-components
    const productionLineData = dashboard.productionLines.map((wo) => ({
        id: wo.number,
        name: wo.machineName || "Belum ditentukan",
        supervisor: "-",
        job: wo.number,
        desc: wo.product,
        progress: wo.progress,
        status: wo.status === "IN_PROGRESS" ? "Running" : wo.status === "PLANNED" ? "Queued" : wo.status,
        eta: wo.dueDate ? new Date(wo.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-",
    }))

    const materialData = dashboard.materials.map((m) => {
        const ratio = m.minStock > 0 ? m.currentStock / m.minStock : 999
        return {
            id: m.id,
            name: m.name,
            code: m.code,
            stockLevel: m.currentStock,
            unit: m.unit,
            status: ratio < 1 ? "Critical" : ratio < 1.5 ? "Low Stock" : "OK",
            warehouse: "-",
        }
    })

    const staffData = dashboard.staffSummary.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.position,
        status: s.activeTaskCount > 0 ? "active" : "break",
        currentTask: s.status,
        efficiency: "N/A",
        shift: s.department,
        avatar: s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    }))

    const qualityData = {
        passRate: dashboard.quality.passRate,
        recentInspections: dashboard.quality.recentInspections.map((insp) => ({
            id: insp.id,
            batch: insp.batchNumber,
            material: "-",
            result: insp.status === "PASS" ? "Pass" : "Fail",
            score: insp.score,
            inspector: insp.inspectorName,
            defectType: insp.status !== "PASS" ? "Defect terdeteksi" : undefined,
        })),
    }

    return (
        <>
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black uppercase tracking-wider">
                    Pusat Komando Pabrik
                </h1>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Kontrol Operasi & Sistem Akuntabilitas
                </p>
            </div>

            {/* KPI Dashboard */}
            <OperationsDashboard />

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="col-span-1">
                    <ProductionLineStatus data={productionLineData} />
                </div>
                <div className="col-span-1">
                    <StaffTrackingCard data={staffData} />
                </div>
                <div className="col-span-1">
                    <MaterialTrackingCard data={materialData} />
                </div>
                <div className="col-span-1">
                    <QualityTrackingCard data={qualityData} />
                </div>
            </div>

            {/* Task Board */}
            <ManagerTaskBoard tasks={tasks} employees={employees} orders={orders} />
        </>
    )
}
