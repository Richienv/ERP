"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  ArrowLeft,
  Save,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText
} from "lucide-react"
import Link from "next/link"

// Validation schema dengan Zod dalam bahasa Indonesia
const customerFormSchemaBase = z.object({
  // Basic Information
  code: z.string().min(1, "Kode pelanggan harus diisi"),
  name: z.string().min(1, "Nama pelanggan harus diisi"),
  legalName: z.string().optional(),
  customerType: z.enum(["INDIVIDUAL", "COMPANY", "GOVERNMENT"], {
    errorMap: () => ({ message: "Jenis pelanggan harus dipilih" }),
  }),
  categoryId: z.string().optional(),

  // Indonesian Business Information
  npwp: z.string().optional(),
  nik: z.string().optional(),
  taxAddress: z.string().optional(),
  isTaxable: z.boolean().default(true),
  taxStatus: z.enum(["PKP", "NON_PKP", "EXEMPT"]).default("PKP"),

  // Contact Information
  phone: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  website: z.string().url("Format website tidak valid").optional().or(z.literal("")),

  // Credit Management
  creditLimit: z.coerce.number().min(0).default(0),
  creditTerm: z.coerce.number().int().min(0).default(30),
  paymentTerm: z.enum(["CASH", "NET_15", "NET_30", "NET_45", "NET_60", "NET_90", "COD"]).default("NET_30"),

  // Business Settings
  currency: z.string().default("IDR"),
  priceListId: z.string().optional(),
  salesPersonId: z.string().optional(),

  // Status
  isActive: z.boolean().default(true),
  isProspect: z.boolean().default(false),
})

type CustomerFormValues = z.input<typeof customerFormSchemaBase>

// Default values
const defaultValues: CustomerFormValues = {
  code: "",
  name: "",
  customerType: "COMPANY",
  isTaxable: true,
  taxStatus: "PKP",
  creditLimit: 0,
  creditTerm: 30,
  paymentTerm: "NET_30",
  currency: "IDR",
  isActive: true,
  isProspect: false,
}

// Indonesian provinces list
const provinces = [
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur",
  "DI Yogyakarta", "Banten", "Sumatera Utara", "Sumatera Barat",
  "Sumatera Selatan", "Riau", "Kalimantan Timur", "Sulawesi Selatan"
]

export default function NewCustomerPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchemaBase),
    defaultValues,
  })

  const customerType = form.watch("customerType")
  const isTaxable = form.watch("isTaxable")

  async function onSubmit(data: CustomerFormValues) {
    setIsLoading(true)
    try {
      // Simulate API call
      console.log("Creating customer:", data)

      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Redirect to customers list
      router.push("/sales/customers")
    } catch (error) {
      console.error("Error creating customer:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
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
              Buat data pelanggan atau prospek baru
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Informasi Dasar
                </CardTitle>
                <CardDescription>
                  Data dasar pelanggan atau prospek
                </CardDescription>
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
                          <Input placeholder="CUST001" {...field} />
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
                              <SelectValue placeholder="Pilih jenis" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="INDIVIDUAL">Perorangan</SelectItem>
                            <SelectItem value="COMPANY">Perusahaan</SelectItem>
                            <SelectItem value="GOVERNMENT">Pemerintah</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
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
                        <Input
                          placeholder={customerType === "INDIVIDUAL" ? "John Doe" : "PT. Contoh Perusahaan"}
                          {...field}
                        />
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
                        <FormLabel>Nama Legal Perusahaan</FormLabel>
                        <FormControl>
                          <Input placeholder="PT. Contoh Perusahaan Tbk" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nama resmi sesuai akta pendirian
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-center space-x-4">
                  <FormField
                    control={form.control}
                    name="isProspect"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Prospek
                          </FormLabel>
                          <FormDescription>
                            Tandai jika masih calon pelanggan
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Aktif
                          </FormLabel>
                          <FormDescription>
                            Status aktif pelanggan
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="mr-2 h-5 w-5" />
                  Informasi Kontak
                </CardTitle>
                <CardDescription>
                  Data kontak dan komunikasi
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Telepon</FormLabel>
                      <FormControl>
                        <Input placeholder="021-12345678" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input type="email" placeholder="contact@perusahaan.com" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input placeholder="https://www.perusahaan.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Tax Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Informasi Pajak
              </CardTitle>
              <CardDescription>
                Data perpajakan sesuai regulasi Indonesia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="isTaxable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Kena Pajak
                        </FormLabel>
                        <FormDescription>
                          Transaksi kena PPN
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {isTaxable && (
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
                            <SelectItem value="PKP">PKP (Pengusaha Kena Pajak)</SelectItem>
                            <SelectItem value="NON_PKP">Non PKP</SelectItem>
                            <SelectItem value="EXEMPT">Bebas Pajak</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {customerType !== "INDIVIDUAL" && (
                  <FormField
                    control={form.control}
                    name="npwp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NPWP</FormLabel>
                        <FormControl>
                          <Input placeholder="01.234.567.8-901.000" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nomor Pokok Wajib Pajak
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {customerType === "INDIVIDUAL" && (
                  <FormField
                    control={form.control}
                    name="nik"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIK</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890123456" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nomor Induk Kependudukan
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {isTaxable && (
                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name="taxAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alamat Pajak</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Alamat sesuai yang terdaftar di NPWP..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Manajemen Kredit
              </CardTitle>
              <CardDescription>
                Pengaturan limit kredit dan pembayaran
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit Kredit (IDR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Maksimal kredit yang diizinkan
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creditTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jangka Waktu Kredit (Hari)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                          <SelectItem value="CASH">Tunai</SelectItem>
                          <SelectItem value="NET_15">NET 15 (15 hari)</SelectItem>
                          <SelectItem value="NET_30">NET 30 (30 hari)</SelectItem>
                          <SelectItem value="NET_45">NET 45 (45 hari)</SelectItem>
                          <SelectItem value="NET_60">NET 60 (60 hari)</SelectItem>
                          <SelectItem value="NET_90">NET 90 (90 hari)</SelectItem>
                          <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button variant="outline" asChild>
              <Link href="/sales/customers">
                Batal
              </Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Menyimpan...
                </>
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