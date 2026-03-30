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
    // Optimistic: add temp customer to list
    const prevCustomers = queryClient.getQueryData(queryKeys.customers.list())
    queryClient.setQueryData(queryKeys.customers.list(), (old: any) => {
      if (!old?.customers) return old
      const temp = {
        id: `temp-${Date.now()}`,
        code: data.code || '...',
        name: data.name,
        email: data.email || '',
        customerType: data.customerType || 'COMPANY',
        isActive: true,
        isProspect: false,
        creditStatus: 'NORMAL',
        totalOrderValue: 0,
        _optimistic: true,
      }
      return { ...old, customers: [temp, ...old.customers] }
    })

    try {
      const response = await fetch("/api/sales/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await response.json()
      if (!payload.success) {
        if (prevCustomers) queryClient.setQueryData(queryKeys.customers.list(), prevCustomers)
        throw new Error(payload.error || "Gagal membuat pelanggan")
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesPage.all })
      router.push("/sales/customers")
    } catch (error) {
      if (prevCustomers) queryClient.setQueryData(queryKeys.customers.list(), prevCustomers)
      throw error
    }
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
