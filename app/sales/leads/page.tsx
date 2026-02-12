"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Flame, Plus, RefreshCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { LeadKanban, LeadKanbanItem, LeadStage } from "@/components/sales/leads/lead-kanban"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface LeadsResponse {
  success: boolean
  data: LeadKanbanItem[]
  summary?: {
    totalLeads: number
    pipelineValue: number
    hotLeads: number
    statusCounts: Record<string, number>
  }
  error?: string
}

const formatIDR = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadKanbanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [summary, setSummary] = useState<LeadsResponse["summary"]>({
    totalLeads: 0,
    pipelineValue: 0,
    hotLeads: 0,
    statusCounts: {},
  })

  const loadLeads = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/sales/leads", {
        cache: "no-store",
      })
      const payload: LeadsResponse = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Failed to load leads")
      }

      setLeads(payload.data || [])
      setSummary(payload.summary || {
        totalLeads: 0,
        pipelineValue: 0,
        hotLeads: 0,
        statusCounts: {},
      })
    } catch (error: any) {
      toast.error(error?.message || "Gagal memuat data lead")
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

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

  const handleStatusChange = useCallback(async (leadId: string, status: LeadStage) => {
    const response = await fetch(`/api/sales/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })

    const payload = await response.json()
    if (!payload.success) {
      throw new Error(payload.error || "Gagal mengubah status lead")
    }
    await loadLeads()
  }, [loadLeads])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black">
      <div className="flex items-center justify-between space-y-2 gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
            Pipeline Penjualan
            <Flame className="h-7 w-7 text-orange-500" />
          </h2>
          <p className="text-muted-foreground font-medium">
            Kelola seluruh lead CRM dari prospek sampai menang/kalah.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-2 font-bold"
            onClick={loadLeads}
            disabled={refreshing}
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild className="font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
            <Link href="/sales/leads/new">
              <Plus className="mr-2 h-4 w-4" />
              Prospek Baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{summary?.totalLeads || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">{formatIDR(summary?.pipelineValue || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Hot Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-orange-600">{summary?.hotLeads || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Won / Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black">
              {summary?.statusCounts?.WON || 0} / {summary?.statusCounts?.LOST || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Cari lead, perusahaan, atau kontak..."
          className="pl-9"
        />
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] bg-card">
        <LeadKanban
          leads={filteredLeads}
          isLoading={loading}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  )
}
