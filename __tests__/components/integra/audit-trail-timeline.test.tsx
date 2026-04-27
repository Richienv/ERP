/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AuditTrailTimeline, type AuditEvent } from "@/components/integra/audit-trail-timeline"

afterEach(() => {
    cleanup()
})

describe("AuditTrailTimeline", () => {
    const events: AuditEvent[] = [
        {
            id: "1",
            timestamp: new Date("2026-04-25T10:00"),
            actor: { name: "Budi", role: "Staff" },
            action: "PO_CREATED",
            description: "Membuat PO",
        },
        {
            id: "2",
            timestamp: new Date("2026-04-25T11:30"),
            actor: { name: "Siti", role: "Manager" },
            action: "PO_APPROVED",
            description: "Menyetujui",
        },
    ]

    it("renders all events", () => {
        render(<AuditTrailTimeline events={events} />)
        expect(screen.getByText(/Membuat PO/)).toBeInTheDocument()
        expect(screen.getByText(/Menyetujui/)).toBeInTheDocument()
    })

    it("renders empty state when events=[]", () => {
        render(<AuditTrailTimeline events={[]} />)
        expect(screen.getByText(/Belum ada riwayat/)).toBeInTheDocument()
    })

    it("renders actor name + role", () => {
        render(<AuditTrailTimeline events={events} />)
        expect(screen.getByText("Budi")).toBeInTheDocument()
        expect(screen.getByText(/Staff/)).toBeInTheDocument()
    })

    it("colors action dot by type", () => {
        const { container } = render(<AuditTrailTimeline events={events} />)
        const dots = container.querySelectorAll("[data-action-dot]")
        expect(dots[0].getAttribute("data-action-dot")).toBe("info")
        expect(dots[1].getAttribute("data-action-dot")).toBe("ok")
    })

    it("uses ordered list semantics with aria-label", () => {
        const { container } = render(<AuditTrailTimeline events={events} />)
        const ol = container.querySelector("ol")
        expect(ol).not.toBeNull()
        expect(ol?.getAttribute("aria-label")).toBe("Riwayat aktivitas")
    })
})
