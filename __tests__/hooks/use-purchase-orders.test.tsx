/** @vitest-environment jsdom */
import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { usePurchaseOrders } from "@/hooks/use-purchase-orders"
import { getAllPurchaseOrders } from "@/lib/actions/procurement"

vi.mock("@/lib/actions/procurement", () => ({
    getAllPurchaseOrders: vi.fn().mockResolvedValue([]),
    getVendors: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/app/actions/purchase-order", () => ({
    getProductsForPO: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/actions/grn", () => ({
    getWarehousesForGRN: vi.fn().mockResolvedValue([]),
}))

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return { queryClient, wrapper }
}

describe("usePurchaseOrders", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("includes filter in queryKey when filter is provided", async () => {
        const { queryClient, wrapper } = makeWrapper()
        const filter = { status: ["APPROVED"] }
        renderHook(() => usePurchaseOrders(filter), { wrapper })

        await waitFor(() => {
            const cache = queryClient.getQueryCache().findAll()
            expect(
                cache.some((q) =>
                    JSON.stringify(q.queryKey).includes("APPROVED"),
                ),
            ).toBe(true)
        })
    })

    it("forwards filter to getAllPurchaseOrders", async () => {
        const { wrapper } = makeWrapper()
        const filter = {
            status: ["PO_DRAFT"],
            vendorIds: ["vendor-1"],
            search: "PO-001",
        }
        renderHook(() => usePurchaseOrders(filter), { wrapper })

        await waitFor(() => {
            expect(getAllPurchaseOrders).toHaveBeenCalledWith(filter)
        })
    })

    it("uses base queryKey (no filter suffix) when filter is undefined", async () => {
        const { queryClient, wrapper } = makeWrapper()
        renderHook(() => usePurchaseOrders(), { wrapper })

        await waitFor(() => {
            const cache = queryClient.getQueryCache().findAll()
            // base key length is 2: ["purchaseOrders", "list"]
            expect(cache.some((q) => q.queryKey.length === 2)).toBe(true)
        })
    })
})
