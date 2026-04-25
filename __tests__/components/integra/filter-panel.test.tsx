/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FilterPanel, type FilterDimension } from "@/components/integra/filter-panel"

afterEach(() => {
    cleanup()
})

describe("FilterPanel", () => {
    const baseDimensions: FilterDimension[] = [
        {
            type: "multi-select",
            key: "status",
            label: "Status",
            options: [
                { value: "PENDING", label: "Menunggu" },
                { value: "APPROVED", label: "Disetujui" },
            ],
        },
        { type: "date-range", key: "createdAt", label: "Tgl Buat" },
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

    it("renders date-range with two date inputs and fires onChange on edit", () => {
        const onChange = vi.fn()
        const { container } = render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={[
                    { type: "date-range", key: "createdAt", label: "Tgl Buat" },
                ]}
                values={{}}
                onChange={onChange}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        const dateInputs = container.querySelectorAll<HTMLInputElement>(
            'input[type="date"]',
        )
        expect(dateInputs).toHaveLength(2)
        fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } })
        expect(onChange).toHaveBeenCalledWith({
            createdAt: { start: "2026-01-01" },
        })
    })

    it("renders amount-range with two number inputs and fires onChange on edit", () => {
        const onChange = vi.fn()
        const { container } = render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={[
                    {
                        type: "amount-range",
                        key: "total",
                        label: "Total",
                        min: 0,
                        max: 1000000,
                    },
                ]}
                values={{}}
                onChange={onChange}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        const numberInputs = container.querySelectorAll<HTMLInputElement>(
            'input[type="number"]',
        )
        expect(numberInputs).toHaveLength(2)
        fireEvent.change(numberInputs[1], { target: { value: "500000" } })
        expect(onChange).toHaveBeenCalledWith({
            total: { max: 500000 },
        })
    })

    it("renders checkbox-group and toggles option on click", () => {
        const onChange = vi.fn()
        render(
            <FilterPanel
                open={true}
                onClose={() => {}}
                dimensions={[
                    {
                        type: "checkbox-group",
                        key: "category",
                        label: "Kategori",
                        options: [
                            { value: "A", label: "Alpha" },
                            { value: "B", label: "Beta" },
                        ],
                    },
                ]}
                values={{}}
                onChange={onChange}
                onApply={() => {}}
                onReset={() => {}}
            />,
        )
        expect(screen.getByLabelText("Alpha")).toBeInTheDocument()
        expect(screen.getByLabelText("Beta")).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText("Beta"))
        expect(onChange).toHaveBeenCalledWith({ category: ["B"] })
    })
})
