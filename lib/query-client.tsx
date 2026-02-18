"use client"

import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState, type ReactNode } from "react"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 60 * 1000,  // 30 minutes — SAP-style: long TTL, invalidate on write
                gcTime: 60 * 60 * 1000,     // 60 minutes — cache kept in memory for session
                retry: 1,
                refetchOnWindowFocus: false, // ERP data doesn't change that fast
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
        // Server: always make a new client
        return makeQueryClient()
    }
    // Browser: reuse singleton
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(getQueryClient)

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </QueryClientProvider>
    )
}
