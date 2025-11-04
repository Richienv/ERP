"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createProductSchema, CreateProductInput } from "@/lib/validations"
import { ProductWithRelations } from "@/lib/types"
import { useProducts } from "@/hooks/use-products"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithRelations | null
  mode: 'create' | 'edit'
}

// Mock categories for now - will be replaced with real data
const mockCategories = [
  { id: "1", name: "Elektronik" },
  { id: "2", name: "Furniture" },
  { id: "3", name: "Peralatan Kantor" },
  { id: "4", name: "Stationery" },
]

const units = [
  "pcs", "set", "unit", "box", "pack", "kg", "gram", "liter", "ml", 
  "meter", "cm", "roll", "sheet", "bottle", "bag", "carton"
]

export function ProductForm({ open, onOpenChange, product, mode }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { createProduct, updateProduct } = useProducts()

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      code: product?.code || "",
      name: product?.name || "",
      description: product?.description || "",
      categoryId: product?.categoryId || "",
      unit: product?.unit || "pcs",
      costPrice: Number(product?.costPrice) || 0,
      sellingPrice: Number(product?.sellingPrice) || 0,
      minStock: product?.minStock || 0,
      maxStock: product?.maxStock || 0,
      reorderLevel: product?.reorderLevel || 0,
      barcode: product?.barcode || "",
    },
  })

  const onSubmit = async (data: CreateProductInput) => {
    setIsSubmitting(true)
    
    try {
      let success = false
      
      if (mode === 'create') {
        success = await createProduct(data)
        if (success) {
          toast.success("Produk berhasil dibuat")
          form.reset()
          onOpenChange(false)
        }
      } else if (mode === 'edit' && product) {
        success = await updateProduct(product.id, data)
        if (success) {
          toast.success("Produk berhasil diperbarui")
          onOpenChange(false)
        }
      }

      if (!success) {
        toast.error("Gagal menyimpan produk")
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan produk")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Isi form di bawah untuk menambah produk baru ke inventori.'
              : 'Ubah informasi produk di form di bawah.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kode Produk */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Produk *</FormLabel>
                    <FormControl>
                      <Input placeholder="ELK001" {...field} />
                    </FormControl>
                    <FormDescription>
                      Kode unik untuk identifikasi produk
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nama Produk */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Produk *</FormLabel>
                    <FormControl>
                      <Input placeholder="Laptop Dell Inspiron 15" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Kategori */}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockCategories.map((category) => (
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

              {/* Satuan */}
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Satuan *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih satuan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Harga Beli */}
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Beli (Rp)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Harga Jual */}
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Jual (Rp)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stok Minimum */}
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
                      Batas minimum untuk peringatan stok
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stok Maksimum */}
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Level Reorder */}
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level Reorder</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Stok untuk trigger pemesanan ulang
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Barcode */}
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Deskripsi */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Deskripsi detail produk..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Simpan Produk' : 'Perbarui Produk'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}