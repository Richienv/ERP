"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

import { Toaster } from "@/components/ui/sonner"
import { AIProvider } from "@/components/ai/ai-context"
import { AISidebar } from "@/components/ai/ai-sidebar"
import { SiteHeader } from "@/components/site-header"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AuthProvider } from "@/lib/auth-context"
import { RouteGuard } from "@/components/route-guard"
import { PageTransition } from "@/components/page-transition"
import { OfflineIndicator } from "@/components/offline-indicator"
import { BackgroundRefresh } from "@/components/background-refresh"
import { RealtimeProvider } from "@/components/realtime-provider"
import { RouteProgress } from "@/components/route-progress"

// Lazy-load non-critical shell components — these don't affect first paint
const CommandPalette = dynamic(() => import("@/components/command-palette").then(m => ({ default: m.CommandPalette })), { ssr: false })
const ShortcutCheatSheet = dynamic(() => import("@/components/shortcut-cheat-sheet").then(m => ({ default: m.ShortcutCheatSheet })), { ssr: false })
const PerformanceTracker = dynamic(() => import("@/components/performance-tracker").then(m => ({ default: m.PerformanceTracker })), { ssr: false })
const ServiceWorkerRegister = dynamic(() => import("@/components/service-worker-register").then(m => ({ default: m.ServiceWorkerRegister })), { ssr: false })

interface GlobalLayoutProps {
  children: React.ReactNode
}

const AUTH_PAGES = new Set(["/login", "/signup", "/forgot-password", "/auth/callback"])

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = AUTH_PAGES.has(pathname)

  return (
    <AuthProvider>
      <AIProvider>
        <RouteProgress />
        <RouteGuard>
          {isAuthPage ? (
            <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
              {children}
              <Toaster />
            </main>
          ) : (
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="max-h-svh overflow-hidden">
                <SiteHeader />
                <div className="flex-1 overflow-auto p-4 pt-0 gap-4 flex flex-col">
                  <PageTransition>
                    {children}
                  </PageTransition>
                </div>
                <AISidebar />
                <Toaster />
              </SidebarInset>
            </SidebarProvider>
          )}
        </RouteGuard>
        <OfflineIndicator />
        <BackgroundRefresh />
        <RealtimeProvider />
        <ServiceWorkerRegister />
        <PerformanceTracker />
        <CommandPalette />
        <ShortcutCheatSheet />
      </AIProvider>
    </AuthProvider >
  )
}
