"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPermissionMatrix, type PermissionMatrixEntry } from "@/lib/actions/settings"

async function fetchPermissionMatrix(): Promise<PermissionMatrixEntry[]> {
    const result = await getPermissionMatrix()
    if (result.success && result.data) return result.data
    return []
}

export function usePermissionMatrix() {
    return useQuery({
        queryKey: queryKeys.permissionMatrix.list(),
        queryFn: fetchPermissionMatrix,
    })
}
