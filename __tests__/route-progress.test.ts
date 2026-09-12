import { describe, expect, it } from "vitest"
import { isModifiedClick, resolveNavHrefFromLink } from "@/lib/route-progress"

const origin = "http://localhost:3002"

function link(href: string, extra: { target?: string | null; download?: boolean } = {}) {
    return {
        href,
        target: extra.target ?? null,
        download: extra.download ?? false,
    }
}

describe("resolveNavHrefFromLink", () => {
    it("starts progress for an internal sidebar link", () => {
        expect(resolveNavHrefFromLink(link("/fleet"), "/dashboard", origin)).toBe("/fleet")
    })

    it("ignores the current path so same-page clicks stay quiet", () => {
        expect(resolveNavHrefFromLink(link("/finance/bills"), "/finance/bills", origin)).toBeNull()
    })

    it("treats a query change as navigation", () => {
        expect(resolveNavHrefFromLink(link("/finance/bills?status=OVERDUE"), "/finance/bills", origin, "")).toBe(
            "/finance/bills?status=OVERDUE",
        )
    })

    it("ignores new tabs, downloads, hashes, and external sites", () => {
        expect(resolveNavHrefFromLink(link("/fleet", { target: "_blank" }), "/dashboard", origin)).toBeNull()
        expect(resolveNavHrefFromLink(link("/export.csv", { download: true }), "/dashboard", origin)).toBeNull()
        expect(resolveNavHrefFromLink(link("#section"), "/dashboard", origin)).toBeNull()
        expect(resolveNavHrefFromLink(link("https://example.com/x"), "/dashboard", origin)).toBeNull()
    })
})

describe("isModifiedClick", () => {
    it("lets a normal left click through", () => {
        expect(isModifiedClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false)
    })

    it("skips modified or non-primary clicks", () => {
        expect(isModifiedClick({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true)
        expect(isModifiedClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true)
    })
})
