"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getManagerTasks,
    getDepartmentEmployees,
    getAssignableOrders,
    getManagerDashboardStats,
} from "@/lib/actions/tasks"

export function useManagerDashboard() {
    return useQuery({
        queryKey: queryKeys.managerDashboard.list(),
        queryFn: async () => {
            // Sequential to avoid exhausting Supabase session-mode connection pool
            const tasks = await getManagerTasks()
            const employees = await getDepartmentEmployees()
            const orders = await getAssignableOrders()
            const dashboard = await getManagerDashboardStats()
            return { tasks, employees, orders, dashboard }
        },
    })
}
