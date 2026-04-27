/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DetailPage, type Tab, type Crumb } from "@/components/integra/detail-page"

afterEach(() => {
    cleanup()
})

beforeEach(() => {
    // reset URL hash between tests so SSR-safe useEffect doesn't leak state
    window.history.replaceState(null, "", window.location.pathname)
})

describe("DetailPage", () => {
    const tabs: Tab[] = [
        { key: "header", label: "Header", content: <div>Header content</div> },
        { key: "item", label: "Item (3)", content: <div>Item content</div> },
    ]

    it("renders title + subtitle", () => {
        render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                subtitle="Vendor X"
                tabs={tabs}
            />,
        )
        expect(screen.getByText("PO-001")).toBeInTheDocument()
        expect(screen.getByText("Vendor X")).toBeInTheDocument()
    })

    it("renders default tab content", () => {
        render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={tabs}
                defaultTab="header"
            />,
        )
        expect(screen.getByText("Header content")).toBeInTheDocument()
    })

    it("switches tab on click", () => {
        render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={tabs}
                defaultTab="header"
            />,
        )
        fireEvent.click(screen.getByText("Item (3)"))
        expect(screen.getByText("Item content")).toBeInTheDocument()
    })

    it("renders breadcrumb", () => {
        const breadcrumb: Crumb[] = [
            { label: "Beranda", href: "/" },
            { label: "Pengadaan", href: "/procurement" },
        ]
        render(
            <DetailPage
                breadcrumb={breadcrumb}
                title="PO-001"
                tabs={tabs}
            />,
        )
        expect(screen.getByText("Beranda")).toBeInTheDocument()
        expect(screen.getByText("Pengadaan")).toBeInTheDocument()
    })

    it("updates URL hash when tab clicked", () => {
        render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={tabs}
                defaultTab="header"
            />,
        )
        fireEvent.click(screen.getByText("Item (3)"))
        expect(window.location.hash).toBe("#item")
    })

    it("supports keyboard arrow navigation between tabs", () => {
        render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={tabs}
                defaultTab="header"
            />,
        )
        const headerTab = screen.getByRole("tab", { name: "Header" })
        headerTab.focus()
        fireEvent.keyDown(headerTab, { key: "ArrowRight" })
        // After ArrowRight, the second tab is selected
        const itemTab = screen.getByRole("tab", { name: "Item (3)" })
        expect(itemTab.getAttribute("aria-selected")).toBe("true")
        // Item content visible
        expect(screen.getByText("Item content")).toBeInTheDocument()
    })

    it("renders nothing fancy when tabs is empty (no crash)", () => {
        const { container } = render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={[]}
            />,
        )
        // Title is still rendered
        expect(screen.getByText("PO-001")).toBeInTheDocument()
        // No tablist rendered
        expect(container.querySelector('[role="tablist"]')).toBeNull()
    })

    it("uses ARIA tabs pattern correctly", () => {
        const { container } = render(
            <DetailPage
                breadcrumb={[]}
                title="PO-001"
                tabs={tabs}
                defaultTab="header"
            />,
        )
        const tablist = container.querySelector('[role="tablist"]')
        expect(tablist).not.toBeNull()
        expect(tablist?.getAttribute("aria-label")).toBe("Detail tabs")

        const headerTab = screen.getByRole("tab", { name: "Header" })
        expect(headerTab.getAttribute("aria-selected")).toBe("true")
        expect(headerTab.getAttribute("aria-controls")).toBeTruthy()
        expect(headerTab.id).toBeTruthy()

        const panel = container.querySelector('[role="tabpanel"]')
        expect(panel).not.toBeNull()
        expect(panel?.getAttribute("aria-labelledby")).toBe(headerTab.id)
    })
})
