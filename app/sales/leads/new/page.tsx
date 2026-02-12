"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface OptionRecord {
  id: string
  code?: string
  name: string
  email?: string | null
}

interface SalesOptionsResponse {
  success: boolean
  data?: {
    customers?: OptionRecord[]
    users?: OptionRecord[]
  }
  error?: string
}

export default function NewLeadPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [customers, setCustomers] = useState<OptionRecord[]>([])
  const [users, setUsers] = useState<OptionRecord[]>([])

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

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await fetch("/api/sales/options", {
          cache: "no-store",
        })
        const payload: SalesOptionsResponse = await response.json()
        if (!payload.success || !payload.data) return

        setCustomers(payload.data.customers || [])
        setUsers(payload.data.users || [])
      } catch (error) {
        console.error(error)
      }
    }

    loadOptions()
  }, [])

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
      router.push("/sales/leads")
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat prospek")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/sales/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Tambah Prospek Baru</h2>
            <p className="text-muted-foreground">
              Buat data prospek baru untuk pipeline penjualan.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Prospek</CardTitle>
            <CardDescription>Data utama untuk CRM lead pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Judul Prospek *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Contoh: Pengadaan Kain Cotton"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Perusahaan</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  placeholder="Nama perusahaan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Nama Kontak *</Label>
                <Input
                  id="contactName"
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                  placeholder="Nama PIC"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  placeholder="email@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Telepon</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(event) => updateField("contactPhone", event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Nilai Estimasi (IDR)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  min="0"
                  value={form.estimatedValue}
                  onChange={(event) => updateField("estimatedValue", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="probability">Probabilitas (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(event) => updateField("probability", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => updateField("status", value)}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Prioritas</Label>
                <Select value={form.priority} onValueChange={(value) => updateField("priority", value)}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Sumber Lead</Label>
                <Select value={form.source} onValueChange={(value) => updateField("source", value)}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Link Customer (Opsional)</Label>
                <Select value={form.customerId || "none"} onValueChange={(value) => updateField("customerId", value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.code ? `${customer.code} - ` : ""}{customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={form.assignedTo || "none"} onValueChange={(value) => updateField("assignedTo", value === "none" ? "" : value)}>
                  <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Kebutuhan detail dari prospek"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end space-x-4">
          <Button variant="outline" asChild>
            <Link href="/sales/leads">Batal</Link>
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>Menyimpan...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Prospek
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
