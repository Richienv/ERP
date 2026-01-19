"use client"

import { usePathname } from "next/navigation"

import { Toaster } from "@/components/ui/sonner"
import { AIProvider } from "@/components/ai/ai-context"
import { AIFloatingButton } from "@/components/ai/ai-floating-button"
import { AISidebar } from "@/components/ai/ai-sidebar"
import { SiteHeader } from "@/components/site-header"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AuthProvider } from "@/lib/auth-context"
import { RouteGuard } from "@/components/route-guard"

interface GlobalLayoutProps {
  children: React.ReactNode
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/auth/callback"].includes(pathname)

  return (
    <AuthProvider>
      <AIProvider>
        <RouteGuard>
          {isAuthPage ? (
            <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
              {children}
              <Toaster />
            </main>
          ) : (
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <div className="flex min-h-screen flex-col bg-background">
                  <SiteHeader />
                  <div className="flex-1 flex flex-col">
                    <main className="flex-1">
                      {children}
                    </main>
                  </div>
                  <AIFloatingButton />
                  <AISidebar />
                  <Toaster />
                </div>
              </SidebarInset>
            </SidebarProvider>
          )}
        </RouteGuard>
      </AIProvider>
    </AuthProvider>
  )
}