"use client"

import { useState } from "react"
import { KanbanBoard, KanbanColumn, KanbanTask } from "@/components/ui/trello-kanban-board"
import { MetricCardMini } from "@/components/dashboard/metric-card-mini"
import { Button } from "@/components/ui/button"
import { Plus, Download, Edit } from "lucide-react"
import Link from "next/link"

// Mock data converted for Kanban
// Source status: 'normal', 'low', 'out', 'critical'
const stockColumns: KanbanColumn[] = [
  {
    id: "normal",
    title: "Aman / Normal",
    tasks: [
      {
        id: "1",
        title: "Kain Katun Combed 30s",
        description: "WH-MAT-001 • 20 roll available",
        labels: ["normal"],
        assignee: "25" // Using assignee badge for total Quantity
      }
    ]
  },
  {
    id: "low",
    title: "Menipis / Warning",
    tasks: [
      {
        id: "2",
        title: "Kain Denim Raw 14oz",
        description: "WH-MAT-001 • 6 roll available (Min: 15)",
        labels: ["low"],
        assignee: "8"
      },
      {
        id: "4",
        title: "Benang Polyester 40/2",
        description: "WH-MAT-001 • 42 cone available (Min: 100)",
        labels: ["low"],
        assignee: "45"
      }
    ]
  },
  {
    id: "critical",
    title: "Kritis / Critical",
    tasks: [
      {
        id: "5",
        title: "Kain Rayon Viscose",
        description: "WH-MAT-001 • 2 roll available",
        labels: ["critical"],
        assignee: "3"
      }
    ]
  },
  {
    id: "out",
    title: "Habis / Out of Stock",
    tasks: [
      {
        id: "3",
        title: "Kancing Kemeja 18L",
        description: "WH-ACC-001 • 0 gross available",
        labels: ["out"],
        assignee: "0"
      }
    ]
  }
]

export default function StockLevelsPage() {

  // Calculate mock stats
  const totalItems = 5
  const normalItems = 1
  const warningItems = 3 // low + critical
  const outItems = 1

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-black p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-white font-serif">Level Stok</h1>
          <p className="text-zinc-400 mt-1">
            Visual monitoring of material availability across warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button asChild className="bg-white text-black hover:bg-zinc-200">
            <Link href="/inventory/adjustments">
              <Edit className="mr-2 h-4 w-4" />
              Penyesuaian
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cluster using MetricCardMini */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardMini
          title="Total Items"
          value={totalItems.toString()}
          trend="SKU"
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Stok Normal"
          value={normalItems.toString()}
          trend="Aman"
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Perlu Perhatian"
          value={warningItems.toString()}
          trend="Restock"
          trendUp={false}
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Habis Stok"
          value={outItems.toString()}
          trend="Urgent"
          trendUp={false}
          className="bg-zinc-900/50 border-zinc-800"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden rounded-3xl bg-zinc-900/50 border border-zinc-800 p-6">
        <KanbanBoard
          columns={stockColumns}
          columnColors={{
            normal: "bg-emerald-600/20 border-emerald-600/30",
            low: "bg-amber-600/20 border-amber-600/30",
            critical: "bg-orange-600/20 border-orange-600/30",
            out: "bg-red-600/20 border-red-600/30",
          }}
          labelColors={{
            normal: "bg-emerald-500",
            low: "bg-amber-500",
            critical: "bg-orange-500",
            out: "bg-red-500",
          }}
          className="h-full"
          allowAddTask={false} // Read-only view for stock status usually
        />
      </div>
    </div>
  )
}