"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { LeadKanbanItem, LeadStage } from "@/components/sales/leads/lead-kanban"

interface LeadsSummary {
    totalLeads: number
    pipelineValue: number
    hotLeads: number
    statusCounts: Record<string, number>
}

interface LeadsResponse {
    success: boolean
    data: LeadKanbanItem[]
    summary?: LeadsSummary
    error?: string
}

export type { LeadsSummary }

const emptySummary: LeadsSummary = {
    totalLeads: 0,
    pipelineValue: 0,
    hotLeads: 0,
    statusCounts: {},
}

async function fetchLeads(): Promise<{ leads: LeadKanbanItem[]; summary: LeadsSummary }> {
    const response = await fetch("/api/sales/leads")
    const payload: LeadsResponse = await response.json()
    if (!payload.success) throw new Error(payload.error || "Failed to load leads")
    return {
        leads: payload.data || [],
        summary: payload.summary || emptySummary,
    }
}

export function useLeads() {
    return useQuery({
        queryKey: queryKeys.leads.list(),
        queryFn: fetchLeads,
    })
}

export function useLeadStatusMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStage }) => {
            const response = await fetch(`/api/sales/leads/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const payload = await response.json()
            if (!payload.success) throw new Error(payload.error || "Gagal mengubah status lead")
            return payload
        },
        // Optimistic update: move lead to new column instantly
        onMutate: async ({ leadId, status }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.leads.list() })
            const previous = queryClient.getQueryData<{ leads: LeadKanbanItem[]; summary: LeadsSummary }>(queryKeys.leads.list())

            if (previous) {
                queryClient.setQueryData(queryKeys.leads.list(), {
                    ...previous,
                    leads: previous.leads.map((lead) =>
                        lead.id === leadId ? { ...lead, status } : lead
                    ),
                })
            }

            return { previous }
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.leads.list(), context.previous)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.salesPage.all })
        },
    })
}
