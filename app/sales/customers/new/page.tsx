"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CustomerForm } from "@/components/sales/customer-form"
import type { CreateCustomerInput } from "@/lib/validations"

export default function NewCustomerPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: CreateCustomerInput) => {
    const response = await fetch("/api/sales/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const payload = await response.json()
    if (!payload.success) {
      throw new Error(payload.error || "Gagal membuat pelanggan")
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.salesPage.all })
    router.push("/sales/customers")
  }

  return (
    <div className="mf-page">
      <CustomerForm
        onSubmit={handleSubmit}
        onCancel={() => router.push("/sales/customers")}
      />
    </div>
  )
}
