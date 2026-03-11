"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export const WORKING_HOURS_KEY = "manufacturing.workingHoursPerMonth"
export const DEFAULT_WORKING_HOURS = 172

export function useWorkingHours() {
    const { data } = useQuery({
        queryKey: ["system-setting", WORKING_HOURS_KEY],
        queryFn: async () => {
            const res = await fetch(`/api/system/settings?key=${WORKING_HOURS_KEY}`)
            const json = await res.json()
            const parsed = parseInt(json.value ?? "", 10)
            return isNaN(parsed) || parsed < 1 ? DEFAULT_WORKING_HOURS : parsed
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — rarely changes
    })
    return data ?? DEFAULT_WORKING_HOURS
}

export function useSaveWorkingHours() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (hours: number) => {
            const res = await fetch("/api/system/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: WORKING_HOURS_KEY,
                    value: String(hours),
                    description: "Jam kerja standar per bulan (UU Ketenagakerjaan)",
                }),
            })
            if (!res.ok) throw new Error("Gagal menyimpan pengaturan")
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["system-setting", WORKING_HOURS_KEY] })
        },
    })
}
