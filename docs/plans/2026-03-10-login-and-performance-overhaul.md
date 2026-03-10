# Login & Performance Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix login security vulnerabilities, redesign the login page, eliminate the blocking cache-warming overlay, and apply targeted performance optimizations across the app shell.

**Architecture:** Remove plaintext password storage entirely. Replace the blocking cache-warming overlay with silent background prefetching (no full-screen takeover). Add a loading skeleton to the route guard. Strip devtools from production builds. Reduce Google Font count from 4 to 2.

**Tech Stack:** Next.js 16, React 19, TanStack Query, Supabase Auth, Tailwind CSS v4, framer-motion

---

### Task 1: Fix Login Security — Remove Plaintext Password from localStorage

**Files:**
- Modify: `app/login/page.tsx:36-46` (load saved credentials)
- Modify: `app/login/page.tsx:71-80` (save credentials)

**Step 1: Remove password storage, keep only email in "Remember Me"**

In `app/login/page.tsx`, replace the credential loading useEffect (lines 36-46):

```tsx
// Load saved email on component mount
useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail')
    const savedRememberMe = localStorage.getItem('rememberMe')

    if (savedEmail && savedRememberMe === 'true') {
        setEmail(savedEmail)
        setRememberMe(true)
    }
}, [])
```

**Step 2: Update credential saving logic (lines 71-80)**

Replace the save/clear block inside `handleLogin`:

```tsx
// Save email only if "Remember Me" is checked (never store passwords)
if (rememberMe) {
    localStorage.setItem('rememberedEmail', email)
    localStorage.setItem('rememberMe', 'true')
} else {
    localStorage.removeItem('rememberedEmail')
    localStorage.removeItem('rememberMe')
}
// Always clean up any legacy password storage
localStorage.removeItem('rememberPassword')
```

**Step 3: Verify login still works**

Run: `npm run dev` → go to `/login` → login with "Ingat Saya" checked → logout → verify email is pre-filled but password is empty.

**Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "fix(security): remove plaintext password storage from localStorage"
```

---

### Task 2: Route Guard — Show Skeleton Instead of Blank Screen

**Files:**
- Modify: `components/route-guard.tsx:145-148`

**Step 1: Replace `return null` with a lightweight loading skeleton**

In `components/route-guard.tsx`, replace lines 145-148:

```tsx
// While auth is loading on non-public routes, show loading skeleton
if (isLoading && !PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-500 font-medium">Memuat...</p>
            </div>
        </div>
    )
}
```

**Step 2: Verify**

Run: `npm run dev` → hard refresh any protected route → should see spinner briefly instead of blank white screen.

**Step 3: Commit**

```bash
git add components/route-guard.tsx
git commit -m "fix(ux): show loading spinner in route guard instead of blank screen"
```

---

### Task 3: Make Cache Warming Non-Blocking (Background Only)

The current `CacheWarmingOverlay` shows a full-screen blocker after login. Users can't interact until all 55+ routes finish prefetching. We'll replace this with silent background warming — no overlay at all.

**Files:**
- Modify: `components/cache-warming-overlay.tsx` → gut the overlay UI, keep only background warming
- Modify: `components/global-layout.tsx:59` → simplify the component reference

**Step 1: Replace CacheWarmingOverlay with a silent background warmer**

Rewrite `components/cache-warming-overlay.tsx`:

```tsx
"use client"

import { useEffect, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"

const SESSION_KEY = "erp_cache_warmed"

/**
 * Silent background cache warmer. No UI overlay.
 * Prefetches priority routes first, then remaining in batches.
 * Only runs once per login (tracked via sessionStorage).
 */
export function CacheWarmingOverlay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const hasStarted = useRef(false)

    const warmCache = useCallback(async () => {
        // Priority: dashboard + the routes users visit most
        const PRIORITY = [
            "/dashboard",
            "/inventory/products",
            "/sales/customers",
            "/sales/orders",
            "/finance",
        ]

        const entries = Object.entries(routePrefetchMap)
        const priorityEntries = entries.filter(([r]) => PRIORITY.includes(r))
        const restEntries = entries.filter(([r]) => !PRIORITY.includes(r))

        // Phase 1: priority routes (immediate, batch of 3)
        const BATCH = 3
        for (let i = 0; i < priorityEntries.length; i += BATCH) {
            const batch = priorityEntries.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map(([, config]) =>
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                )
            )
        }

        // Phase 2: remaining routes (delayed, batch of 3, 200ms gap)
        for (let i = 0; i < restEntries.length; i += BATCH) {
            const batch = restEntries.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map(([, config]) =>
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                )
            )
            if (i + BATCH < restEntries.length) {
                await new Promise((r) => setTimeout(r, 200))
            }
        }

        sessionStorage.setItem(SESSION_KEY, "true")
    }, [queryClient])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) return
        hasStarted.current = true

        // Delay start by 1s so the first page render isn't competing for network
        const timer = setTimeout(() => {
            warmCache()
        }, 1000)

        return () => clearTimeout(timer)
    }, [authLoading, isAuthenticated, warmCache])

    return null // No UI — completely silent
}
```

**Step 2: Verify**

Run: `npm run dev` → login → should go straight to dashboard with NO overlay. Open Network tab → after ~1s, background fetches should start trickling in.

**Step 3: Commit**

```bash
git add components/cache-warming-overlay.tsx
git commit -m "perf: replace blocking cache-warming overlay with silent background prefetch"
```

---

### Task 4: Remove ReactQueryDevtools from Production

**Files:**
- Modify: `lib/query-client.tsx:2,46`

**Step 1: Lazy-load devtools only in development**

Replace `lib/query-client.tsx`:

```tsx
"use client"

import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { useState, type ReactNode, lazy, Suspense } from "react"

