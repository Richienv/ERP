"use client"

import { useEffect, useCallback } from "react"

type ModifierKey = "meta" | "ctrl" | "shift" | "alt"

interface ShortcutConfig {
  key: string
  modifiers?: ModifierKey[]
  handler: (e: KeyboardEvent) => void
  /** Prevent firing when user is typing in an input/textarea */
  ignoreInputs?: boolean
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  )
}

function matchesModifiers(e: KeyboardEvent, modifiers: ModifierKey[] = []): boolean {
  const metaOrCtrl = modifiers.includes("meta") || modifiers.includes("ctrl")
  const needsMeta = metaOrCtrl ? (e.metaKey || e.ctrlKey) : false
  const needsShift = modifiers.includes("shift") ? e.shiftKey : !e.shiftKey
  const needsAlt = modifiers.includes("alt") ? e.altKey : !e.altKey

  if (metaOrCtrl && !needsMeta) return false
  if (!metaOrCtrl && (e.metaKey || e.ctrlKey)) return false
  if (!needsShift) return false
  if (!needsAlt) return false

  return true
}

/**
 * Register keyboard shortcuts.
 *
 * @example
 * // Submit form with Cmd+Enter
 * useKeyboardShortcuts([
 *   { key: "Enter", modifiers: ["meta"], handler: () => form.handleSubmit(onSubmit)() },
 * ])
 *
 * // Close dialog with Escape
 * useKeyboardShortcuts([
 *   { key: "Escape", handler: () => setOpen(false) },
 * ])
 *
 * // New item with Cmd+N (ignores when typing)
 * useKeyboardShortcuts([
 *   { key: "n", modifiers: ["meta"], handler: () => router.push("/new"), ignoreInputs: true },
 * ])
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue
        if (!matchesModifiers(e, shortcut.modifiers)) continue
        if (shortcut.ignoreInputs !== false && isInputElement(e.target)) {
          // For modified shortcuts (Cmd+X), still fire even in inputs
          // For plain shortcuts (Escape), check ignoreInputs
          if (!shortcut.modifiers?.length) continue
        }
        e.preventDefault()
        shortcut.handler(e)
        return
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
