"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getStaffTasks } from "@/lib/actions/tasks"

export function useStaffTasks() {
    return useQuery({
        queryKey: queryKeys.staffTasks.list(),
        queryFn: async () => {
            const data = await getStaffTasks()
            return data // null means profile not linked
        },
    })
}