const ReactQueryDevtools =
    process.env.NODE_ENV === "development"
        ? lazy(() =>
              import("@tanstack/react-query-devtools").then((mod) => ({
                  default: mod.ReactQueryDevtools,
              }))
          )
        : null

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 60 * 1000,
                gcTime: 60 * 60 * 1000,
                retry: 1,
                refetchOnWindowFocus: false,
                placeholderData: keepPreviousData,
                refetchOnMount: true,
                networkMode: "offlineFirst",
            },
            mutations: {
                retry: 2,
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
                networkMode: "offlineFirst",
            },
        },
    })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
    if (typeof window === "undefined") {
        return makeQueryClient()
    }
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(getQueryClient)

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {ReactQueryDevtools && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
                </Suspense>
            )}
        </QueryClientProvider>
    )
}
```

**Step 2: Verify**

Run: `npm run build` → production bundle should NOT include devtools chunk. Dev mode should still show devtools.

**Step 3: Commit**

```bash
git add lib/query-client.tsx
git commit -m "perf: lazy-load ReactQueryDevtools only in development"
```

---

### Task 5: Reduce Font Downloads (4 → 2)

**Files:**
- Modify: `app/layout.tsx`

The app loads 4 Google Fonts: Geist, Geist Mono, Outfit, Playfair Display. Geist Mono is rarely used (code blocks only). Playfair Display is used only on the login page title. We'll keep Geist (primary sans) and Outfit (headings), drop the other two.

**Step 1: Remove Geist_Mono and Playfair_Display**

In `app/layout.tsx`, replace the font imports and body class:

```tsx
import type { Metadata } from "next";
import { Geist, Outfit } from "next/font/google";
import { GlobalLayout } from "@/components/global-layout";
import { ThemeProvider } from "next-themes";
import { WorkflowConfigProvider } from "@/components/workflow/workflow-config-context";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem ERP Darren Raymon",
  description: "Sistem Perencanaan Sumber Daya Perusahaan (ERP) Darren Raymon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${outfit.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="ritchie-minimal"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "claude", "autumn", "earth", "ritchie", "ritchie-minimal"]}
        >
          <QueryProvider>
            <WorkflowConfigProvider>
              <GlobalLayout>{children}</GlobalLayout>
            </WorkflowConfigProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 2: Update CSS font-family fallbacks**

In `app/globals.css`, update the `--font-mono` and `--font-serif` lines in the `@theme` block:

```css
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
--font-serif: var(--font-outfit);
```

**Step 3: Update login page to use Outfit instead of Playfair for the title**

In `app/login/page.tsx`, change the `<h1>` class from `font-serif` to `font-heading`:

```tsx
<h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight text-black">
```

**Step 4: Verify**

Run: `npm run dev` → check Network tab → should see only 2 font files downloading (Geist, Outfit) instead of 4. Login page title should still look good with Outfit.

**Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css app/login/page.tsx
git commit -m "perf: reduce Google Fonts from 4 to 2 (drop Geist Mono, Playfair)"
```

---

### Task 6: Redesign Login Page

**Files:**
- Modify: `app/login/page.tsx`

Use the `/frontend-design` skill to create a polished, distinctive login page. Requirements:
- Keep all existing functionality (email/password, remember me, forgot password, Google stub)
- Neo-brutalist style consistent with the rest of the app (`border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`)
- Bahasa Indonesia labels
- Mobile responsive
- Fast — no heavy animations or large images
- Show tenant branding if available
- Use `font-heading` (Outfit) for the main title

**Step 1: Invoke `/frontend-design` skill and redesign the login page**

The designer should create a visually distinctive login that:
- Has a two-column layout on desktop (branding left, form right) or a single centered card
- Uses the `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]` neo-brutalist card style
- Has a subtle background pattern or gradient (CSS-only, no images)
- Maintains all existing fields and logic from Task 1 fixes
- Removes the non-functional Google button OR makes it visually secondary

**Step 2: Verify**

Run: `npm run dev` → go to `/login` → verify design looks polished on both mobile and desktop. Test login flow end-to-end.

**Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(ui): redesign login page with neo-brutalist style"
```

---

### Task 7: Reduce Prefetch Batch Size to Prevent Connection Pool Exhaustion

**Files:**
- Modify: `hooks/use-nav-prefetch.ts:310-318` (the `/manager` route runs 4 serial server actions)

**Step 1: Fix the `/manager` prefetch to use Promise.all instead of serial calls**

Replace lines 310-318:

```tsx
"/manager": {
    queryKey: queryKeys.managerDashboard.list(),
    queryFn: async () => {
        const [tasks, employees, orders, dashboard] = await Promise.all([
            getManagerTasks(),
            getDepartmentEmployees(),
            getAssignableOrders(),
            getManagerDashboardStats(),
        ])
        return { tasks, employees, orders, dashboard }
    },
},
```

**Step 2: Commit**

```bash
git add hooks/use-nav-prefetch.ts
git commit -m "perf: parallelize manager dashboard prefetch queries"
```

---

## Summary of Changes

| Task | What | Impact |
|------|------|--------|
| 1 | Remove plaintext password from localStorage | **Security fix** — eliminates credential leak |
| 2 | Route guard loading skeleton | **UX** — no more blank screen during auth check |
| 3 | Silent background cache warming | **UX** — instant access after login, no blocking overlay |
| 4 | Lazy-load devtools | **Bundle size** — ~50KB removed from production |
| 5 | Reduce fonts 4→2 | **Load time** — ~200KB fewer font downloads |
| 6 | Redesign login page | **Design** — polished, distinctive login |
| 7 | Parallelize manager prefetch | **Perf** — faster prefetch, less pool contention |
