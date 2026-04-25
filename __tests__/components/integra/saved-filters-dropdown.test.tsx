/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SavedFiltersDropdown } from "@/components/integra/saved-filters-dropdown"

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

afterEach(() => {
    cleanup()
})

beforeEach(() => {
    localStorage.clear()
})

describe("SavedFiltersDropdown", () => {
    it("renders empty state when no saved filters", () => {
        render(
            <SavedFiltersDropdown
                module="test-empty"
                currentFilter={{ status: ["APPROVED"] }}
                onLoadFilter={() => {}}
            />,
        )
        expect(screen.getByText("Belum ada filter tersimpan")).toBeInTheDocument()
    })

    it("shows save input when CTA clicked", () => {
        render(
            <SavedFiltersDropdown
                module="test-cta"
                currentFilter={{ status: ["APPROVED"] }}
                onLoadFilter={() => {}}
            />,
        )
        fireEvent.click(screen.getByText(/Simpan filter saat ini/))
        expect(
            screen.getByPlaceholderText("Nama filter"),
        ).toBeInTheDocument()
    })

    it("saves filter and shows it in the list", () => {
        render(
            <SavedFiltersDropdown
                module="test-save"
                currentFilter={{ status: ["APPROVED"] }}
                onLoadFilter={() => {}}
            />,
        )
        fireEvent.click(screen.getByText(/Simpan filter saat ini/))
        const input = screen.getByPlaceholderText("Nama filter")
        fireEvent.change(input, { target: { value: "Filter A" } })
        fireEvent.click(screen.getByText("Simpan"))
        expect(screen.getByText("Filter A")).toBeInTheDocument()
    })

    it("calls onLoadFilter when filter clicked", () => {
        const onLoadFilter = vi.fn()
        // pre-seed
        localStorage.setItem(
            "integra:saved-filters:test-load",
            JSON.stringify([
                {
                    id: "x1",
                    name: "Filter A",
                    values: { status: ["APPROVED"] },
                    createdAt: 1,
                },
            ]),
        )
        render(
            <SavedFiltersDropdown
                module="test-load"
                currentFilter={{}}
                onLoadFilter={onLoadFilter}
            />,
        )
        fireEvent.click(screen.getByText("Filter A"))
        expect(onLoadFilter).toHaveBeenCalledWith({ status: ["APPROVED"] })
    })
})
