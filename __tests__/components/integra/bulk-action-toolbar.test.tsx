/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BulkActionToolbar, type BulkAction } from "@/components/integra/bulk-action-toolbar"

afterEach(() => {
    cleanup()
})

describe("BulkActionToolbar", () => {
    const baseActions: BulkAction[] = [
        { label: "Setujui", onClick: vi.fn(), variant: "primary" },
        { label: "Tolak", onClick: vi.fn(), variant: "danger", confirm: "Yakin tolak?" },
    ]

    it("hidden when selectedCount=0", () => {
        const { container } = render(
            <BulkActionToolbar
                selectedCount={0}
                totalCount={10}
                onSelectAll={() => {}}
                onClearSelection={() => {}}
                actions={baseActions}
            />,
        )
        expect(container.querySelector("[data-bulk-toolbar]")).toBeNull()
    })

    it("visible when selectedCount>0", () => {
        render(
            <BulkActionToolbar
                selectedCount={3}
                totalCount={10}
                onSelectAll={() => {}}
                onClearSelection={() => {}}
                actions={baseActions}
            />,
        )
        expect(screen.getByText(/3 dipilih dari 10/)).toBeInTheDocument()
    })

    it("calls onSelectAll", () => {
        const onSelectAll = vi.fn()
        render(
            <BulkActionToolbar
                selectedCount={3}
                totalCount={10}
                onSelectAll={onSelectAll}
                onClearSelection={() => {}}
                actions={baseActions}
            />,
        )
        fireEvent.click(screen.getByText("Pilih semua"))
        expect(onSelectAll).toHaveBeenCalled()
    })

    it("calls action onClick when no confirm", () => {
        const onClick = vi.fn()
        const actions: BulkAction[] = [
            { label: "Setujui", onClick, variant: "primary" },
        ]
        render(
            <BulkActionToolbar
                selectedCount={3}
                totalCount={10}
                onSelectAll={() => {}}
                onClearSelection={() => {}}
                actions={actions}
            />,
        )
        fireEvent.click(screen.getByText("Setujui"))
        expect(onClick).toHaveBeenCalled()
    })

    it("shows confirm dialog when action has confirm prop", () => {
        render(
            <BulkActionToolbar
                selectedCount={3}
                totalCount={10}
                onSelectAll={() => {}}
                onClearSelection={() => {}}
                actions={baseActions}
            />,
        )
        fireEvent.click(screen.getByText("Tolak"))
        expect(screen.getByText("Yakin tolak?")).toBeInTheDocument()
    })

    it("clears selection on ESC key when no confirm dialog open", () => {
        const onClearSelection = vi.fn()
        render(
            <BulkActionToolbar
                selectedCount={3}
                totalCount={10}
                onSelectAll={() => {}}
                onClearSelection={onClearSelection}
                actions={baseActions}
            />,
        )
        fireEvent.keyDown(window, { key: "Escape" })
        expect(onClearSelection).toHaveBeenCalled()
    })
})
