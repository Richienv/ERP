"use client"

import { useRouter } from "next/navigation"
import { ProductForm } from "@/components/inventory/product-form"
import { type CreateProductInput } from "@/lib/validations"

export default function NewProductPage() {
  const router = useRouter()

  const handleSubmit = async (data: CreateProductInput) => {
    // Here you would typically call your API
    console.log("Creating product:", data)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Redirect to products list
    router.push("/inventory/products")
  }

  const handleCancel = () => {
    router.push("/inventory/products")
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <ProductForm 
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}