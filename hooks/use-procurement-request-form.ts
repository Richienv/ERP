"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getEmployees } from "@/app/actions/hcm"

export function useProcurementRequestForm() {
    return useQuery({
        queryKey: queryKeys.procurementRequestForm.list(),
        queryFn: async () => {
            const [productsRes, employees] = await Promise.all([
                fetch("/api/inventory/page-data").then(r => r.json()),
                getEmployees({ includeInactive: false }),
            ])
            const products = (productsRes.products ?? []).map((p: any) => ({
                id: p.id,
                name: p.name,
                unit: p.unit,
                code: p.code,
                category: p.categoryName ? { name: p.categoryName } : null,
            }))
            const employeeList = (employees ?? []).map((e: any) => ({
                id: e.id,
                firstName: e.firstName,
                lastName: e.lastName,
                department: e.department,
            }))
            return { products, employees: employeeList }
        },
    })
}
