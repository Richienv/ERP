"use client"

import { useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { breadcrumbLabels } from "@/lib/sidebar-nav-data"

const STORAGE_KEY = "erp_page_visits"
const MAX_ENTRIES = 50

interface PageVisit {
  count: number
  lastVisit: number
}

type VisitMap = Record<string, PageVisit>

const IGNORED_PATHS = ["/", "/login", "/signup", "/forgot-password", "/auth"]

function getVisitMap(): VisitMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveVisitMap(map: VisitMap) {
  try {
    // Evict least-used entries if over limit
    const entries = Object.entries(map)
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => a[1].count - b[1].count)
      const trimmed = entries.slice(entries.length - MAX_ENTRIES)
      map = Object.fromEntries(trimmed)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

function getLabel(url: string): string {
  const segments = url.split("/").filter(Boolean)
  if (segments.length === 0) return url
  // Use last meaningful segment for label
  const last = segments[segments.length - 1]
  // Skip ID-like segments
  if (/^[0-9a-f]{8}-|^\d+$|^[a-z0-9]{20,}$/i.test(last) && segments.length > 1) {
    const parent = segments[segments.length - 2]
    return breadcrumbLabels[parent] || parent
  }
  return breadcrumbLabels[last] || last
}

export interface PageHistoryItem {
  url: string
  label: string
  count: number
  lastVisit: number
}

export function usePageHistory() {
  const pathname = usePathname()

  // Track current page visit
  useEffect(() => {
    if (!pathname || IGNORED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return
    // Skip detail/ID pages — only track list/dashboard pages
    const segments = pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1]
    if (/^[0-9a-f]{8}-|^\d+$|^[a-z0-9]{20,}$/i.test(last)) return

    const map = getVisitMap()
    const existing = map[pathname] || { count: 0, lastVisit: 0 }
    map[pathname] = {
      count: existing.count + 1,
      lastVisit: Date.now(),
    }
    saveVisitMap(map)
  }, [pathname])

  const getFrequentPages = useCallback((limit = 5): PageHistoryItem[] => {
    const map = getVisitMap()
    return Object.entries(map)
      .filter(([, v]) => v.count >= 2) // Only show if visited at least twice
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([url, v]) => ({
        url,
        label: getLabel(url),
        count: v.count,
        lastVisit: v.lastVisit,
      }))
  }, [])

  const getRecentPages = useCallback((limit = 5): PageHistoryItem[] => {
    const map = getVisitMap()
    return Object.entries(map)
      .sort((a, b) => b[1].lastVisit - a[1].lastVisit)
      .slice(0, limit)
      .map(([url, v]) => ({
        url,
        label: getLabel(url),
        count: v.count,
        lastVisit: v.lastVisit,
      }))
  }, [])

  return { getFrequentPages, getRecentPages }
}
