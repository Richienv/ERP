"use client"

import { useEffect, useRef, useCallback } from "react"
import type { BOMItem, BOMStep } from "../bom-canvas-context"

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export interface DraftState {
  items: BOMItem[]
  steps: BOMStep[]
  totalQty: number
  savedAt: number // Date.now()
}

export function isDraftNewer(draftTimestamp: number, serverUpdatedAt: Date): boolean {
  return draftTimestamp > serverUpdatedAt.getTime()
}

export function serializeDraft(draft: DraftState): string {
  return JSON.stringify(draft)
}

export function deserializeDraft(raw: string): DraftState | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.totalQty === "number" && Array.isArray(parsed.items)) {
      return parsed as DraftState
    }
    return null
  } catch {
    return null
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseAutoSaveOptions {
  bomId: string
  items: BOMItem[]
  steps: BOMStep[]
  totalQty: number
  isDirty: boolean
  debounceMs?: number
}

export function useAutoSave({
  bomId,
  items,
  steps,
  totalQty,
  isDirty,
  debounceMs = 30_000,
}: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftKey = `bom-draft-${bomId}`

  const saveDraftLocally = useCallback(() => {
    if (!isDirty) return
    try {
      const draft: DraftState = { items, steps, totalQty, savedAt: Date.now() }
      localStorage.setItem(draftKey, serializeDraft(draft))
    } catch {
      // localStorage may be unavailable
    }
  }, [draftKey, items, steps, totalQty, isDirty])

  // Debounced auto-save on dirty change
  useEffect(() => {
    if (!isDirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(saveDraftLocally, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty, saveDraftLocally, debounceMs])

  // Save on page unload if dirty
  useEffect(() => {
    const handler = () => { if (isDirty) saveDraftLocally() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty, saveDraftLocally])

  const loadLocalDraft = useCallback((): DraftState | null => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      return deserializeDraft(raw)
    } catch {
      return null
    }
  }, [draftKey])

  const clearLocalDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey) } catch {}
  }, [draftKey])

  return { loadLocalDraft, clearLocalDraft }
}
