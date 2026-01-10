"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

// Import specialized components
// Import specialized components
import { ProductionHealth } from "@/components/manufacturing/dashboard/production-health";
import { PlanningBoard } from "@/components/manufacturing/dashboard/planning-board";
import { DetailedLineStatus } from "@/components/manufacturing/dashboard/detailed-line-status"; // NEW
import { DetailedAlerts } from "@/components/manufacturing/dashboard/detailed-alerts";         // NEW
import { MaterialImpactPanel } from "@/components/manufacturing/dashboard/material-impact";
import { QualityWorkspace } from "@/components/manufacturing/dashboard/quality-workspace";
import { PeopleOverlay } from "@/components/manufacturing/dashboard/people-overlay";
import { AICoachWidget } from "@/components/manufacturing/dashboard/ai-coach";

export default function ManufacturingDashboard() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 min-h-screen bg-zinc-50/50 dark:bg-black">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Control Room Manufaktur</h2>
          <p className="text-muted-foreground">
            Pusat kendali produksi tekstil, perencanaan, dan kualitas.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/manufacturing/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Work Order
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Top Summary: Health Indicators */}
      <ProductionHealth />

      {/* 3. Main Operational Zone (Detailed Lines & Alerts) - Replaces Planning/Material for now as "War Room Detail" */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6 lg:min-h-[500px]">
        {/* Core Detail Board (Takes up 3/4 width) */}
        <div className="lg:col-span-3 min-h-[500px] lg:h-full">
          <DetailedLineStatus />
        </div>

        {/* Detailed Alerts Panel (Side Panel - 1/4 width) */}
        <div className="lg:col-span-1 min-h-[400px] lg:h-full">
          <DetailedAlerts />
        </div>
      </div>

      {/* 3.1 Legacy/Advanced Planning (Below) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6 lg:min-h-[400px]">
        <div className="lg:col-span-3">
          <PlanningBoard />
        </div>
        <div className="lg:col-span-1">
          <MaterialImpactPanel />
        </div>
      </div>

      {/* 4. Bottom Drill-down Panels (Quality, People, AI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quality Card Deck */}
        <div className="h-[300px]">
          <QualityWorkspace />
        </div>

        {/* People & Shift Overlay */}
        <div className="h-[300px]">
          <PeopleOverlay />
        </div>

        {/* AI Coach Panel */}
        <div className="h-[300px]">
          <AICoachWidget />
        </div>
      </div>
    </div>
  );
}