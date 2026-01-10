"use client"

import { useState } from "react"
import { KanbanBoard, KanbanColumn, KanbanTask } from "@/components/ui/trello-kanban-board"
import { MetricCardMini } from "@/components/dashboard/metric-card-mini"
import { Button } from "@/components/ui/button"
import { Download, Search, Filter } from "lucide-react"

// Mock data converted for Kanban
// Source types: 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RESERVED'

const movementColumns: KanbanColumn[] = [
  {
    id: "in",
    title: "Barang Masuk (Inbound)",
    tasks: [
      {
        id: "1",
        title: "Kain Denim Stretch 14oz",
        description: "IN • +500 meter • PO-2024-1105. From: Supplier PT. Tekstil Nusantara",
        labels: ["inbound", "purchase"],
        assignee: "Siti"
      },
      {
        id: "5",
        title: "Zipper YKK Metal 18cm",
        description: "IN • +1000 pcs • PO-2024-1098. From: Supplier",
        labels: ["inbound", "purchase"],
        assignee: "Dedi"
      }
    ]
  },
  {
    id: "internal",
    title: "Internal / Transfer",
    tasks: [
      {
        id: "3",
        title: "Kancing Logam Brass",
        description: "TRANSFER • 25 gross • TRF-2024-0156. Aksesori -> Produksi",
        labels: ["transfer", "production"],
        assignee: "Budi"
      },
      {
        id: "7",
        title: "Kain Denim Raw Selvedge",
        description: "RESERVED • 200 meter • RSV-2024-0234. For: Premium Series",
        labels: ["reserved"],
        assignee: "Farid"
      },
      {
        id: "4",
        title: "Benang Polyester 40s",
        description: "ADJ • -5 cone • ADJ-2024-0089. Reason: Cacat Produksi",
        labels: ["adjustment", "correction"],
        assignee: "Rina"
      }
    ]
  },
  {
    id: "out",
    title: "Barang Keluar (Outbound)",
    tasks: [
      {
        id: "2",
        title: "Jeans Skinny Fit Premium",
        description: "OUT • -50 pcs • SO-2024-0890. To: Distributor JKT",
        labels: ["outbound", "sales"],
        assignee: "Ahmad"
      },
      {
        id: "6",
        title: "Jaket Jeans Oversized",
        description: "OUT • -25 pcs • SO-2024-0891. To: Export Malaysia",
        labels: ["outbound", "export"],
        assignee: "Indah"
      }
    ]
  }
]

export default function StockMovementsPage() {

  // Calculate mock stats
  const totalMoves = 7
  const valIn = "42.5M"
  const valOut = "10.8M"
  const netMove = "+31M"

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-black p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-white font-serif">Pergerakan Stok</h1>
          <p className="text-zinc-400 mt-1">
            Track material flow: Inbound, Internal Transfer, and Outbound.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white">
            <Download className="mr-2 h-4 w-4" />
            Export Log
          </Button>
        </div>
      </div>

      {/* Stats Cluster using MetricCardMini */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardMini
          title="Total Transaksi"
          value={totalMoves.toString()}
          trend="Today"
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Nilai Masuk"
          value={valIn}
          trend="+12%"
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Nilai Keluar"
          value={valOut}
          trend="-8%"
          trendUp={false}
          className="bg-zinc-900/50 border-zinc-800"
        />
        <MetricCardMini
          title="Net Flow"
          value={netMove}
          trend="Surplus"
          className="bg-zinc-900/50 border-zinc-800"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden rounded-3xl bg-zinc-900/50 border border-zinc-800 p-6">
        <KanbanBoard
          columns={movementColumns}
          columnColors={{
            in: "bg-emerald-600/10 border-emerald-600/20",
            internal: "bg-blue-600/10 border-blue-600/20",
            out: "bg-orange-600/10 border-orange-600/20",
          }}
          labelColors={{
            inbound: "bg-emerald-500",
            purchase: "bg-emerald-600",
            outbound: "bg-orange-500",
            sales: "bg-orange-600",
            export: "bg-rose-500",
            transfer: "bg-blue-500",
            production: "bg-indigo-500",
            reserved: "bg-purple-500",
            adjustment: "bg-zinc-500"
          }}
          className="h-full"
          allowAddTask={false}
        />
      </div>
    </div>
  )
}