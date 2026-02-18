"use client"

import { useRouter } from "next/navigation"
import { ProductForm } from "@/components/inventory/product-form"
import { type CreateProductInput } from "@/lib/validations"
import { createProduct } from "@/app/actions/inventory"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

export default function NewProductPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: CreateProductInput) => {
    const result = await createProduct(data)
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
      router.push("/inventory/products")
    } else {
      throw new Error((result as any).error || "Gagal membuat produk")
    }
  }

  const handleCancel = () => {
    router.push("/inventory/products")
  }

  return (
    <div className="mf-page">
      <ProductForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}
