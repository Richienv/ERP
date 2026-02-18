"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { toast } from "sonner"
import { createProductSchema, type CreateProductInput } from "@/lib/validations"
import { createUnit, createCategory } from "@/lib/actions/master-data"
import { useUnits, useMasterCategories, useInvalidateMasterData } from "@/hooks/use-master-data"
import { Save, X, Package, DollarSign, BarChart3 } from "lucide-react"

interface ProductFormProps {
  initialData?: Partial<CreateProductInput>
  onSubmit: (data: CreateProductInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  isEdit?: boolean
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
}: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // DB-backed master data
  const { data: dbUnits = [], isLoading: unitsLoading } = useUnits()
  const { data: dbCategories = [], isLoading: categoriesLoading } = useMasterCategories()
  const { invalidateUnits, invalidateCategories } = useInvalidateMasterData()

  const unitOptions = useMemo(() =>
    dbUnits.map((u: { code: string; name: string }) => ({ value: u.code, label: u.name, subtitle: u.code })), [dbUnits])
  const categoryOptions = useMemo(() =>
    dbCategories.map((c: { id: string; code: string; name: string }) => ({ value: c.id, label: c.name, subtitle: c.code })), [dbCategories])

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      code: initialData?.code || "",
      name: initialData?.name || "",
      description: initialData?.description || "",
      categoryId: initialData?.categoryId || "",
      unit: initialData?.unit || "pcs",
      costPrice: initialData?.costPrice || 0,
      sellingPrice: initialData?.sellingPrice || 0,
      minStock: initialData?.minStock || 0,
      maxStock: initialData?.maxStock || 0,
      reorderLevel: initialData?.reorderLevel || 0,
      barcode: initialData?.barcode || "",
    },
  })

  const handleSubmit = async (data: CreateProductInput) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      toast.success(isEdit ? "Produk berhasil diperbarui" : "Produk berhasil dibuat")
      if (!isEdit) {
        form.reset()
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan produk")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const watchedCostPrice = form.watch("costPrice") ?? 0
  const watchedSellingPrice = form.watch("sellingPrice") ?? 0
  const margin = watchedCostPrice > 0 ? ((watchedSellingPrice - watchedCostPrice) / watchedCostPrice) * 100 : 0

  const handleCreateUnit = async (name: string) => {
    const code = name.toLowerCase().replace(/\s+/g, '')
    const unit = await createUnit(code, name)
    await invalidateUnits()
    toast.success(`Satuan "${name}" berhasil dibuat`)
    return unit.code
  }

  const handleCreateCategory = async (name: string) => {
    const code = name.substring(0, 3).toUpperCase()
    const category = await createCategory(code, name)
    await invalidateCategories()
    toast.success(`Kategori "${name}" berhasil dibuat`)
    return category.id
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Edit Produk" : "Tambah Produk Baru"}
          </h2>
          <p className="text-muted-foreground">
            {isEdit ? "Perbarui informasi produk" : "Masukkan detail produk baru ke dalam sistem inventori"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  Informasi Dasar
                </CardTitle>
                <CardDescription>
                  Informasi dasar tentang produk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode Produk *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Masukkan kode produk (contoh: ELK001)"
                          {...field}
                          className="uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        Format: 3 huruf + 3 angka (contoh: ELK001)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Produk *</FormLabel>
                      <FormControl>
                        <Input placeholder="Masukkan nama produk" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Deskripsi produk (opsional)"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <FormControl>
                        <ComboboxWithCreate
                          options={categoryOptions}
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Pilih kategori..."
                          searchPlaceholder="Cari kategori..."
                          emptyMessage="Kategori tidak ditemukan."
                          createLabel="+ Buat Kategori Baru"
                          onCreate={handleCreateCategory}
                          isLoading={categoriesLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Satuan *</FormLabel>
                      <FormControl>
                        <ComboboxWithCreate
                          options={unitOptions}
                          value={field.value || "pcs"}
                          onChange={field.onChange}
                          placeholder="Pilih satuan..."
                          searchPlaceholder="Cari satuan..."
                          emptyMessage="Satuan tidak ditemukan."
                          createLabel="+ Buat Satuan Baru"
                          onCreate={handleCreateUnit}
                          isLoading={unitsLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="Barcode produk (opsional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Pricing Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Informasi Harga
                </CardTitle>
                <CardDescription>
                  Harga beli dan jual produk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Beli</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Harga pembelian per satuan (Rp)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Jual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Harga penjualan per satuan (Rp)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedCostPrice > 0 && watchedSellingPrice > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span>Margin:</span>
                      <span className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span>Keuntungan per unit:</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0
                        }).format(watchedSellingPrice - watchedCostPrice)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stock Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Manajemen Stok
              </CardTitle>
              <CardDescription>
                Pengaturan level stok dan reorder point
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stok Minimum</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Jumlah stok minimum
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stok Maksimum</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Jumlah stok maksimum
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Point</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Level untuk pemesanan ulang
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Batal
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? (isEdit ? "Memperbarui..." : "Menyimpan...") : (isEdit ? "Perbarui Produk" : "Simpan Produk")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
