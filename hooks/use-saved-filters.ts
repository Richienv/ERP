"use client"

import * as React from "react"

export type SavedFilter<T = unknown> = {
    id: string
    name: string
    values: T
    createdAt: number
}

function generateId(): string {
    if (
        typeof globalThis.crypto !== "undefined" &&
        typeof globalThis.crypto.randomUUID === "function"
    ) {
        return globalThis.crypto.randomUUID()
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useSavedFilters<T = unknown>(module: string) {
    const key = `integra:saved-filters:${module}`

    const [filters, setFilters] = React.useState<SavedFilter<T>[]>(() => {
        if (typeof window === "undefined") return []
        try {
            const raw = window.localStorage.getItem(key)
            if (!raw) return []
            const parsed = JSON.parse(raw) as unknown
            return Array.isArray(parsed) ? (parsed as SavedFilter<T>[]) : []
        } catch {
            return []
        }
    })

    const persist = React.useCallback(
        (next: SavedFilter<T>[]): Error | null => {
            try {
                window.localStorage.setItem(key, JSON.stringify(next))
                setFilters(next)
                return null
            } catch (e) {
                return e instanceof Error ? e : new Error("Save failed")
            }
        },
        [key],
    )

    const save = React.useCallback(
        (name: string, values: T): Error | null => {
            const entry: SavedFilter<T> = {
                id: generateId(),
                name,
                values,
                createdAt: Date.now(),
            }
            return persist([...filters, entry])
        },
        [filters, persist],
    )

    const remove = React.useCallback(
        (id: string): Error | null => {
            return persist(filters.filter((f) => f.id !== id))
        },
        [filters, persist],
    )

    return { filters, save, remove }
}
