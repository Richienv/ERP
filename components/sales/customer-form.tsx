"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { createCustomerSchema, type CreateCustomerInput } from "@/lib/validations"
import { Save, X, User, Building2, CreditCard, MapPin, Phone } from "lucide-react"

// Indonesian provinces for dropdown
const INDONESIAN_PROVINCES = [
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "D.I. Yogyakarta",
  "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
  "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara",
  "Gorontalo", "Sulawesi Barat", "Sumatera Utara", "Sumatera Barat", "Riau",
  "Kepulauan Riau", "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung",
  "Bangka Belitung", "Maluku", "Maluku Utara", "Papua", "Papua Barat",
  "Papua Tengah", "Papua Pegunungan", "Papua Selatan", "Papua Barat Daya"
]

// Mock customer categories
const mockCustomerCategories = [
  { id: "1", code: "CORP", name: "Korporat" },
  { id: "2", code: "SME", name: "UMKM" },
  { id: "3", code: "IND", name: "Individual" },
  { id: "4", code: "GOV", name: "Pemerintah" },
  { id: "5", code: "RET", name: "Retail" }
]

interface CustomerFormProps {
  initialData?: Partial<CreateCustomerInput>
  onSubmit: (data: CreateCustomerInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  isEdit?: boolean
}

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false
}: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      code: initialData?.code || '',
      name: initialData?.name || '',
      legalName: initialData?.legalName || '',
      customerType: initialData?.customerType || 'COMPANY',
      categoryId: initialData?.categoryId || '',
      npwp: initialData?.npwp || '',
      nik: initialData?.nik || '',
      taxAddress: initialData?.taxAddress || '',
      isTaxable: initialData?.isTaxable ?? true,
      taxStatus: initialData?.taxStatus || 'PKP',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      website: initialData?.website || '',
      creditLimit: initialData?.creditLimit || 0,
      creditTerm: initialData?.creditTerm || 30,
      paymentTerm: initialData?.paymentTerm || 'NET_30',
      currency: initialData?.currency || 'IDR',
      priceListId: initialData?.priceListId || '',
      salesPersonId: initialData?.salesPersonId || '',
      isActive: initialData?.isActive ?? true,
      isProspect: initialData?.isProspect ?? false,
    },
  })

  const { watch } = form
  const customerType = watch('customerType')
  const isTaxable = watch('isTaxable')

  const handleSubmit = async (data: CreateCustomerInput) => {
    try {
      setIsSubmitting(true)
      await onSubmit(data)
      toast.success(isEdit ? 'Pelanggan berhasil diperbarui!' : 'Pelanggan berhasil dibuat!')
    } catch (error) {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? 'Perbarui informasi pelanggan' : 'Isi form di bawah untuk menambah pelanggan baru'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Menyimpan...' : isEdit ? 'Perbarui' : 'Simpan'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Basic Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informasi Dasar
                </CardTitle>
                <CardDescription>
                  Informasi utama pelanggan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode Pelanggan *</FormLabel>
                        <FormControl>
                          <Input placeholder="CUST001" {...field} />
                        </FormControl>
                        <FormDescription>
                          Kode unik untuk pelanggan
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipe Pelanggan *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih tipe pelanggan" />
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
                      <FormLabel>Nama Pelanggan *</FormLabel>
                      <FormControl>
                        <Input placeholder="PT Teknologi Maju Indonesia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {customerType === 'COMPANY' && (
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Legal</FormLabel>
                        <FormControl>
                          <Input placeholder="Nama legal perusahaan" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nama resmi perusahaan (jika berbeda dengan nama pelanggan)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori Pelanggan</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih kategori" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockCustomerCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Tax Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informasi Pajak
                </CardTitle>
                <CardDescription>
                  Informasi perpajakan pelanggan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="isTaxable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Kena Pajak</FormLabel>
                          <FormDescription>
                            Apakah pelanggan ini dikenakan pajak?
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

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
                                <SelectValue placeholder="Pilih status pajak" />
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

                    <div className="grid gap-4 md:grid-cols-2">
                      {customerType !== 'INDIVIDUAL' && (
                        <FormField
                          control={form.control}
                          name="npwp"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NPWP</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="01.234.567.8-901.000" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Format: XX.XXX.XXX.X-XXX.XXX
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {customerType === 'INDIVIDUAL' && (
                        <FormField
                          control={form.control}
                          name="nik"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NIK</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="3201234567890123" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Nomor Induk Kependudukan (16 digit)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="taxAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alamat Pajak</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Alamat yang terdaftar untuk keperluan pajak..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Informasi Kontak
                </CardTitle>
                <CardDescription>
                  Informasi kontak pelanggan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl>
                          <Input placeholder="+62-21-12345678" {...field} />
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
                          <Input 
                            type="email" 
                            placeholder="info@perusahaan.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.perusahaan.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Credit Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Manajemen Kredit
                </CardTitle>
                <CardDescription>
                  Pengaturan kredit dan pembayaran
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit Kredit (IDR)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="500000000"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Batas maksimal kredit
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
                      <FormLabel>Term Kredit (Hari)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="30"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                            <SelectValue placeholder="Pilih term pembayaran" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CASH">Tunai</SelectItem>
                          <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                          <SelectItem value="NET_15">Net 15 Hari</SelectItem>
                          <SelectItem value="NET_30">Net 30 Hari</SelectItem>
                          <SelectItem value="NET_45">Net 45 Hari</SelectItem>
                          <SelectItem value="NET_60">Net 60 Hari</SelectItem>
                          <SelectItem value="NET_90">Net 90 Hari</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Status and Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Status & Pengaturan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Status Aktif</FormLabel>
                        <FormDescription>
                          Pelanggan dapat melakukan transaksi
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isProspect"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Prospek</FormLabel>
                        <FormDescription>
                          Tandai sebagai calon pelanggan
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}