"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, CreditCard, FileText, Phone, Save, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { NB } from "@/lib/dialog-styles"

type CustomerFormValues = {
  code: string
  name: string
  legalName: string
  customerType: "INDIVIDUAL" | "COMPANY" | "GOVERNMENT"
  npwp: string
  nik: string
  taxAddress: string
  isTaxable: boolean
  taxStatus: "PKP" | "NON_PKP" | "EXEMPT"
  phone: string
  email: string
  website: string
  creditLimit: number
  creditTerm: number
  paymentTerm: "CASH" | "NET_15" | "NET_30" | "NET_45" | "NET_60" | "NET_90" | "COD"
  currency: string
  isActive: boolean
  isProspect: boolean
}

const defaultValues: CustomerFormValues = {
  code: "",
  name: "",
  legalName: "",
  customerType: "COMPANY",
  npwp: "",
  nik: "",
  taxAddress: "",
  isTaxable: true,
  taxStatus: "PKP",
  phone: "",
  email: "",
  website: "",
  creditLimit: 0,
  creditTerm: 30,
  paymentTerm: "NET_30",
  currency: "IDR",
  isActive: true,
  isProspect: false,
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CustomerFormValues>({
    defaultValues,
  })

  const customerType = form.watch("customerType")
  const isTaxable = form.watch("isTaxable")

  const onSubmit = async (data: CustomerFormValues) => {
    if (!data.code.trim() || !data.name.trim()) {
      toast.error("Kode dan nama pelanggan wajib diisi")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/sales/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Gagal membuat pelanggan")
      }

      toast.success("Pelanggan berhasil dibuat")
      router.push("/sales/customers")
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat pelanggan")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] hover:translate-x-[1px] rounded-none">
            <Link href="/sales/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-black tracking-tight uppercase">Tambah Pelanggan Baru</h2>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-wider mt-1">Buat data pelanggan atau prospek baru.</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Informasi Dasar */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-amber-400 bg-amber-50`}>
                <Building2 className="h-4 w-4" />
                <span className={NB.sectionTitle}>Informasi Dasar</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Kode Pelanggan <span className={NB.labelRequired}>*</span></label>
                        <FormControl>
                          <Input placeholder="CUST-2026-0001" className={NB.inputMono} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Jenis Pelanggan <span className={NB.labelRequired}>*</span></label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className={NB.select}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-2 border-black rounded-none">
                            <SelectItem value="INDIVIDUAL">Perorangan</SelectItem>
                            <SelectItem value="COMPANY">Perusahaan</SelectItem>
                            <SelectItem value="GOVERNMENT">Pemerintah</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <label className={NB.label}>Nama {customerType === "INDIVIDUAL" ? "Lengkap" : "Perusahaan"} <span className={NB.labelRequired}>*</span></label>
                      <FormControl>
                        <Input placeholder={customerType === "INDIVIDUAL" ? "Nama lengkap" : "PT. Contoh Perusahaan"} className={NB.input} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {customerType === "COMPANY" && (
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Nama Legal</label>
                        <FormControl>
                          <Input placeholder="Nama legal sesuai dokumen" className={NB.input} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-center gap-8 pt-2">
                  <FormField
                    control={form.control}
                    name="isProspect"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            className="border-2 border-black rounded-none h-5 w-5"
                          />
                        </FormControl>
                        <div className="space-y-0.5 leading-none">
                          <FormLabel className="text-xs font-black uppercase">Prospek</FormLabel>
                          <FormDescription className="text-[10px] text-zinc-500">Masih calon pelanggan</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            className="border-2 border-black rounded-none h-5 w-5"
                          />
                        </FormControl>
                        <div className="space-y-0.5 leading-none">
                          <FormLabel className="text-xs font-black uppercase">Aktif</FormLabel>
                          <FormDescription className="text-[10px] text-zinc-500">Status aktif customer</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Informasi Kontak */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-amber-400 bg-amber-50`}>
                <Phone className="h-4 w-4" />
                <span className={NB.sectionTitle}>Informasi Kontak</span>
              </div>
              <div className={NB.sectionBody}>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <label className={NB.label}>Nomor Telepon</label>
                      <FormControl>
                        <Input placeholder="08xxxxxxxxxx" className={NB.input} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <label className={NB.label}>Email</label>
                      <FormControl>
                        <Input type="email" placeholder="email@company.com" className={NB.input} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <label className={NB.label}>Website</label>
                      <FormControl>
                        <Input placeholder="https://company.com" className={NB.input} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <label className={NB.label}>Mata Uang</label>
                      <FormControl>
                        <Input className={NB.inputMono} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Informasi Pajak */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-amber-400 bg-amber-50`}>
                <FileText className="h-4 w-4" />
                <span className={NB.sectionTitle}>Informasi Pajak</span>
              </div>
              <div className={NB.sectionBody}>
                {customerType === "INDIVIDUAL" ? (
                  <FormField
                    control={form.control}
                    name="nik"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>NIK</label>
                        <FormControl>
                          <Input placeholder="16 digit NIK" className={NB.inputMono} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="npwp"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>NPWP</label>
                        <FormControl>
                          <Input placeholder="00.000.000.0-000.000" className={NB.inputMono} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="isTaxable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          className="border-2 border-black rounded-none h-5 w-5"
                        />
                      </FormControl>
                      <div className="space-y-0.5 leading-none">
                        <FormLabel className="text-xs font-black uppercase">Kena Pajak</FormLabel>
                        <FormDescription className="text-[10px] text-zinc-500">Centang jika customer kena pajak</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {isTaxable && (
                  <>
                    <FormField
                      control={form.control}
                      name="taxStatus"
                      render={({ field }) => (
                        <FormItem>
                          <label className={NB.label}>Status Pajak</label>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className={NB.select}>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-2 border-black rounded-none">
                              <SelectItem value="PKP">PKP</SelectItem>
                              <SelectItem value="NON_PKP">Non-PKP</SelectItem>
                              <SelectItem value="EXEMPT">Bebas Pajak</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taxAddress"
                      render={({ field }) => (
                        <FormItem>
                          <label className={NB.label}>Alamat Pajak</label>
                          <FormControl>
                            <Textarea placeholder="Alamat sesuai NPWP" className={NB.textarea + " min-h-[80px]"} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Manajemen Kredit */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-amber-400 bg-amber-50`}>
                <CreditCard className="h-4 w-4" />
                <span className={NB.sectionTitle}>Manajemen Kredit</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Limit Kredit</label>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            value={field.value}
                            onChange={(event) => field.onChange(Number(event.target.value || 0))}
                            placeholder="0"
                            className={NB.inputMono}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="creditTerm"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Jangka Waktu (Hari)</label>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            value={field.value}
                            onChange={(event) => field.onChange(Number(event.target.value || 0))}
                            placeholder="30"
                            className={NB.inputMono}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentTerm"
                    render={({ field }) => (
                      <FormItem>
                        <label className={NB.label}>Term Pembayaran</label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className={NB.select}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-2 border-black rounded-none">
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="NET_15">NET 15</SelectItem>
                            <SelectItem value="NET_30">NET 30</SelectItem>
                            <SelectItem value="NET_45">NET 45</SelectItem>
                            <SelectItem value="NET_60">NET 60</SelectItem>
                            <SelectItem value="NET_90">NET 90</SelectItem>
                            <SelectItem value="COD">COD</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" asChild className={NB.cancelBtn}>
              <Link href="/sales/customers">Batal</Link>
            </Button>
            <Button type="submit" disabled={isLoading} className={NB.submitBtn}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Simpan Pelanggan</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
