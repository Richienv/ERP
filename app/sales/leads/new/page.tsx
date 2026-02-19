"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import Link from "next/link"
import {
  ArrowLeft, Save, Loader2, Target,
  User, TrendingUp, UserCheck, StickyNote
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSalesOptions } from "@/hooks/use-sales-options"

export default function NewLeadPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const { data: salesOptions } = useSalesOptions()
  const customers = salesOptions?.customers ?? []
  const users = salesOptions?.users ?? []

  const [form, setForm] = useState({
    title: "",
    description: "",
    company: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    estimatedValue: "0",
    probability: "50",
    source: "WEBSITE",
    priority: "MEDIUM",
    status: "NEW",
    assignedTo: "",
    customerId: "",
  })

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.title.trim() || !form.contactName.trim()) {
      toast.error("Judul prospek dan nama kontak wajib diisi")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/sales/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          company: form.company || undefined,
          contactName: form.contactName,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          estimatedValue: Number(form.estimatedValue || 0),
          probability: Number(form.probability || 0),
          source: form.source,
          priority: form.priority,
          status: form.status,
          assignedTo: form.assignedTo || undefined,
          customerId: form.customerId || undefined,
        }),
      })

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Gagal membuat prospek")
      }

      toast.success("Prospek berhasil dibuat")
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesPage.all })
      router.push("/sales/leads")
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat prospek")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mf-page">
      <div className="max-w-5xl">
      {/* Back Button */}
      <Link
        href="/sales/leads"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Prospek
      </Link>

      {/* Page Header */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-amber-400">
          <Target className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Tambah Prospek Baru
            </h1>
            <p className="text-zinc-400 text-xs font-medium mt-0.5">
              Buat data prospek baru untuk pipeline penjualan
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-3">
        {/* SECTION 1 — Data Kontak */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
            <User className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Data Kontak</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Judul Prospek *</Label>
                <Input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Contoh: Pengadaan Kain Cotton"
                  className="border-2 border-black h-10 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Perusahaan</Label>
                <Input
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  placeholder="Nama perusahaan"
                  className="border-2 border-black h-10 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama Kontak *</Label>
                <Input
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                  placeholder="Nama PIC"
                  className="border-2 border-black h-10 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  placeholder="email@company.com"
                  className="border-2 border-black h-10 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Telepon</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(event) => updateField("contactPhone", event.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="border-2 border-black h-10 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2 — Nilai & Klasifikasi */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Nilai & Klasifikasi</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nilai Estimasi (IDR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.estimatedValue}
                    onChange={(event) => updateField("estimatedValue", event.target.value)}
                    className="border-2 border-black h-10 font-bold pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Probabilitas (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={(event) => updateField("probability", event.target.value)}
                    className="border-2 border-black h-10 font-bold pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
                <Select value={form.status} onValueChange={(value) => updateField("status", value)}>
                  <SelectTrigger className="border-2 border-black h-10 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Baru</SelectItem>
                    <SelectItem value="CONTACTED">Dihubungi</SelectItem>
                    <SelectItem value="QUALIFIED">Terkualifikasi</SelectItem>
                    <SelectItem value="PROPOSAL">Proposal</SelectItem>
                    <SelectItem value="NEGOTIATION">Negosiasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Prioritas</Label>
                <Select value={form.priority} onValueChange={(value) => updateField("priority", value)}>
                  <SelectTrigger className="border-2 border-black h-10 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sumber Lead</Label>
                <Select value={form.source} onValueChange={(value) => updateField("source", value)}>
                  <SelectTrigger className="border-2 border-black h-10 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEBSITE">Website</SelectItem>
                    <SelectItem value="REFERRAL">Referral</SelectItem>
                    <SelectItem value="ADVERTISEMENT">Advertisement</SelectItem>
                    <SelectItem value="COLD_CALL">Cold Call</SelectItem>
                    <SelectItem value="EXHIBITION">Exhibition</SelectItem>
                    <SelectItem value="SOCIAL_MEDIA">Social Media</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3 — Penugasan */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
            <UserCheck className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Penugasan</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Link Customer (Opsional)</Label>
                <Select value={form.customerId || "none"} onValueChange={(value) => updateField("customerId", value === "none" ? "" : value)}>
                  <SelectTrigger className="border-2 border-black h-10 font-medium">
                    <SelectValue placeholder="Pilih customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.code ? <span className="font-mono text-xs text-zinc-400 mr-1">{customer.code}</span> : null}{customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Assign To</Label>
                <Select value={form.assignedTo || "none"} onValueChange={(value) => updateField("assignedTo", value === "none" ? "" : value)}>
                  <SelectTrigger className="border-2 border-black h-10 font-medium">
                    <SelectValue placeholder="Pilih user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum di-assign</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email || user.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 — Deskripsi */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
            <StickyNote className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Deskripsi</h3>
          </div>
          <div className="p-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detail Kebutuhan Prospek</Label>
              <Textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Kebutuhan detail dari prospek"
                className="border-2 border-black min-h-[80px] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-5 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/sales/leads")}
              className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-xs tracking-wide h-11 px-6 hover:border-zinc-500 transition-colors"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-600 font-black uppercase text-xs tracking-wide h-11 px-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Simpan Prospek
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}
