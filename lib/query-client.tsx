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
