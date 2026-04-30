/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LinkedDocsPanel, type LinkedDoc } from "@/components/integra/linked-docs-panel"

afterEach(() => {
    cleanup()
})

describe("LinkedDocsPanel", () => {
    const trail: LinkedDoc[] = [
        { type: "PR", number: "PR-001", status: "APPROVED", href: "/procurement/requests/PR-001" },
        { type: "PO", number: "PO-001", status: "ORDERED", current: true },
        { type: "GRN", number: "GRN-001", status: "PARTIAL", href: "/procurement/receiving/GRN-001" },
    ]

    it("renders all trail items", () => {
        render(<LinkedDocsPanel trail={trail} />)
        expect(screen.getByText("PR-001")).toBeInTheDocument()
        expect(screen.getByText("PO-001")).toBeInTheDocument()
        expect(screen.getByText("GRN-001")).toBeInTheDocument()
    })

    it("hides panel when trail empty", () => {
        const { container } = render(<LinkedDocsPanel trail={[]} />)
        expect(container.querySelector("[data-linked-panel]")).toBeNull()
    })

    it("highlights current item with aria-current", () => {
        const { container } = render(<LinkedDocsPanel trail={trail} />)
        const current = container.querySelector("[data-current=true]")
        expect(current).not.toBeNull()
        // current item should also be marked aria-current="step" for a11y
        expect(container.querySelector('[aria-current="step"]')).not.toBeNull()
    })

    it("renders deleted document with strikethrough and Dihapus badge, not as link", () => {
        const trailWithDeleted: LinkedDoc[] = [
            { type: "PR", number: "PR-002", status: "DELETED", deleted: true, href: "/procurement/requests/PR-002" },
            { type: "PO", number: "PO-002", status: "ORDERED", current: true },
        ]
        const { container } = render(<LinkedDocsPanel trail={trailWithDeleted} />)
        expect(screen.getByText("Dihapus")).toBeInTheDocument()
        // deleted doc rendered with strikethrough
        const deletedNumber = screen.getByText("PR-002")
        expect(deletedNumber.className).toContain("line-through")
        // deleted doc should NOT be a link
        const link = container.querySelector('a[href="/procurement/requests/PR-002"]')
        expect(link).toBeNull()
    })

    it("uses semantic nav with aria-label and ordered list", () => {
        const { container } = render(<LinkedDocsPanel trail={trail} />)
        const nav = container.querySelector("nav")
        expect(nav).not.toBeNull()
        expect(nav?.getAttribute("aria-label")).toBe("Dokumen terkait")
        expect(container.querySelector("ol")).not.toBeNull()
    })
})
