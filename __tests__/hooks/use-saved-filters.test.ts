/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSavedFilters } from "@/hooks/use-saved-filters"

describe("useSavedFilters", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("starts with empty list", () => {
        const { result } = renderHook(() => useSavedFilters("test"))
        expect(result.current.filters).toEqual([])
    })

    it("saves new filter", () => {
        const { result } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("test"),
        )
        act(() => {
            result.current.save("Filter A", { status: ["APPROVED"] })
        })
        expect(result.current.filters).toHaveLength(1)
        expect(result.current.filters[0].name).toBe("Filter A")
        expect(result.current.filters[0].values).toEqual({ status: ["APPROVED"] })
        expect(result.current.filters[0].id).toBeTypeOf("string")
        expect(result.current.filters[0].createdAt).toBeTypeOf("number")
    })

    it("persists to localStorage", () => {
        const { result } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("test"),
        )
        act(() => {
            result.current.save("Filter A", { status: ["APPROVED"] })
        })
        const raw = localStorage.getItem("integra:saved-filters:test")
        expect(raw).not.toBeNull()
        const parsed = JSON.parse(raw!) as Array<{ name: string }>
        expect(parsed[0].name).toBe("Filter A")
    })

    it("hydrates from localStorage on mount", () => {
        const seed = [
            {
                id: "x1",
                name: "Existing",
                values: { status: ["DRAFT"] },
                createdAt: 1234567890,
            },
        ]
        localStorage.setItem(
            "integra:saved-filters:test",
            JSON.stringify(seed),
        )
        const { result } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("test"),
        )
        expect(result.current.filters).toHaveLength(1)
        expect(result.current.filters[0].name).toBe("Existing")
    })

    it("deletes filter by id", () => {
        const { result } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("test"),
        )
        act(() => {
            result.current.save("Filter A", { status: ["APPROVED"] })
        })
        const id = result.current.filters[0].id
        act(() => {
            result.current.remove(id)
        })
        expect(result.current.filters).toEqual([])
    })

    it("returns error on quota exceeded", () => {
        const setSpy = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(() => {
                throw new Error("QuotaExceededError")
            })
        const { result } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("test"),
        )
        let err: Error | null = null
        act(() => {
            err = result.current.save("Filter A", { status: ["APPROVED"] })
        })
        expect(err).not.toBeNull()
        expect(err).toBeInstanceOf(Error)
        setSpy.mockRestore()
    })

    it("scopes filters per module key", () => {
        const { result: rA } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("moduleA"),
        )
        const { result: rB } = renderHook(() =>
            useSavedFilters<{ status: string[] }>("moduleB"),
        )
        act(() => {
            rA.current.save("Hanya A", { status: ["APPROVED"] })
        })
        // moduleB should NOT see moduleA's filter
        expect(rB.current.filters).toEqual([])
    })
})
