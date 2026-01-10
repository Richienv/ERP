"use client"

import { OperationsDashboard } from "@/components/manager/operations-dashboard"
import { ProductionLineStatus } from "@/components/manager/production-line-status"
import { ManagerTaskBoard } from "@/components/manager/task-board"
import { MaterialTrackingCard } from "@/components/manager/material-tracking-card"
import { StaffTrackingCard } from "@/components/manager/staff-tracking-card"
import { QualityTrackingCard } from "@/components/manager/quality-tracking-card" // NEW

export default function ManagerPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">
                    Factory Command Center
                </h1>
                <p className="text-muted-foreground mt-1">
                    Live Operations Control & Accountability System
                </p>
            </div>

            {/* 1. Operations Dashboard (God Mode Metrics) */}
            <OperationsDashboard />

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* 2. Live Production Status */}
                <div className="col-span-1">
                    <ProductionLineStatus />
                </div>

                {/* 3. New Staff Activity Tracker */}
                <div className="col-span-1">
                    <StaffTrackingCard />
                </div>

                {/* 4. Tracking Bahan Baku */}
                <div className="col-span-1">
                    <MaterialTrackingCard />
                </div>

                {/* 5. Quality Control */}
                <div className="col-span-1">
                    <QualityTrackingCard />
                </div>
            </div>

            {/* 4. Task Management Center */}
            <ManagerTaskBoard />

        </div>
    )
}
