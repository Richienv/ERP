"use client"

import { useQuery } from "@tanstack/react-query"
import { getWithholdingTaxes, getPPhSummary } from "@/lib/actions/finance-pph"

export function useWithholdingTaxes(filters?: {
  type?: string
  deposited?: boolean
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ["finance", "pph", "list", filters],
    queryFn: () => getWithholdingTaxes(filters),
  })
}

export function usePPhSummary(period?: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ["finance", "pph", "summary", period],
    queryFn: () => getPPhSummary(period),
  })
}
