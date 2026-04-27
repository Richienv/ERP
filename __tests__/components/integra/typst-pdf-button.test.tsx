/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TypstPdfButton } from "@/components/integra/typst-pdf-button"

// Mock sonner toast — captured per test
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    toastSuccess.mockReset()
    toastError.mockReset()
})

beforeEach(() => {
    // jsdom does not implement these
    if (!global.URL.createObjectURL) {
        global.URL.createObjectURL = vi.fn(() => "blob:fake")
    } else {
        global.URL.createObjectURL = vi.fn(() => "blob:fake")
    }
    if (!global.URL.revokeObjectURL) {
        global.URL.revokeObjectURL = vi.fn()
    } else {
        global.URL.revokeObjectURL = vi.fn()
    }
})

describe("TypstPdfButton", () => {
    it("triggers fetch on click", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob()),
        }) as unknown as typeof fetch
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/test"))
    })

    it("shows loading state", async () => {
        global.fetch = vi.fn(
            () => new Promise(() => {}),
        ) as unknown as typeof fetch
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() =>
            expect(screen.getByText(/Generating/)).toBeInTheDocument(),
        )
    })

    it("shows error toast on fail", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
        }) as unknown as typeof fetch
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() => expect(screen.queryByText(/Generating/)).toBeNull())
        expect(toastError).toHaveBeenCalled()
        const message = String(toastError.mock.calls[0][0])
        expect(message.toLowerCase()).toContain("gagal")
    })

    it("shows success toast on success", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob()),
        }) as unknown as typeof fetch
        render(<TypstPdfButton endpoint="/api/test" filename="PO-001.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
        const message = String(toastSuccess.mock.calls[0][0])
        expect(message).toContain("PO-001.pdf")
    })
})
