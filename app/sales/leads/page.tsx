"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Flame, Plus, RefreshCcw, Search, TrendingUp, Trophy } from "lucide-react"
import { toast } from "sonner"

import { useLeads, useLeadStatusMutation } from "@/hooks/use-leads"
import { LeadKanban, type LeadStage } from "@/components/sales/leads/lead-kanban"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const formatIDR = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact"
  }).format(value)
}

export default function LeadsPage() {
  const { data, isLoading, isFetching, refetch } = useLeads()
  const leads = data?.leads ?? []
  const summary = data?.summary ?? { totalLeads: 0, pipelineValue: 0, hotLeads: 0, statusCounts: {} }
  const statusMutation = useLeadStatusMutation()

  const [searchTerm, setSearchTerm] = useState("")

  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads

    const normalized = searchTerm.toLowerCase()
    return leads.filter((lead) => {
      return (
        lead.title.toLowerCase().includes(normalized)
        || (lead.company || "").toLowerCase().includes(normalized)
        || lead.contactName.toLowerCase().includes(normalized)
      )
    })
  }, [leads, searchTerm])

  const handleStatusChange = async (leadId: string, status: LeadStage) => {
    try {
      await statusMutation.mutateAsync({ leadId, status })
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengubah status lead")
      throw error
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4 p-4 md:p-6 lg:p-8 pt-6 bg-zinc-50/50 dark:bg-black w-full">

      {/* ═══════════════════════════════════════════ */}
      {/* COMMAND HEADER                              */}
      {/* ═══════════════════════════════════════════ */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900 rounded-none flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-orange-500">
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Pipeline Penjualan
              </h2>
              <p className="text-zinc-600 text-xs font-bold mt-0.5">
                Kelola seluruh lead CRM dari prospek sampai win/loss.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none bg-white"
            >
              <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild className="h-9 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all rounded-none px-4">
              <Link href="/sales/leads/new">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Prospek Baru
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* KPI PULSE STRIP                            */}
      {/* ═══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4">

          {/* Total Leads */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800" />
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Leads</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900">
              {summary?.totalLeads || 0}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Active Pipeline</span>
            </div>
          </div>

          {/* Pipeline Value */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pipeline Value</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
              {formatIDR(summary?.pipelineValue || 0)}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Potensi Revenue</span>
            </div>
          </div>

          {/* Hot Leads */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hot Leads</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-orange-600">
              {summary?.hotLeads || 0}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-orange-600 uppercase">High Probability</span>
            </div>
          </div>

          {/* Won / Lost */}
          <div className="relative p-4 md:p-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-purple-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status Akhir</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-purple-600 flex items-baseline gap-2">
              <span>{summary?.statusCounts?.WON || 0}</span>
              <span className="text-lg text-zinc-400 font-bold">/</span>
              <span className="text-zinc-400">{summary?.statusCounts?.LOST || 0}</span>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-purple-600 uppercase">Won</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">vs Lost</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SEARCH BAR                                  */}
      {/* ═══════════════════════════════════════════ */}
      <div className="relative max-w-md flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Cari lead, perusahaan, atau kontak..."
          className="pl-9 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none h-10 font-bold focus-visible:ring-0 transition-all hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* KANBAN BOARD                                */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex-1 min-h-[400px] overflow-hidden border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-zinc-100 rounded-none">
        <LeadKanban
          leads={filteredLeads}
          isLoading={isLoading}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  )
}
