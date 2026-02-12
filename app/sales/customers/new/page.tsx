"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, CreditCard, FileText, Phone, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/sales/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Tambah Pelanggan Baru</h2>
            <p className="text-muted-foreground">
              Buat data pelanggan atau prospek baru.
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Informasi Dasar
                </CardTitle>
                <CardDescription>Data dasar pelanggan/prospek</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode Pelanggan *</FormLabel>
                        <FormControl>
                          <Input placeholder="CUST-2026-0001" {...field} />
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
                        <FormLabel>Jenis Pelanggan *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                      <FormLabel>Nama {customerType === "INDIVIDUAL" ? "Lengkap" : "Perusahaan"} *</FormLabel>
                      <FormControl>
                        <Input placeholder={customerType === "INDIVIDUAL" ? "Nama lengkap" : "PT. Contoh Perusahaan"} {...field} />
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
                        <FormLabel>Nama Legal</FormLabel>
                        <FormControl>
                          <Input placeholder="Nama legal sesuai dokumen" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-center space-x-8">
                  <FormField
                    control={form.control}
                    name="isProspect"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Prospek</FormLabel>
                          <FormDescription>Masih calon pelanggan</FormDescription>
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
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Aktif</FormLabel>
                          <FormDescription>Status aktif customer</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="mr-2 h-5 w-5" />
                  Informasi Kontak
                </CardTitle>
                <CardDescription>Data kontak dan komunikasi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Telepon</FormLabel>
                      <FormControl>
                        <Input placeholder="08xxxxxxxxxx" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@company.com" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://company.com" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mata Uang</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Informasi Pajak
                </CardTitle>
                <CardDescription>NPWP/NIK dan status pajak</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {customerType === "INDIVIDUAL" ? (
                  <FormField
                    control={form.control}
                    name="nik"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIK</FormLabel>
                        <FormControl>
                          <Input placeholder="16 digit NIK" {...field} />
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
                        <FormLabel>NPWP</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000.0-000.000" {...field} />
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
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Kena Pajak</FormLabel>
                        <FormDescription>Centang jika customer kena pajak</FormDescription>
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
                          <FormLabel>Status Pajak</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                          <FormLabel>Alamat Pajak</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Alamat sesuai NPWP" className="resize-none" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Manajemen Kredit
                </CardTitle>
                <CardDescription>Pengaturan limit kredit dan pembayaran</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limit Kredit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            value={field.value}
                            onChange={(event) => field.onChange(Number(event.target.value || 0))}
                            placeholder="0"
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
                        <FormLabel>Jangka Waktu (Hari)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            value={field.value}
                            onChange={(event) => field.onChange(Number(event.target.value || 0))}
                            placeholder="30"
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
                        <FormLabel>Term Pembayaran</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end space-x-4">
            <Button variant="outline" asChild>
              <Link href="/sales/customers">Batal</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>Menyimpan...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Pelanggan
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
