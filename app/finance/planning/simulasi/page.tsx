"use client"

import { useState, useCallback, useEffect } from "react"
import { usePlanningContext } from "../layout"
import { useCashflowPlan } from "@/hooks/use-cashflow-plan"
import { useCashflowScenarios, useCashflowScenario, useCreateScenario, useSaveScenario, useDeleteScenario } from "@/hooks/use-cashflow-scenarios"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { CashflowSimulasiSidebar } from "@/components/finance/cashflow-simulasi-sidebar"
import { CashflowSimulasiBoard } from "@/components/finance/cashflow-simulasi-board"
import { CashflowSubpageSkeleton } from "@/components/finance/cashflow-planning-skeleton"
import type { ScenarioConfig } from "@/lib/actions/finance-cashflow"

export default function SimulasiPage() {
    const { month, year } = usePlanningContext()
    const { data, isLoading } = useCashflowPlan(month, year, true)
    const { data: scenarios = [] } = useCashflowScenarios(month, year)
    const { data: forecast } = useCashflowForecast(6)
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
    const { data: activeScenario } = useCashflowScenario(activeScenarioId)

    const createMutation = useCreateScenario(month, year)
    const saveMutation = useSaveScenario()
    const deleteMutation = useDeleteScenario(month, year)

    // Local simulation state
    const [disabledSources, setDisabledSources] = useState<string[]>([])
    const [itemStates, setItemStates] = useState<Record<string, { enabled: boolean; overrideAmount: number | null }>>({})

    // Sync scenario config → local state when scenario loads
    useEffect(() => {
        if (activeScenario?.config) {
            setDisabledSources(activeScenario.config.disabledSources || [])
            setItemStates(activeScenario.config.items || {})
        } else if (!activeScenarioId) {
            setDisabledSources([])
            setItemStates({})
        }
    }, [activeScenario, activeScenarioId])

    const handleToggleSource = useCallback((source: string) => {
        setDisabledSources(prev =>
            prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
        )
    }, [])

    const handleToggleItem = useCallback((id: string, enabled: boolean) => {
        setItemStates(prev => ({
            ...prev,
            [id]: { enabled, overrideAmount: prev[id]?.overrideAmount ?? null },
        }))
    }, [])

    const handleAmountChange = useCallback((id: string, amount: number) => {
        setItemStates(prev => ({
            ...prev,
            [id]: { enabled: prev[id]?.enabled ?? true, overrideAmount: amount },
        }))
    }, [])

    const handleSave = useCallback(() => {
        if (!activeScenarioId || !data) return
        // Calculate totals from current state for the scenario summary
        const allItems = [...(data.autoItems || []), ...(data.manualItems || [])]
        const filtered = allItems.filter(item => !disabledSources.includes(item.category))
        let totalIn = 0, totalOut = 0
        for (const item of filtered) {
            const state = itemStates[item.id]
            const enabled = state?.enabled ?? true
            if (!enabled) continue
            const amt = state?.overrideAmount ?? item.amount
            if (item.direction === "IN") totalIn += amt
            else totalOut += amt
        }
        saveMutation.mutate({
            id: activeScenarioId,
            config: { disabledSources, items: itemStates } as ScenarioConfig,
            totalIn,
            totalOut,
            netFlow: totalIn - totalOut,
        })
    }, [activeScenarioId, disabledSources, itemStates, saveMutation, data])

    const handleDeleteScenario = useCallback((id: string) => {
        deleteMutation.mutate(id)
        if (activeScenarioId === id) {
            setActiveScenarioId(null)
        }
    }, [deleteMutation, activeScenarioId])

    if (isLoading || !data) return <CashflowSubpageSkeleton variant="simulasi" />

    return (
        <div className="flex gap-0 border-2 border-black rounded-xl overflow-hidden mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ minHeight: "70vh" }}>
            <CashflowSimulasiSidebar
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                disabledSources={disabledSources}
                onSelectScenario={setActiveScenarioId}
                onCreateScenario={(name) => createMutation.mutate(name)}
                onRenameScenario={(id, name) => saveMutation.mutate({ id, name })}
                onDeleteScenario={handleDeleteScenario}
                onToggleSource={handleToggleSource}
            />
            <CashflowSimulasiBoard
                data={data}
                forecast={forecast}
                disabledSources={disabledSources}
                itemStates={itemStates}
                onToggleItem={handleToggleItem}
                onAmountChange={handleAmountChange}
                onSave={handleSave}
                isSaving={saveMutation.isPending}
                hasActiveScenario={!!activeScenarioId}
            />
        </div>
    )
}
