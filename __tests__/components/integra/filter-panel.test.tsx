/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FilterPanel } from "@/components/integra/filter-panel"

afterEach(() => {
    cleanup()
})

describe("FilterPanel", () => {
    const baseDimensions = [
        {
            type: "multi-select" as const,
            key: "status",
            label: "Status",
            options: [
                { value: "PENDING", label: "Menunggu" },
                { value: "APPROVED", label: "Disetujui" },
            ],
        },
        { type: "date-range" as const, key: "createdAt", label: "Tgl Buat" },
    ]

    it("does not render when open=false", () => {
        const { container } = render(
            <FilterPanel
                open={false}
                onClose={() => {}}
                dimensions={baseDimensions}
                values={{}}
                onChange={() => {}}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        expect(container.querySelector("[data-filter-panel]")).toBeNull()
    })

    it("renders dimensions when open", () => {
        render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={baseDimensions}
                values={{}}
                onChange={() => {}}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        expect(screen.getByText("Status")).toBeInTheDocument()
        expect(screen.getByText("Tgl Buat")).toBeInTheDocument()
    })

    it("calls onApply when apply button clicked", () => {
        const onApply = vi.fn()
        render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={baseDimensions}
                values={{ status: ["APPROVED"] }}
                onChange={() => {}}
                onApply={onApply}
                onReset={() => {}}
            />,
        )
        fireEvent.click(screen.getByText(/Terapkan/))
        expect(onApply).toHaveBeenCalled()
    })

    it("calls onReset and clears values", () => {
        const onReset = vi.fn()
        render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={baseDimensions}
                values={{ status: ["APPROVED"] }}
                onChange={() => {}}
                onApply={() => {}}
                onReset={onReset}
            />,
        )
        fireEvent.click(screen.getByText("Reset"))
        expect(onReset).toHaveBeenCalled()
    })

    it("calls onClose on ESC key", () => {
        const onClose = vi.fn()
        render(
            <FilterPanel
                open={true}
                onClose={onClose}
                dimensions={baseDimensions}
                values={{}}
                onChange={() => {}}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        fireEvent.keyDown(document, { key: "Escape" })
        expect(onClose).toHaveBeenCalled()
    })

    it("toggles multi-select option", () => {
        const onChange = vi.fn()
        render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={baseDimensions}
                values={{}}
                onChange={onChange}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        fireEvent.click(screen.getByLabelText("Disetujui"))
        expect(onChange).toHaveBeenCalledWith({ status: ["APPROVED"] })
    })
})
