/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
    ApprovalWorkflowSteps,
    CEO_THRESHOLD,
} from "@/components/integra/approval-workflow-steps"

afterEach(() => {
    cleanup()
})

describe("ApprovalWorkflowSteps", () => {
    it("renders 2 steps for amount ≤ 100jt", () => {
        render(
            <ApprovalWorkflowSteps
                amount={50_000_000}
                status="PENDING_APPROVAL"
                creatorName="Budi"
                approverName="Siti"
            />,
        )
        expect(screen.getByText("Dibuat")).toBeInTheDocument()
        expect(screen.getByText("Manager Review")).toBeInTheDocument()
        expect(screen.queryByText("CEO Approval")).toBeNull()
    })

    it("renders 3 steps for amount > 100jt", () => {
        render(
            <ApprovalWorkflowSteps
                amount={250_000_000}
                status="PENDING_APPROVAL"
                creatorName="Budi"
                approverName="Siti"
            />,
        )
        expect(screen.getByText("CEO Approval")).toBeInTheDocument()
    })

    it("marks current step correctly", () => {
        const { container } = render(
            <ApprovalWorkflowSteps
                amount={50_000_000}
                status="PENDING_APPROVAL"
                creatorName="Budi"
                approverName="Siti"
            />,
        )
        const current = container.querySelector("[data-step-status=current]")
        expect(current).not.toBeNull()
    })

    it("marks all done when status=APPROVED", () => {
        const { container } = render(
            <ApprovalWorkflowSteps
                amount={50_000_000}
                status="APPROVED"
                creatorName="Budi"
                approverName="Siti"
            />,
        )
        const dones = container.querySelectorAll("[data-step-status=done]")
        expect(dones.length).toBeGreaterThanOrEqual(2)
    })

    it("exports CEO_THRESHOLD constant equal to Rp 100 juta", () => {
        expect(CEO_THRESHOLD).toBe(100_000_000)
    })

    it("renders CEO note when threshold exceeded", () => {
        render(
            <ApprovalWorkflowSteps
                amount={250_000_000}
                status="PENDING_APPROVAL"
                creatorName="Budi"
                approverName="Siti"
                ceoName="Pak CEO"
            />,
        )
        expect(screen.getByText(/Wajib/i)).toBeInTheDocument()
        expect(screen.getByText("Pak CEO")).toBeInTheDocument()
    })

    it("uses ordered list semantics with aria-label", () => {
        const { container } = render(
            <ApprovalWorkflowSteps
                amount={50_000_000}
                status="PENDING_APPROVAL"
                creatorName="Budi"
                approverName="Siti"
            />,
        )
        const ol = container.querySelector("ol")
        expect(ol).not.toBeNull()
        expect(ol?.getAttribute("aria-label")).toBe("Alur approval")
    })
})
