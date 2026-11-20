"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import {
  IconUsers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCurrencyDollar,
  IconChartLine,
} from "@tabler/icons-react"
import { Loader2 } from "lucide-react"

import { useSalespersons, useCommissionReport, type SalespersonRow } from "@/hooks/use-salespersons"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
} from "@/components/ui/nb-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { confirmAction } from "@/components/ui/confirm-action-host"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

type FormData = {
  id?: string
  code: string
  name: string
  phone: string
  email: string
  commissionRate: string
  isActive: boolean
}

const emptyForm: FormData = {
  code: "",
  name: "",
  phone: "",
  email: "",
  commissionRate: "0",
  isActive: true,
}

export default function SalespersonsPage() {
  const { data, isLoading } = useSalespersons()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")

  // Commission report state
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const [reportStart, setReportStart] = useState(firstOfMonth)
  const [reportEnd, setReportEnd] = useState(today)
  const { data: reportData, isLoading: reportLoading } = useCommissionReport(reportStart, reportEnd)

  if (isLoading || !data) return <TablePageSkeleton accentColor="bg-amber-400" />

  const { salespersons, summary } = data

  const filtered = salespersons.filter((sp) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return sp.name.toLowerCase().includes(q) || sp.code.toLowerCase().includes(q) || (sp.email && sp.email.toLowerCase().includes(q))
  })

  const openCreate = () => {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (sp: SalespersonRow) => {
    setForm({
      id: sp.id,
      code: sp.code,
      name: sp.name,
      phone: sp.phone || "",
      email: sp.email || "",
      commissionRate: String(sp.commissionRate),
      isActive: sp.isActive,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (sp: SalespersonRow) => {
    if (!(await confirmAction({ title: `Hapus salesperson ${sp.name}?`, confirmLabel: "Hapus salesperson", destructive: true }))) return
    try {
      const res = await fetch(`/api/sales/salespersons?id=${sp.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(json.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.salespersons.all })
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus")
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi")
      return
    }
    setSubmitting(true)
    try {
      const isEdit = !!form.id
      const res = await fetch("/api/sales/salespersons", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          code: form.code || undefined,
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          commissionRate: Number(form.commissionRate || 0),
          isActive: form.isActive,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(json.message)
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.salespersons.all })
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mf-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Salesperson & Komisi</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Kelola tim sales dan perhitungan komisi</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 text-white hover:bg-amber-600 border border-amber-600 font-semibold text-xs h-10 px-5 shadow-sm hover:shadow-sm transition-all"
        >
          <IconPlus className="h-4 w-4 mr-1.5" /> Tambah Salesperson
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Salesperson", value: summary.total, icon: IconUsers, color: "bg-blue-50 border-blue-300 text-blue-700" },
          { label: "Aktif", value: summary.active, icon: IconUsers, color: "bg-green-50 border-green-300 text-green-700" },
          { label: "Total Penjualan", value: formatCurrency(summary.totalSalesAll), icon: IconCurrencyDollar, color: "bg-amber-50 border-amber-300 text-amber-700" },
          { label: "Total Komisi", value: formatCurrency(summary.totalCommissionAll), icon: IconChartLine, color: "bg-purple-50 border-purple-300 text-purple-700" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`border border-border shadow-sm p-4 ${kpi.color.split(" ")[0]}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className="h-4 w-4" />
              <span className="text-xs font-semibold  ">{kpi.label}</span>
            </div>
            <p className="text-lg font-semibold font-mono">{kpi.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="master" className="space-y-4">
        <TabsList className="border border-border">
          <TabsTrigger value="master" className="font-bold text-xs ">Data Salesperson</TabsTrigger>
          <TabsTrigger value="commission" className="font-bold text-xs ">Laporan Komisi</TabsTrigger>
        </TabsList>

        {/* ===== TAB: Master ===== */}
        <TabsContent value="master" className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari salesperson..."
              className="border border-border h-10 font-medium flex-1 max-w-lg placeholder:text-zinc-300"
            />
          </div>

          <div className="border border-border shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-100 dark:bg-zinc-800 border-b border-border">
                    <TableHead className="text-xs font-semibold  ">Kode</TableHead>
                    <TableHead className="text-xs font-semibold  ">Nama</TableHead>
                    <TableHead className="text-xs font-semibold  ">Telepon</TableHead>
                    <TableHead className="text-xs font-semibold  ">Email</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Komisi %</TableHead>
                    <TableHead className="text-xs font-semibold text-center">SO</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Sales</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Komisi</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-zinc-400 py-12">
                        Belum ada data salesperson
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((sp) => (
                    <TableRow key={sp.id} className="border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <TableCell className="font-mono text-xs font-bold">{sp.code}</TableCell>
                      <TableCell className="font-semibold">{sp.name}</TableCell>
                      <TableCell className="text-sm text-zinc-600">{sp.phone || "-"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">{sp.email || "-"}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{sp.commissionRate}%</TableCell>
                      <TableCell className="text-center font-mono">{sp.orderCount}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(sp.totalSales)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-amber-700 dark:text-amber-400">{formatCurrency(sp.commissionEarned)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={sp.isActive ? "default" : "secondary"} className={sp.isActive ? "bg-green-100 text-green-800 border border-green-300" : ""}>
                          {sp.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button aria-label="Ubah" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sp)}>
                            <IconEdit className="h-4 w-4" />
                          </Button>
                          <Button aria-label="Hapus" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(sp)}>
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ===== TAB: Commission Report ===== */}
        <TabsContent value="commission" className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-zinc-500">Dari</Label>
              <Input
                type="date"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
                className="border border-border h-10 font-medium w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-zinc-500">Sampai</Label>
              <Input
                type="date"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
                className="border border-border h-10 font-medium w-44"
              />
            </div>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" aria-hidden />
              <span className="ml-2 text-sm text-muted-foreground">Memuat laporan komisi…</span>
            </div>
          ) : reportData ? (
            <>
              {/* Commission KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-border shadow-sm bg-amber-50 p-4">
                  <span className="text-xs font-semibold text-amber-600">Total Penjualan Periode</span>
                  <p className="text-xl font-semibold font-mono text-amber-800 mt-1">{formatCurrency(reportData.summary.grandTotalSales)}</p>
                </div>
                <div className="border border-border shadow-sm bg-purple-50 p-4">
                  <span className="text-xs font-semibold text-purple-600">Total Komisi Periode</span>
                  <p className="text-xl font-semibold font-mono text-purple-800 mt-1">{formatCurrency(reportData.summary.grandTotalCommission)}</p>
                </div>
                <div className="border border-border shadow-sm bg-blue-50 p-4">
                  <span className="text-xs font-semibold text-blue-600">Salesperson Aktif</span>
                  <p className="text-xl font-semibold font-mono text-blue-800 mt-1">{reportData.summary.salespersonCount}</p>
                </div>
              </div>

              <div className="border border-border shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-100 dark:bg-zinc-800 border-b border-border">
                        <TableHead className="text-xs font-semibold  ">Salesperson</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Komisi %</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Jumlah SO</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total Penjualan</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total Komisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.report.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-zinc-400 py-12">
                            Tidak ada data untuk periode ini
                          </TableCell>
                        </TableRow>
                      )}
                      {reportData.report.map((sp) => (
                        <TableRow key={sp.id} className="border-b border-zinc-200 dark:border-zinc-700">
                          <TableCell>
                            <span className="font-mono text-xs text-zinc-400 mr-2">{sp.code}</span>
                            <span className="font-semibold">{sp.name}</span>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">{sp.commissionRate}%</TableCell>
                          <TableCell className="text-center font-mono">{sp.orderCount}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency(sp.totalSales)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold text-amber-700 dark:text-amber-400">{formatCurrency(sp.totalCommission)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <NBDialog open={dialogOpen} onOpenChange={setDialogOpen} size="narrow">
        <NBDialogHeader
          icon={form.id ? IconEdit : IconPlus}
          title={form.id ? "Edit Salesperson" : "Tambah Salesperson"}
          subtitle="Kelola data dan tarif komisi salesperson"
        />
        <NBDialogBody>
          <NBSection icon={IconUsers} title="Identitas">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <NBInput
                  label="Kode"
                  value={form.code}
                  onChange={(v) => setForm({ ...form, code: v })}
                  placeholder="SP-001"
                  disabled={!!form.id}
                />
                {!form.id && (
                  <p className="text-xs text-zinc-400 mt-1">Kosongkan untuk auto-generate</p>
                )}
              </div>
              <NBInput
                label="Nama"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Nama..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Telepon"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="081..."
              />
              <NBInput
                label="Email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="email@..."
              />
            </div>
          </NBSection>

          <NBSection icon={IconCurrencyDollar} title="Komisi & Status">
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Tarif Komisi (%)"
                type="number"
                value={form.commissionRate}
                onChange={(v) => setForm({ ...form, commissionRate: v })}
                placeholder="2.5"
              />
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1 block">
                  Status
                </label>
                <div className="flex items-center gap-2 h-8">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  <Label className="text-sm font-bold">
                    {form.isActive ? "Aktif" : "Nonaktif"}
                  </Label>
                </div>
              </div>
            </div>
          </NBSection>
        </NBDialogBody>
        <NBDialogFooter
          onCancel={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={form.id ? "Simpan" : "Buat"}
        />
      </NBDialog>
    </div>
  )
}
