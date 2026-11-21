/**
 * Guards from the ui-ux-master audit (21 Nov 2026). Logic + source checks, no database.
 *
 * Each block pins one thing the audit fixed, so a later change can't quietly bring it back:
 * statuses in Indonesian words, readable text sizes, no black slabs, honest money on the
 * dashboard, plain sign-in errors, and no fake UI.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { statusLabel, statusTone, findStatusWord } from "@/lib/status-labels"
import { loginErrorMessage } from "@/lib/auth-messages"
import { businessUsesModule, dashboardShows, dashboardShowsModule, getBusinessProfile, isProfileHiddenPath } from "@/lib/business-profile"
import { filterNavByFeatureFlags, navMain } from "@/lib/sidebar-nav-data"
import { isModuleEnabled, MODULE_FLAGS } from "@/lib/sidebar-feature-flags"
import { CMDK_ACTIONS, VISIBLE_CMDK_ACTIONS } from "@/lib/cmdk-registry"
import { isKriHiddenPath } from "@/lib/kri-module-gates"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "@/components/ui/button"
import {
    askText,
    confirmAction,
    getConfirmSnapshot,
    registerConfirmHost,
    settleConfirm,
} from "@/lib/confirm-store"

function src(rel: string) {
    return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name.startsWith("._") || entry.name === "node_modules") continue
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel, out)
        else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(rel)
    }
    return out
}

const UI_FILES = [...walk("app"), ...walk("components")]

describe("status words (lib/status-labels)", () => {
    it("turns purchase-order enums into the words admins say", () => {
        expect(statusLabel("PARTIAL_RECEIVED")).toBe("Diterima sebagian")
        expect(statusLabel("VENDOR_CONFIRMED")).toBe("Dikonfirmasi vendor")
        expect(statusLabel("PO_DRAFT")).toBe("Draf")
        expect(statusLabel("COMPLETED")).toBe("Selesai")
        expect(statusLabel("PENDING_APPROVAL")).toBe("Menunggu persetujuan")
    })

    it("reads bill and invoice statuses as payment words", () => {
        expect(statusLabel("ISSUED", "payment")).toBe("Belum bayar")
        expect(statusLabel("PARTIAL", "payment")).toBe("Dibayar sebagian")
        expect(statusLabel("PAID", "payment")).toBe("Lunas")
        expect(statusLabel("OVERDUE", "payment")).toBe("Terlambat")
        // a PO "PARTIAL" is not a payment
        expect(statusLabel("PARTIAL")).toBe("Sebagian")
    })

    it("accepts lower case, spaces and dashes", () => {
        expect(statusLabel("partial received")).toBe("Diterima sebagian")
        expect(statusLabel("vendor-confirmed")).toBe("Dikonfirmasi vendor")
    })

    it("never shouts an unknown enum", () => {
        expect(statusLabel("SOME_NEW_STATE")).toBe("Some new state")
        expect(statusLabel(null)).toBe("—")
        expect(findStatusWord("SOME_NEW_STATE")).toBeNull()
    })

    it("gives every status a colour family as a second signal", () => {
        expect(statusTone("OVERDUE", "payment")).toBe("late")
        expect(statusTone("PAID", "payment")).toBe("done")
        expect(statusTone("ISSUED", "payment")).toBe("waiting")
        expect(statusTone("UNKNOWN")).toBe("draft")
    })
})

describe("sign-in errors in plain Indonesian", () => {
    it("explains wrong credentials and what to do", () => {
        const msg = loginErrorMessage("Invalid login credentials")
        expect(msg).toMatch(/Email atau kata sandi salah/)
        expect(msg).toMatch(/Lupa kata sandi/)
    })

    it("covers unconfirmed email, rate limits and network failures", () => {
        expect(loginErrorMessage("Email not confirmed")).toMatch(/belum dikonfirmasi/)
        expect(loginErrorMessage("Too many requests")).toMatch(/Tunggu/)
        expect(loginErrorMessage("Failed to fetch")).toMatch(/koneksi internet/)
    })

    it("never passes Supabase's English through", () => {
        const msg = loginErrorMessage("Database error querying schema")
        expect(msg).not.toMatch(/Database|schema/)
    })

    it("the login page uses it and has no fake Google button", () => {
        const page = src("app/login/page.tsx")
        expect(page).toContain("loginErrorMessage(")
        expect(page).not.toContain("Lanjutkan dengan Google")
        expect(page).not.toMatch(/toast\.error\("Login gagal: " \+ error\.message\)/)
    })
})

describe("readable on every screen", () => {
    it("no text below 12 px in app/ or components/", () => {
        const offenders: string[] = []
        for (const f of UI_FILES) {
            const s = src(f)
            for (const m of s.matchAll(/(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]/g)) {
                if (Number(m[1]) < 12) offenders.push(`${f}: ${m[0]}`)
            }
        }
        expect(offenders).toEqual([])
    })

    it("light mode lifts the grey text steps to WCAG AA", () => {
        const css = src("app/globals.css")
        const block = css.slice(css.indexOf(":root:not(.dark) {"), css.indexOf("@layer base"))
        expect(block).toContain("--color-zinc-400: oklch(0.54")
        expect(block).toContain("--color-zinc-500: oklch(0.49")
    })

    it("no black table-header bars left (calm slate-50 headers instead)", () => {
        const offenders = UI_FILES.filter((f) => src(f).includes("bg-slate-900 dark:bg-zinc-950"))
        expect(offenders).toEqual([])
    })
})

describe("dashboard tells the truth about money and stock", () => {
    it("stock totals add numbers, not Decimal strings ('0'+'1'+'2' = '012')", () => {
        const route = src("app/api/dashboard/route.ts")
        expect(route).toContain("sum + Number(sl.quantity ?? 0)")
        expect(route).not.toMatch(/sum \+ \(sl\.quantity \?\? 0\)/)
    })

    it("upcoming bills and overdue invoices show the amount still owed", () => {
        const page = src("app/dashboard/dashboard-client.tsx")
        expect(page).toContain("bill.balanceDue ?? bill.totalAmount")
        expect(page).toContain("inv.balanceDue ?? inv.totalAmount")
        expect(page).not.toContain("formatCurrency(bill.amount ?? bill.total ?? 0)")
    })

    it("statuses on the dashboard and in the activity feed are words", () => {
        expect(src("app/dashboard/dashboard-client.tsx")).not.toMatch(/status\)?\.replace\(\/_\/g, " "\)/)
        expect(src("app/actions/dashboard.ts")).not.toContain("po.status.replace(/_/g, ' ').toLowerCase()")
    })
})

describe("no fake UI", () => {
    it("the mock English 'ERP Intelligence' panel is not mounted on every page", () => {
        expect(src("components/global-layout.tsx")).not.toContain("<AISidebar")
    })
})

describe("confirm and ask dialogs instead of the browser's confirm()/prompt()", () => {
    it("without a mounted host (server, tests) it cancels instead of hanging", async () => {
        await expect(confirmAction({ title: "Hapus?" })).resolves.toBe(false)
        await expect(askText({ title: "Alasan?" })).resolves.toBeNull()
    })

    it("with a host it waits for the user and resolves their answer", async () => {
        const unregister = registerConfirmHost()
        try {
            const answer = confirmAction({ title: "Hapus produk ini?", confirmLabel: "Hapus produk", destructive: true })
            const open = getConfirmSnapshot()
            expect(open?.title).toBe("Hapus produk ini?")
            expect(open?.confirmLabel).toBe("Hapus produk")
            expect(open?.cancelLabel).toBe("Batal")
            settleConfirm(true)
            await expect(answer).resolves.toBe(true)
            expect(getConfirmSnapshot()).toBeNull()

            const reason = askText({ title: "Tolak PO-0012?", required: true })
            settleConfirm("  harga tidak sesuai  ")
            await expect(reason).resolves.toBe("harga tidak sesuai")

            // a second settle (the dialog's close event after the click) is ignored
            settleConfirm(false)
            expect(getConfirmSnapshot()).toBeNull()
        } finally {
            unregister()
        }
    })

    it("a new request cancels the one still open", async () => {
        const unregister = registerConfirmHost()
        try {
            const first = confirmAction({ title: "Pertama?" })
            const second = confirmAction({ title: "Kedua?" })
            await expect(first).resolves.toBe(false)
            expect(getConfirmSnapshot()?.title).toBe("Kedua?")
            settleConfirm(true)
            await expect(second).resolves.toBe(true)
        } finally {
            unregister()
        }
    })

    it("no screen calls the browser's confirm()/prompt()/alert() any more", () => {
        const offenders: string[] = []
        for (const f of UI_FILES) {
            src(f).split("\n").forEach((line, i) => {
                if (line.includes("ui-lint-ignore")) return
                if (/(?<![\w.$])(window\.)?(confirm|prompt|alert)\s*\(/.test(line) && !/function (confirm|prompt|alert)\b/.test(line)) {
                    offenders.push(`${f}:${i + 1}`)
                }
            })
        }
        expect(offenders).toEqual([])
    })

    it("the dialog host is mounted once for the whole app", () => {
        expect(src("components/global-layout.tsx")).toContain("<ConfirmActionHost />")
    })
})

describe("buttons say what they are doing while they wait", () => {
    it("Button loading shows the words, blocks a second press and marks itself busy", () => {
        const html = renderToStaticMarkup(
            React.createElement(Button, { loading: true, loadingText: "Menyimpan…" }, "Simpan"),
        )
        expect(html).toContain("Menyimpan…")
        expect(html).not.toContain(">Simpan<")
        expect(html).toContain('disabled=""')
        expect(html).toContain('aria-busy="true"')
    })

    it("Button without loading renders as before", () => {
        const html = renderToStaticMarkup(React.createElement(Button, null, "Simpan"))
        expect(html).toContain("Simpan")
        expect(html).not.toContain("aria-busy")
        expect(html).not.toContain('disabled=""')
    })

    it("labelled buttons switch to the action in progress", () => {
        expect(src("app/inventory/products/[id]/page.tsx")).toContain('{isSaving ? "Menyimpan…" : "Simpan"}')
        expect(src("app/finance/bills/page.tsx")).toContain('loadingText="Menyetujui tagihan…"')
    })
})

describe("the dashboard shows only what this business uses", () => {
    it("a spare-part business (the default) has no Armada or SDM on the dashboard", () => {
        const saved = process.env.NEXT_PUBLIC_BUSINESS_PROFILE
        delete process.env.NEXT_PUBLIC_BUSINESS_PROFILE
        try {
            expect(getBusinessProfile()).toBe("sparepart")
            expect(dashboardShows("fleet")).toBe(false)
            expect(dashboardShows("hcm")).toBe(false)
            expect(dashboardShowsModule("finance")).toBe(true)
            expect(dashboardShowsModule("procurement")).toBe(true)
            expect(dashboardShowsModule("inventory")).toBe(true)
        } finally {
            if (saved !== undefined) process.env.NEXT_PUBLIC_BUSINESS_PROFILE = saved
        }
    })

    it("the mining edition keeps them", () => {
        expect(dashboardShows("fleet", "mining")).toBe(true)
        expect(dashboardShows("hcm", "mining")).toBe(true)
        expect(dashboardShowsModule("fleet", "mining")).toBe(true)
    })

    it("the SDM card and the inbox follow the profile; module pages are untouched", () => {
        expect(src("app/dashboard/dashboard-client.tsx")).toContain('totalStaff > 0 && dashboardShows("hcm")')
        const pulse = src("components/mining/command-pulse.tsx")
        const inbox = pulse.slice(pulse.indexOf("export function OperationsInbox("), pulse.indexOf("export function CommandPulse("))
        const modulePulse = pulse.slice(pulse.indexOf("export function CommandPulse("))
        expect(inbox).toContain("dashboardShowsModule(action.module)")
        expect(modulePulse).not.toContain("dashboardShowsModule(")
    })
})

function withProfile<T>(profile: "sparepart" | "mining" | undefined, fn: () => T): T {
    const saved = process.env.NEXT_PUBLIC_BUSINESS_PROFILE
    if (profile === undefined) delete process.env.NEXT_PUBLIC_BUSINESS_PROFILE
    else process.env.NEXT_PUBLIC_BUSINESS_PROFILE = profile
    try {
        return fn()
    } finally {
        if (saved === undefined) delete process.env.NEXT_PUBLIC_BUSINESS_PROFILE
        else process.env.NEXT_PUBLIC_BUSINESS_PROFILE = saved
    }
}

describe("the menus show only what this business uses", () => {
    const titles = (items: ReturnType<typeof filterNavByFeatureFlags>) => items.map((i) => i.title)
    const allUrls = (items: ReturnType<typeof filterNavByFeatureFlags>) =>
        items.flatMap((i) => [i.url, ...(i.items ?? []).map((sub) => sub.url)])

    it("a spare-part business (the default) has no Armada or SDM in the sidebar", () => {
        withProfile(undefined, () => {
            const nav = filterNavByFeatureFlags(navMain)
            expect(titles(nav)).not.toContain("Armada")
            expect(titles(nav)).not.toContain("SDM")
            // The "Gaji & SDM" shortcut under Keuangan goes too.
            expect(allUrls(nav).filter((u) => u.startsWith("/hcm") || u.startsWith("/fleet"))).toEqual([])
            // Everything the business does use stays.
            for (const kept of ["Dasbor", "Inventori", "Pengadaan", "Keuangan"]) {
                expect(titles(nav).some((t) => t.startsWith(kept)), kept).toBe(true)
            }
            expect(isModuleEnabled("hcm")).toBe(false)
            expect(isModuleEnabled("fleet")).toBe(false)
            expect(isModuleEnabled("finance")).toBe(true)
        })
    })

    it("the mining edition keeps Armada, SDM and the Gaji & SDM shortcut", () => {
        withProfile("mining", () => {
            const nav = filterNavByFeatureFlags(navMain)
            expect(titles(nav)).toContain("Armada")
            expect(titles(nav)).toContain("SDM")
            expect(allUrls(nav)).toContain("/hcm/payroll")
            expect(isModuleEnabled("hcm")).toBe(true)
            expect(businessUsesModule("fleet")).toBe(true)
        })
        // The edition flags themselves are unchanged.
        expect(MODULE_FLAGS.hcm).toBe(true)
        expect(MODULE_FLAGS.fleet).toBe(true)
    })

    it("knows which routes belong to the hidden modules", () => {
        for (const p of ["/hcm", "/hcm/payroll", "/hcm/payroll#compliance", "/fleet", "/fleet/new"]) {
            expect(isProfileHiddenPath(p, "sparepart"), p).toBe(true)
            expect(isProfileHiddenPath(p, "mining"), p).toBe(false)
        }
        for (const p of ["/hcmx", "/finance/bills", "/inventory", "/dashboard"]) {
            expect(isProfileHiddenPath(p, "sparepart"), p).toBe(false)
        }
    })

    it("Cmd+K offers no SDM or Armada entries, but the registry stays complete", () => {
        expect(VISIBLE_CMDK_ACTIONS.filter((a) => isProfileHiddenPath(a.route, "sparepart"))).toEqual([])
        expect(VISIBLE_CMDK_ACTIONS.map((a) => a.id)).not.toContain("nav-hcm-payroll")
        expect(CMDK_ACTIONS.map((a) => a.id)).toContain("nav-hcm-payroll")
    })

    it("the pages still open from a direct link (no redirect)", () => {
        expect(isKriHiddenPath("/hcm/payroll")).toBe(false)
        expect(isKriHiddenPath("/fleet")).toBe(false)
    })
})
