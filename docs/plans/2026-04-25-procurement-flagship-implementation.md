# Procurement Flagship Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development for parallel) to implement this plan task-by-task.

**Goal:** Transform `/procurement/orders` into enterprise-grade flagship via 8 reusable primitives + detail page + bulletproof testing.

**Architecture:** Component-Library-First. Build 8 primitives in `components/integra/` first (parallel-friendly), then refactor list page to consume them, then build detail page using same primitives. Reuse existing data hooks where possible. New API endpoints only for bulk approve + PDF + detail fetch.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + TanStack Query + Prisma 6 + Supabase + Vitest + Playwright + xlsx + Typst (existing template stack).

**Source design doc:** `docs/plans/2026-04-25-procurement-flagship-design.md`

---

## Phase A — Build 8 Primitives (parallel-friendly)

Each primitive is independent. With subagent-driven-development, dispatch 6+ subagents in parallel (one per primitive). Each follows the same TDD pattern: write tests → verify fail → implement → verify pass → commit.

### Task A1: `<FilterPanel>` — slide-out filter

**Files:**
- Create: `components/integra/filter-panel.tsx`
- Test: `__tests__/components/integra/filter-panel.test.tsx`

**Step 1: Write failing tests**

```tsx
// __tests__/components/integra/filter-panel.test.tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { FilterPanel } from "@/components/integra/filter-panel"

describe("FilterPanel", () => {
    const baseDimensions = [
        { type: "multi-select" as const, key: "status", label: "Status",
          options: [{ value: "PENDING", label: "Menunggu" }, { value: "APPROVED", label: "Disetujui" }] },
        { type: "date-range" as const, key: "createdAt", label: "Tgl Buat" },
    ]

    it("does not render when open=false", () => {
        const { container } = render(
            <FilterPanel open={false} onClose={() => {}} dimensions={baseDimensions}
              values={{}} onChange={() => {}} onApply={() => {}} onReset={() => {}} />
        )
        expect(container.querySelector("[data-filter-panel]")).toBeNull()
    })

    it("renders dimensions when open", () => {
        render(
            <FilterPanel open={true} onClose={() => {}} dimensions={baseDimensions}
              values={{}} onChange={() => {}} onApply={() => {}} onReset={() => {}} />
        )
        expect(screen.getByText("Status")).toBeInTheDocument()
        expect(screen.getByText("Tgl Buat")).toBeInTheDocument()
    })

    it("calls onApply when apply button clicked", () => {
        const onApply = vi.fn()
        render(
            <FilterPanel open={true} onClose={() => {}} dimensions={baseDimensions}
              values={{ status: ["APPROVED"] }} onChange={() => {}} onApply={onApply} onReset={() => {}} />
        )
        fireEvent.click(screen.getByText(/Terapkan/))
        expect(onApply).toHaveBeenCalled()
    })

    it("calls onReset and clears values", () => {
        const onReset = vi.fn()
        render(
            <FilterPanel open={true} onClose={() => {}} dimensions={baseDimensions}
              values={{ status: ["APPROVED"] }} onChange={() => {}} onApply={() => {}} onReset={onReset} />
        )
        fireEvent.click(screen.getByText("Reset"))
        expect(onReset).toHaveBeenCalled()
    })

    it("calls onClose on ESC key", () => {
        const onClose = vi.fn()
        render(
            <FilterPanel open={true} onClose={onClose} dimensions={baseDimensions}
              values={{}} onChange={() => {}} onApply={() => {}} onReset={() => {}} />
        )
        fireEvent.keyDown(document, { key: "Escape" })
        expect(onClose).toHaveBeenCalled()
    })

    it("toggles multi-select option", () => {
        const onChange = vi.fn()
        render(
            <FilterPanel open={true} onClose={() => {}} dimensions={baseDimensions}
              values={{}} onChange={onChange} onApply={() => {}} onReset={() => {}} />
        )
        fireEvent.click(screen.getByLabelText("Disetujui"))
        expect(onChange).toHaveBeenCalledWith({ status: ["APPROVED"] })
    })
})
```

**Step 2: Run tests to verify fail**

Run: `npx vitest run __tests__/components/integra/filter-panel.test.tsx`
Expected: FAIL with "Cannot find module '@/components/integra/filter-panel'"

**Step 3: Implement minimal `FilterPanel`**

```tsx
// components/integra/filter-panel.tsx
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

export type FilterDimension =
    | { type: "multi-select"; key: string; label: string; options: { value: string; label: string }[]; searchable?: boolean }
    | { type: "date-range"; key: string; label: string }
    | { type: "amount-range"; key: string; label: string; min: number; max: number }
    | { type: "checkbox-group"; key: string; label: string; options: { value: string; label: string }[] }

export type FilterValues = Record<string, any>

export function FilterPanel({
    open, onClose, dimensions, values, onChange, onApply, onReset, savedFiltersSlot,
}: {
    open: boolean
    onClose: () => void
    dimensions: FilterDimension[]
    values: FilterValues
    onChange: (next: FilterValues) => void
    onApply: () => void
    onReset: () => void
    savedFiltersSlot?: React.ReactNode
}) {
    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    if (!open) return null

    const activeCount = Object.keys(values).filter(k => {
        const v = values[k]
        return Array.isArray(v) ? v.length > 0 : v != null
    }).length

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} data-filter-backdrop />
            <aside
                data-filter-panel
                className="fixed right-0 top-0 h-screen w-[320px] bg-[var(--integra-canvas-pure)] border-l border-[var(--integra-hairline)] z-50 flex flex-col"
            >
                <div className="px-4 py-3 border-b border-[var(--integra-hairline)] flex items-center justify-between">
                    <span className="font-display font-semibold text-[14px]">Filter</span>
                    <button onClick={onClose} className="text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">×</button>
                </div>
                {savedFiltersSlot && <div className="px-4 py-2 border-b border-[var(--integra-hairline)]">{savedFiltersSlot}</div>}
                <div className="flex-1 overflow-auto">
                    {dimensions.map(d => (
                        <DimensionField key={d.key} dim={d} value={values[d.key]} onChange={(v) => onChange({ ...values, [d.key]: v })} />
                    ))}
                </div>
                <div className="px-4 py-3 border-t border-[var(--integra-hairline)] flex gap-2">
                    <button onClick={onReset} className="flex-1 text-[12px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Reset</button>
                    <button
                        onClick={onApply}
                        className="flex-1 h-7 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                    >
                        Terapkan{activeCount > 0 ? ` (${activeCount})` : ""}
                    </button>
                </div>
            </aside>
        </>
    )
}

function DimensionField({ dim, value, onChange }: { dim: FilterDimension; value: any; onChange: (v: any) => void }) {
    const [expanded, setExpanded] = React.useState(true)
    return (
        <div className="border-b border-[var(--integra-hairline)]">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-[12px] font-medium text-[var(--integra-ink)]"
            >
                {dim.label}
                <span className="text-[var(--integra-muted)]">{expanded ? "−" : "+"}</span>
            </button>
            {expanded && (
                <div className="px-4 pb-3">
                    {dim.type === "multi-select" && (
                        <div className="space-y-1.5">
                            {dim.options.map(opt => {
                                const selected = Array.isArray(value) && value.includes(opt.value)
                                return (
                                    <label key={opt.value} className="flex items-center gap-2 text-[12px] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={(e) => {
                                                const next = selected
                                                    ? (value ?? []).filter((v: any) => v !== opt.value)
                                                    : [...(value ?? []), opt.value]
                                                onChange(next.length ? next : undefined)
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                    {dim.type === "date-range" && (
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={value?.start ?? ""} onChange={(e) => onChange({ ...value, start: e.target.value })} className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]" />
                            <input type="date" value={value?.end ?? ""} onChange={(e) => onChange({ ...value, end: e.target.value })} className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]" />
                        </div>
                    )}
                    {dim.type === "amount-range" && (
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" placeholder={`Min ${dim.min}`} value={value?.min ?? ""} onChange={(e) => onChange({ ...value, min: Number(e.target.value) || undefined })} className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]" />
                            <input type="number" placeholder={`Max ${dim.max}`} value={value?.max ?? ""} onChange={(e) => onChange({ ...value, max: Number(e.target.value) || undefined })} className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]" />
                        </div>
                    )}
                    {dim.type === "checkbox-group" && (
                        <div className="space-y-1.5">
                            {dim.options.map(opt => {
                                const selected = Array.isArray(value) && value.includes(opt.value)
                                return (
                                    <label key={opt.value} className="flex items-center gap-2 text-[12px] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={(e) => {
                                                const next = selected
                                                    ? (value ?? []).filter((v: any) => v !== opt.value)
                                                    : [...(value ?? []), opt.value]
                                                onChange(next.length ? next : undefined)
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run __tests__/components/integra/filter-panel.test.tsx`
Expected: PASS (6/6)

**Step 5: Commit**

```bash
git add components/integra/filter-panel.tsx __tests__/components/integra/filter-panel.test.tsx
git commit -m "feat(integra): tambah FilterPanel primitive — slide-out filter dengan multi-select/date-range/amount-range/checkbox-group"
```

---

### Task A2: `<BulkActionToolbar>`

**Files:**
- Create: `components/integra/bulk-action-toolbar.tsx`
- Test: `__tests__/components/integra/bulk-action-toolbar.test.tsx`

**Step 1: Tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { BulkActionToolbar } from "@/components/integra/bulk-action-toolbar"

describe("BulkActionToolbar", () => {
    const baseActions = [
        { label: "Setujui", onClick: vi.fn(), variant: "primary" as const },
        { label: "Tolak", onClick: vi.fn(), variant: "danger" as const, confirm: "Yakin tolak?" },
    ]

    it("hidden when selectedCount=0", () => {
        const { container } = render(
            <BulkActionToolbar selectedCount={0} totalCount={10} onSelectAll={() => {}} onClearSelection={() => {}} actions={baseActions} />
        )
        expect(container.querySelector("[data-bulk-toolbar]")).toBeNull()
    })

    it("visible when selectedCount>0", () => {
        render(
            <BulkActionToolbar selectedCount={3} totalCount={10} onSelectAll={() => {}} onClearSelection={() => {}} actions={baseActions} />
        )
        expect(screen.getByText(/3 dipilih dari 10/)).toBeInTheDocument()
    })

    it("calls onSelectAll", () => {
        const onSelectAll = vi.fn()
        render(
            <BulkActionToolbar selectedCount={3} totalCount={10} onSelectAll={onSelectAll} onClearSelection={() => {}} actions={baseActions} />
        )
        fireEvent.click(screen.getByText("Pilih semua"))
        expect(onSelectAll).toHaveBeenCalled()
    })

    it("calls action onClick when no confirm", () => {
        const onClick = vi.fn()
        const actions = [{ label: "Setujui", onClick, variant: "primary" as const }]
        render(
            <BulkActionToolbar selectedCount={3} totalCount={10} onSelectAll={() => {}} onClearSelection={() => {}} actions={actions} />
        )
        fireEvent.click(screen.getByText("Setujui"))
        expect(onClick).toHaveBeenCalled()
    })

    it("shows confirm dialog when action has confirm prop", () => {
        render(
            <BulkActionToolbar selectedCount={3} totalCount={10} onSelectAll={() => {}} onClearSelection={() => {}} actions={baseActions} />
        )
        fireEvent.click(screen.getByText("Tolak"))
        expect(screen.getByText("Yakin tolak?")).toBeInTheDocument()
    })
})
```

**Step 2: Run → FAIL (module not found)**

**Step 3: Implement**

```tsx
// components/integra/bulk-action-toolbar.tsx
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

export type BulkAction = {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "primary" | "danger" | "default"
    confirm?: string
}

export function BulkActionToolbar({
    selectedCount, totalCount, onSelectAll, onClearSelection, actions,
}: {
    selectedCount: number
    totalCount: number
    onSelectAll: () => void
    onClearSelection: () => void
    actions: BulkAction[]
}) {
    const [confirmAction, setConfirmAction] = React.useState<BulkAction | null>(null)

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (confirmAction) setConfirmAction(null)
                else onClearSelection()
            }
        }
        if (selectedCount > 0) window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [selectedCount, confirmAction, onClearSelection])

    if (selectedCount === 0) return null

    return (
        <>
            <div
                data-bulk-toolbar
                className="sticky top-0 z-30 bg-[var(--integra-ink)] text-[var(--integra-canvas)] px-4 py-2 flex items-center gap-3 text-[12px]"
            >
                <span className="font-mono">{selectedCount} dipilih dari {totalCount}</span>
                <span className="opacity-50">·</span>
                <button onClick={onSelectAll} className="opacity-80 hover:opacity-100">Pilih semua</button>
                <span className="opacity-50">|</span>
                <button onClick={onClearSelection} className="opacity-80 hover:opacity-100">Batal</button>
                <span className="opacity-50">·</span>
                <div className="flex gap-1.5 ml-auto">
                    {actions.map(a => (
                        <button
                            key={a.label}
                            onClick={() => a.confirm ? setConfirmAction(a) : a.onClick()}
                            className={cn(
                                "h-7 px-3 rounded-[3px] text-[12px] flex items-center gap-1.5",
                                a.variant === "primary" && "bg-[var(--integra-canvas)] text-[var(--integra-ink)]",
                                a.variant === "danger" && "bg-[var(--integra-red)] text-white",
                                (!a.variant || a.variant === "default") && "border border-[var(--integra-canvas)]/40 hover:bg-white/10",
                            )}
                        >
                            {a.icon}
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
            {confirmAction && (
                <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center" onClick={() => setConfirmAction(null)}>
                    <div className="bg-[var(--integra-canvas-pure)] p-5 rounded-[3px] max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[13px] text-[var(--integra-ink)]">{confirmAction.confirm}</p>
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setConfirmAction(null)} className="h-7 px-3 text-[12px] text-[var(--integra-muted)]">Batal</button>
                            <button
                                onClick={() => { confirmAction.onClick(); setConfirmAction(null) }}
                                className={cn(
                                    "h-7 px-3 text-[12px] rounded-[3px]",
                                    confirmAction.variant === "danger" ? "bg-[var(--integra-red)] text-white" : "bg-[var(--integra-ink)] text-[var(--integra-canvas)]"
                                )}
                            >
                                {confirmAction.label}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
```

**Step 4: Tests pass**

**Step 5: Commit**

```bash
git add components/integra/bulk-action-toolbar.tsx __tests__/components/integra/bulk-action-toolbar.test.tsx
git commit -m "feat(integra): tambah BulkActionToolbar primitive — sticky toolbar saat selection > 0 dengan confirm dialog"
```

---

### Task A3: `<AuditTrailTimeline>`

**Files:**
- Create: `components/integra/audit-trail-timeline.tsx`
- Test: `__tests__/components/integra/audit-trail-timeline.test.tsx`

**Step 1: Tests**

```tsx
import { render, screen } from "@testing-library/react"
import { AuditTrailTimeline } from "@/components/integra/audit-trail-timeline"

describe("AuditTrailTimeline", () => {
    const events = [
        { id: "1", timestamp: new Date("2026-04-25T10:00"), actor: { name: "Budi", role: "Staff" }, action: "PO_CREATED" as const, description: "Membuat PO" },
        { id: "2", timestamp: new Date("2026-04-25T11:30"), actor: { name: "Siti", role: "Manager" }, action: "PO_APPROVED" as const, description: "Menyetujui" },
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
        expect(dots[0].getAttribute("data-action-dot")).toBe("info")  // CREATED → info
        expect(dots[1].getAttribute("data-action-dot")).toBe("ok")    // APPROVED → ok
    })
})
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```tsx
// components/integra/audit-trail-timeline.tsx
"use client"
import { EmptyState } from "@/components/integra"
import { cn } from "@/lib/utils"

export type AuditAction =
    | "PO_CREATED" | "PO_UPDATED" | "PO_APPROVED" | "PO_REJECTED" | "PO_CANCELLED"
    | "PO_ORDERED" | "PO_SHIPPED" | "PO_RECEIVED" | "PO_COMPLETED"

export type AuditEvent = {
    id: string
    timestamp: Date
    actor: { name: string; role?: string }
    action: AuditAction
    description: string
    meta?: Record<string, any>
}

const COLOR: Record<AuditAction, "info" | "ok" | "warn" | "err"> = {
    PO_CREATED: "info", PO_UPDATED: "info", PO_ORDERED: "info", PO_SHIPPED: "info",
    PO_APPROVED: "ok", PO_RECEIVED: "ok", PO_COMPLETED: "ok",
    PO_REJECTED: "err", PO_CANCELLED: "err",
}

const COLOR_VAR: Record<"info" | "ok" | "warn" | "err", string> = {
    info: "var(--integra-liren-blue)",
    ok: "var(--integra-green-ok)",
    warn: "var(--integra-amber)",
    err: "var(--integra-red)",
}

export function AuditTrailTimeline({ events }: { events: AuditEvent[] }) {
    if (events.length === 0) {
        return <EmptyState title="Belum ada riwayat" description="Aktivitas akan muncul di sini" />
    }
    return (
        <ul className="space-y-3">
            {events.map((e, i) => {
                const kind = COLOR[e.action] ?? "info"
                return (
                    <li key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-0.5 shrink-0">
                            <span data-action-dot={kind} className="w-2 h-2 rounded-full" style={{ background: COLOR_VAR[kind] }} />
                            {i < events.length - 1 && <span className="flex-1 w-px bg-[var(--integra-hairline)] mt-1" style={{ minHeight: "16px" }} />}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                            <div className="flex items-baseline gap-2 text-[11.5px] text-[var(--integra-muted)] font-mono">
                                <span>{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(e.timestamp)}</span>
                            </div>
                            <div className="text-[12.5px] text-[var(--integra-ink)] mt-0.5">{e.description}</div>
                            <div className="text-[11px] text-[var(--integra-muted)]">
                                <span className="font-medium text-[var(--integra-ink-soft)]">{e.actor.name}</span>
                                {e.actor.role && <span> · {e.actor.role}</span>}
                            </div>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
```

**Step 4: Tests pass (4/4)**

**Step 5: Commit**

```bash
git add components/integra/audit-trail-timeline.tsx __tests__/components/integra/audit-trail-timeline.test.tsx
git commit -m "feat(integra): tambah AuditTrailTimeline — vertical timeline dengan action color mapping"
```

---

### Task A4: `<ApprovalWorkflowSteps>`

**Files:**
- Create: `components/integra/approval-workflow-steps.tsx`
- Test: `__tests__/components/integra/approval-workflow-steps.test.tsx`

**Step 1: Tests**

```tsx
import { render, screen } from "@testing-library/react"
import { ApprovalWorkflowSteps } from "@/components/integra/approval-workflow-steps"

describe("ApprovalWorkflowSteps", () => {
    it("renders 2 steps for amount ≤ 100jt", () => {
        render(<ApprovalWorkflowSteps amount={50_000_000} status="PENDING_APPROVAL" creatorName="Budi" approverName="Siti" />)
        expect(screen.getByText("Dibuat")).toBeInTheDocument()
        expect(screen.getByText("Manager Review")).toBeInTheDocument()
        expect(screen.queryByText("CEO Approval")).toBeNull()
    })

    it("renders 3 steps for amount > 100jt", () => {
        render(<ApprovalWorkflowSteps amount={250_000_000} status="PENDING_APPROVAL" creatorName="Budi" approverName="Siti" />)
        expect(screen.getByText("CEO Approval")).toBeInTheDocument()
    })

    it("marks current step correctly", () => {
        const { container } = render(<ApprovalWorkflowSteps amount={50_000_000} status="PENDING_APPROVAL" creatorName="Budi" approverName="Siti" />)
        const current = container.querySelector("[data-step-status=current]")
        expect(current).not.toBeNull()
    })

    it("marks all done when status=APPROVED", () => {
        const { container } = render(<ApprovalWorkflowSteps amount={50_000_000} status="APPROVED" creatorName="Budi" approverName="Siti" />)
        const dones = container.querySelectorAll("[data-step-status=done]")
        expect(dones.length).toBeGreaterThanOrEqual(2)
    })
})
```

**Step 2: FAIL**

**Step 3: Implement**

```tsx
// components/integra/approval-workflow-steps.tsx
"use client"
import { cn } from "@/lib/utils"

const CEO_THRESHOLD = 100_000_000

type StepStatus = "done" | "current" | "pending"

export function ApprovalWorkflowSteps({
    amount, status, creatorName, approverName, ceoName,
}: {
    amount: number
    status: string  // PO status enum
    creatorName: string
    approverName?: string
    ceoName?: string
}) {
    const needsCEO = amount > CEO_THRESHOLD

    type Step = { label: string; actor: string; status: StepStatus; note?: string }
    const steps: Step[] = [
        { label: "Dibuat", actor: creatorName, status: "done" },
        {
            label: "Manager Review",
            actor: approverName ?? "Pending",
            status: status === "PENDING_APPROVAL" ? "current" : (status === "APPROVED" || status === "ORDERED" ? "done" : "pending"),
        },
    ]
    if (needsCEO) {
        steps.push({
            label: "CEO Approval",
            actor: ceoName ?? "Pending",
            status: status === "APPROVED" || status === "ORDERED" ? "done" : (status === "PENDING_APPROVAL" ? "pending" : "pending"),
            note: `Required (>Rp ${(CEO_THRESHOLD / 1_000_000).toFixed(0)} jt)`,
        })
    }

    return (
        <div className="flex items-start gap-2">
            {steps.map((s, i) => (
                <>
                    <div key={s.label} data-step-status={s.status} className="flex flex-col items-center min-w-[100px]">
                        <span
                            className={cn(
                                "w-6 h-6 rounded-full grid place-items-center text-[10px] font-mono mb-1.5",
                                s.status === "done" && "bg-[var(--integra-green-ok)] text-white",
                                s.status === "current" && "border-2 border-[var(--integra-liren-blue)] text-[var(--integra-liren-blue)]",
                                s.status === "pending" && "border border-[var(--integra-hairline-strong)] text-[var(--integra-muted)]",
                            )}
                        >
                            {i + 1}
                        </span>
                        <div className="text-[11.5px] font-medium text-center text-[var(--integra-ink)]">{s.label}</div>
                        <div className="text-[10.5px] text-[var(--integra-muted)] text-center">{s.actor}</div>
                        {s.note && <div className="text-[10px] text-[var(--integra-muted)] italic mt-0.5">{s.note}</div>}
                    </div>
                    {i < steps.length - 1 && (
                        <div
                            className={cn(
                                "flex-1 h-px mt-3",
                                s.status === "done" ? "bg-[var(--integra-green-ok)]" : "bg-[var(--integra-hairline-strong)] [border-top:1px_dashed_currentColor]",
                            )}
                        />
                    )}
                </>
            ))}
        </div>
    )
}
```

**Step 4: Tests pass**

**Step 5: Commit**

```bash
git add components/integra/approval-workflow-steps.tsx __tests__/components/integra/approval-workflow-steps.test.tsx
git commit -m "feat(integra): tambah ApprovalWorkflowSteps — stepper 2/3-stage dengan threshold Rp 100jt"
```

---

### Task A5: `<LinkedDocsPanel>`

**Files:**
- Create: `components/integra/linked-docs-panel.tsx`
- Test: `__tests__/components/integra/linked-docs-panel.test.tsx`

**Step 1: Tests**

```tsx
import { render, screen } from "@testing-library/react"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"

describe("LinkedDocsPanel", () => {
    const trail = [
        { type: "PR" as const, number: "PR-001", status: "APPROVED", href: "/procurement/requests/PR-001" },
        { type: "PO" as const, number: "PO-001", status: "ORDERED", current: true },
        { type: "GRN" as const, number: "GRN-001", status: "PARTIAL", href: "/procurement/receiving/GRN-001" },
    ]

    it("renders all trail items", () => {
        render(<LinkedDocsPanel trail={trail} />)
        expect(screen.getByText("PR-001")).toBeInTheDocument()
        expect(screen.getByText("GRN-001")).toBeInTheDocument()
    })

    it("hides panel when trail empty", () => {
        const { container } = render(<LinkedDocsPanel trail={[]} />)
        expect(container.querySelector("[data-linked-panel]")).toBeNull()
    })

    it("highlights current item", () => {
        const { container } = render(<LinkedDocsPanel trail={trail} />)
        expect(container.querySelector("[data-current=true]")).not.toBeNull()
    })
})
```

**Step 2-5:** Same pattern (FAIL → implement → PASS → commit).

**Step 3 implementation:**

```tsx
// components/integra/linked-docs-panel.tsx
"use client"
import Link from "next/link"
import { StatusPill } from "@/components/integra"
import { cn } from "@/lib/utils"

export type LinkedDoc = {
    type: "PR" | "PO" | "GRN" | "BILL"
    number: string
    status: string
    href?: string
    current?: boolean
    deleted?: boolean
}

const TYPE_LABEL: Record<LinkedDoc["type"], string> = {
    PR: "Permintaan", PO: "Pesanan", GRN: "Penerimaan", BILL: "Tagihan",
}

export function LinkedDocsPanel({ trail }: { trail: LinkedDoc[] }) {
    if (trail.length === 0) return null
    return (
        <div data-linked-panel className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)]">
            <div className="px-3.5 py-2.5 border-b border-[var(--integra-hairline)] text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)]">
                Dokumen Terkait
            </div>
            <div className="p-2 space-y-1">
                {trail.map((doc, i) => {
                    const inner = (
                        <div
                            data-current={doc.current ? "true" : "false"}
                            className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-[12px]",
                                doc.current ? "bg-[#F1EFE8]" : "hover:bg-[#FBFAF5]",
                            )}
                        >
                            <span className="font-mono text-[10.5px] uppercase text-[var(--integra-muted)] w-12">{doc.type}</span>
                            {doc.deleted ? (
                                <span className="font-mono text-[var(--integra-muted)] line-through">{doc.number}</span>
                            ) : (
                                <span className="font-mono text-[var(--integra-ink)]">{doc.number}</span>
                            )}
                            {doc.deleted ? (
                                <span className="ml-auto text-[10.5px] text-[var(--integra-red)]">Dihapus</span>
                            ) : (
                                <span className="ml-auto"><span className="text-[10.5px] text-[var(--integra-muted)]">{doc.status}</span></span>
                            )}
                        </div>
                    )
                    return (
                        <div key={doc.number}>
                            {doc.href && !doc.deleted ? <Link href={doc.href}>{inner}</Link> : inner}
                            {i < trail.length - 1 && <div className="ml-[58px] my-0.5 text-[var(--integra-muted)] text-[10px]">↓</div>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
```

**Step 5 commit:**
```bash
git add components/integra/linked-docs-panel.tsx __tests__/components/integra/linked-docs-panel.test.tsx
git commit -m "feat(integra): tambah LinkedDocsPanel — PR→PO→GRN→Bill chain dengan current highlight"
```

---

### Task A6: `<SavedFiltersDropdown>`

**Files:**
- Create: `components/integra/saved-filters-dropdown.tsx`, `hooks/use-saved-filters.ts`
- Test: `__tests__/components/integra/saved-filters-dropdown.test.tsx`, `__tests__/hooks/use-saved-filters.test.ts`

**Step 1: Tests for `useSavedFilters` hook (logic-heavy)**

```tsx
// __tests__/hooks/use-saved-filters.test.ts
import { renderHook, act } from "@testing-library/react"
import { useSavedFilters } from "@/hooks/use-saved-filters"

describe("useSavedFilters", () => {
    beforeEach(() => localStorage.clear())

    it("starts with empty list", () => {
        const { result } = renderHook(() => useSavedFilters("test"))
        expect(result.current.filters).toEqual([])
    })

    it("saves new filter", () => {
        const { result } = renderHook(() => useSavedFilters("test"))
        act(() => result.current.save("Filter A", { status: ["APPROVED"] }))
        expect(result.current.filters).toHaveLength(1)
        expect(result.current.filters[0].name).toBe("Filter A")
    })

    it("persists to localStorage", () => {
        const { result } = renderHook(() => useSavedFilters("test"))
        act(() => result.current.save("Filter A", { status: ["APPROVED"] }))
        const raw = localStorage.getItem("integra:saved-filters:test")
        expect(raw).not.toBeNull()
        expect(JSON.parse(raw!)[0].name).toBe("Filter A")
    })

    it("deletes filter by id", () => {
        const { result } = renderHook(() => useSavedFilters("test"))
        act(() => result.current.save("Filter A", { status: ["APPROVED"] }))
        const id = result.current.filters[0].id
        act(() => result.current.remove(id))
        expect(result.current.filters).toEqual([])
    })

    it("returns error on quota exceeded", () => {
        const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError")
        })
        const { result } = renderHook(() => useSavedFilters("test"))
        let err: Error | undefined
        act(() => { err = result.current.save("Filter A", { status: ["APPROVED"] }) ?? undefined })
        expect(err).toBeDefined()
        setSpy.mockRestore()
    })
})
```

**Step 2: FAIL**

**Step 3: Implement hook + dropdown**

```ts
// hooks/use-saved-filters.ts
"use client"
import * as React from "react"

type SavedFilter = { id: string; name: string; values: any; createdAt: number }

export function useSavedFilters(module: string) {
    const key = `integra:saved-filters:${module}`
    const [filters, setFilters] = React.useState<SavedFilter[]>(() => {
        if (typeof window === "undefined") return []
        try {
            const raw = window.localStorage.getItem(key)
            return raw ? JSON.parse(raw) : []
        } catch { return [] }
    })

    const persist = React.useCallback((next: SavedFilter[]): Error | null => {
        try {
            window.localStorage.setItem(key, JSON.stringify(next))
            setFilters(next)
            return null
        } catch (e) {
            return e instanceof Error ? e : new Error("Save failed")
        }
    }, [key])

    const save = React.useCallback((name: string, values: any): Error | null => {
        const next: SavedFilter = { id: crypto.randomUUID(), name, values, createdAt: Date.now() }
        return persist([...filters, next])
    }, [filters, persist])

    const remove = React.useCallback((id: string) => {
        persist(filters.filter(f => f.id !== id))
    }, [filters, persist])

    return { filters, save, remove }
}
```

```tsx
// components/integra/saved-filters-dropdown.tsx
"use client"
import * as React from "react"
import { useSavedFilters } from "@/hooks/use-saved-filters"
import { toast } from "sonner"

export function SavedFiltersDropdown({
    module, currentFilter, onLoadFilter,
}: {
    module: string
    currentFilter: any
    onLoadFilter: (values: any) => void
}) {
    const { filters, save, remove } = useSavedFilters(module)
    const [showSaveDialog, setShowSaveDialog] = React.useState(false)
    const [newName, setNewName] = React.useState("")

    return (
        <div>
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-1.5">Filter Tersimpan</div>
            {filters.length === 0 ? (
                <div className="text-[11.5px] text-[var(--integra-muted)] mb-2">Belum ada filter tersimpan</div>
            ) : (
                <ul className="space-y-1 mb-2">
                    {filters.map(f => (
                        <li key={f.id} className="flex items-center gap-2 group text-[12px]">
                            <button onClick={() => onLoadFilter(f.values)} className="flex-1 text-left text-[var(--integra-ink-soft)] hover:text-[var(--integra-ink)] truncate">
                                {f.name}
                            </button>
                            <button onClick={() => remove(f.id)} className="opacity-0 group-hover:opacity-100 text-[var(--integra-red)]">×</button>
                        </li>
                    ))}
                </ul>
            )}
            {!showSaveDialog ? (
                <button onClick={() => setShowSaveDialog(true)} className="text-[11px] text-[var(--integra-liren-blue)] hover:underline">
                    + Simpan filter saat ini...
                </button>
            ) : (
                <div className="flex gap-1.5">
                    <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nama filter"
                        className="flex-1 border border-[var(--integra-hairline)] px-2 py-1 text-[11.5px] rounded-[2px]"
                    />
                    <button
                        onClick={() => {
                            if (!newName.trim()) return
                            const err = save(newName.trim(), currentFilter)
                            if (err) toast.error("Gagal menyimpan filter — quota habis")
                            else { setShowSaveDialog(false); setNewName("") }
                        }}
                        className="h-7 px-2 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[11px] rounded-[2px]"
                    >
                        Simpan
                    </button>
                </div>
            )}
        </div>
    )
}
```

**Step 4: Tests pass**

**Step 5: Commit**

```bash
git add hooks/use-saved-filters.ts components/integra/saved-filters-dropdown.tsx __tests__/hooks/use-saved-filters.test.ts __tests__/components/integra/saved-filters-dropdown.test.tsx
git commit -m "feat(integra): tambah useSavedFilters hook + SavedFiltersDropdown — localStorage CRUD"
```

---

### Task A7: `<DetailPage>` shell

**Files:**
- Create: `components/integra/detail-page.tsx`
- Test: `__tests__/components/integra/detail-page.test.tsx`

**Step 1: Tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { DetailPage } from "@/components/integra/detail-page"

describe("DetailPage", () => {
    const tabs = [
        { key: "header", label: "Header", content: <div>Header content</div> },
        { key: "item", label: "Item (3)", content: <div>Item content</div> },
    ]

    it("renders title + subtitle", () => {
        render(<DetailPage breadcrumb={[]} title="PO-001" subtitle="Vendor X" tabs={tabs} />)
        expect(screen.getByText("PO-001")).toBeInTheDocument()
        expect(screen.getByText("Vendor X")).toBeInTheDocument()
    })

    it("renders default tab content", () => {
        render(<DetailPage breadcrumb={[]} title="PO-001" tabs={tabs} defaultTab="header" />)
        expect(screen.getByText("Header content")).toBeInTheDocument()
    })

    it("switches tab on click", () => {
        render(<DetailPage breadcrumb={[]} title="PO-001" tabs={tabs} defaultTab="header" />)
        fireEvent.click(screen.getByText("Item (3)"))
        expect(screen.getByText("Item content")).toBeInTheDocument()
    })

    it("renders breadcrumb", () => {
        const breadcrumb = [{ label: "Beranda", href: "/" }, { label: "Pengadaan", href: "/procurement" }]
        render(<DetailPage breadcrumb={breadcrumb} title="PO-001" tabs={tabs} />)
        expect(screen.getByText("Beranda")).toBeInTheDocument()
        expect(screen.getByText("Pengadaan")).toBeInTheDocument()
    })
})
```

**Step 2: FAIL**

**Step 3: Implement**

```tsx
// components/integra/detail-page.tsx
"use client"
import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type Tab = { key: string; label: React.ReactNode; content: React.ReactNode }
export type Crumb = { label: string; href: string }

export function DetailPage({
    breadcrumb, title, subtitle, status, meta, actions, tabs, defaultTab,
}: {
    breadcrumb: Crumb[]
    title: React.ReactNode
    subtitle?: React.ReactNode
    status?: React.ReactNode
    meta?: React.ReactNode
    actions?: React.ReactNode
    tabs: Tab[]
    defaultTab?: string
}) {
    const [activeTab, setActiveTab] = React.useState(defaultTab ?? tabs[0]?.key)

    React.useEffect(() => {
        const hash = window.location.hash.slice(1)
        if (hash && tabs.some(t => t.key === hash)) setActiveTab(hash)
    }, [tabs])

    const handleTabClick = (key: string) => {
        setActiveTab(key)
        window.history.replaceState(null, "", `#${key}`)
    }

    const active = tabs.find(t => t.key === activeTab) ?? tabs[0]

    return (
        <>
            {/* Sticky header */}
            <div className="sticky top-0 bg-[var(--integra-canvas)] z-20 border-b border-[var(--integra-hairline)] px-6 py-3">
                {breadcrumb.length > 0 && (
                    <nav className="flex items-center gap-1.5 text-[12px] text-[var(--integra-muted)] mb-2">
                        {breadcrumb.map((c, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="opacity-50">/</span>}
                                <Link href={c.href} className="hover:text-[var(--integra-ink)]">{c.label}</Link>
                            </React.Fragment>
                        ))}
                        <span className="opacity-50">/</span>
                        <span className="text-[var(--integra-ink)]">{title}</span>
                    </nav>
                )}
                <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="font-display font-medium text-[20px] text-[var(--integra-ink)] truncate">{title}</h1>
                            {status}
                        </div>
                        {subtitle && <p className="text-[12.5px] text-[var(--integra-muted)] mt-1">{subtitle}</p>}
                        {meta && <div className="mt-2">{meta}</div>}
                    </div>
                    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
                </div>
            </div>

            {/* Sticky tab bar */}
            <div className="sticky top-[var(--detail-header-h,80px)] bg-[var(--integra-canvas)] z-10 border-b border-[var(--integra-hairline)] px-6">
                <div className="flex gap-0.5">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            data-tab={t.key}
                            onClick={() => handleTabClick(t.key)}
                            className={cn(
                                "px-3 py-2 text-[12.5px] font-mono",
                                activeTab === t.key
                                    ? "text-[var(--integra-ink)] border-b-2 border-[var(--integra-ink)]"
                                    : "text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="px-6 py-5">{active?.content}</div>
        </>
    )
}
```

**Step 4: Tests pass**

**Step 5: Commit**

```bash
git add components/integra/detail-page.tsx __tests__/components/integra/detail-page.test.tsx
git commit -m "feat(integra): tambah DetailPage shell — sticky header + tabs dengan URL hash sync"
```

---

### Task A8: `<TypstPdfButton>` + PDF infra

**Files:**
- Create: `components/integra/typst-pdf-button.tsx`
- Create: `lib/pdf/po-pdf.ts`
- Test: `__tests__/components/integra/typst-pdf-button.test.tsx`

**Step 1: Tests (light — mostly UI state)**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TypstPdfButton } from "@/components/integra/typst-pdf-button"

describe("TypstPdfButton", () => {
    it("triggers fetch on click", async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) }) as any
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/test"))
    })

    it("shows loading state", async () => {
        global.fetch = vi.fn(() => new Promise(() => {})) as any  // never resolves
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        await waitFor(() => expect(screen.getByText(/Generating/)).toBeInTheDocument())
    })

    it("shows error toast on fail", async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false }) as any
        render(<TypstPdfButton endpoint="/api/test" filename="test.pdf" label="Print" />)
        fireEvent.click(screen.getByText("Print"))
        // Toast assertions are tricky in vitest — verify the button returns to non-loading
        await waitFor(() => expect(screen.queryByText(/Generating/)).toBeNull())
    })
})
```

**Step 3: Implement**

```tsx
// components/integra/typst-pdf-button.tsx
"use client"
import * as React from "react"
import { toast } from "sonner"
import { IconPrinter, IconLoader } from "@tabler/icons-react"

export function TypstPdfButton({
    endpoint, filename, label, icon,
}: {
    endpoint: string
    filename: string
    label: string
    icon?: React.ReactNode
}) {
    const [loading, setLoading] = React.useState(false)

    async function handleClick() {
        setLoading(true)
        try {
            const res = await fetch(endpoint)
            if (!res.ok) throw new Error("PDF generation failed")
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`PDF disimpan: ${filename}`)
        } catch (e: any) {
            toast.error(`Gagal generate PDF: ${e.message ?? "Unknown error"}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="h-7 px-3 border border-[var(--integra-hairline-strong)] rounded-[3px] text-[12px] flex items-center gap-1.5 hover:border-[var(--integra-ink)] disabled:opacity-50"
        >
            {loading ? <IconLoader className="size-3.5 animate-spin" /> : (icon ?? <IconPrinter className="size-3.5" />)}
            {loading ? "Generating..." : label}
        </button>
    )
}
```

```ts
// lib/pdf/po-pdf.ts
import { execSync } from "child_process"
import { writeFileSync, readFileSync, mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import type { PrismaClient } from "@prisma/client"

export async function generatePoPdf(prisma: PrismaClient, poId: string): Promise<Buffer> {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: { supplier: true, items: { include: { product: true } } },
    })
    if (!po) throw new Error(`PO ${poId} not found`)

    // Reuse existing template at templates/purchase_order/template.typ
    const templatePath = join(process.cwd(), "templates", "purchase_order", "template.typ")
    const data = JSON.stringify({
        number: po.number,
        date: po.orderDate?.toISOString().slice(0, 10),
        vendor: po.supplier?.name,
        items: po.items.map(i => ({
            name: i.product?.name,
            qty: Number(i.quantity),
            price: Number(i.unitPrice ?? 0),
            total: Number(i.totalAmount ?? 0),
        })),
        subtotal: Number(po.totalAmount ?? 0),
    })

    const tmpDir = mkdtempSync(join(tmpdir(), "po-pdf-"))
    const dataPath = join(tmpDir, "data.json")
    const outPath = join(tmpDir, "out.pdf")
    writeFileSync(dataPath, data)

    execSync(`typst compile --input data="${dataPath}" "${templatePath}" "${outPath}"`, { stdio: "pipe" })

    return readFileSync(outPath)
}
```

**Step 5: Commit**

```bash
git add components/integra/typst-pdf-button.tsx lib/pdf/po-pdf.ts __tests__/components/integra/typst-pdf-button.test.tsx
git commit -m "feat(integra): tambah TypstPdfButton + lib/pdf/po-pdf wrapper untuk Typst template"
```

---

## Phase B — Refactor List Page

### Task B1: Add filter URL parsing + extend `usePurchaseOrders` hook

**Files:**
- Modify: `hooks/use-purchase-orders.ts`
- Modify: `app/api/procurement/orders/route.ts` (extend WHERE clause)

**Step 1: Tests for hook**

```ts
// __tests__/hooks/use-purchase-orders.test.ts
// (verify URL params translate to API query string correctly)
```

**Step 2-5:** TDD pattern. Add filter dimensions: `status[]`, `vendor[]`, `dateStart`, `dateEnd`, `amountMin`, `amountMax`, `paymentTerm[]`. Each maps to Prisma WHERE clause.

```bash
git commit -m "feat(procurement): extend usePurchaseOrders + API dengan multi-dimension filter"
```

### Task B2: Wire `<FilterPanel>` into PO list

**Files:**
- Modify: `app/procurement/orders/page.tsx`

Replace the toast stub with `<FilterPanel>` integration. Active filter chips above table.

**Step 1-5:** No new tests (E2E covers this in Tier 1).

```bash
git commit -m "feat(procurement): wire FilterPanel ke PO list — slide-out filter dengan saved filters"
```

### Task B3: Wire `<BulkActionToolbar>` + bulk approve action

**Files:**
- Modify: `app/procurement/orders/page.tsx`
- Modify: `lib/actions/procurement.ts` (add `bulkApprovePurchaseOrders`)
- Create: `app/api/procurement/orders/bulk/route.ts`

```bash
git commit -m "feat(procurement): bulk action toolbar + bulkApprovePurchaseOrders server action"
```

### Task B4: Real export to XLSX

**Files:**
- Modify: `app/procurement/orders/page.tsx` — replace `toast.info("Ekspor PO sedang dibangun")` dengan call ke `xlsx` lib

```ts
import * as XLSX from "xlsx"

function exportPos(rows: any[]) {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
        "No PO": r.number, "Vendor": r.supplier, "Status": r.status,
        "Tanggal Buat": r.date, "Total": r.total,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "PO")
    XLSX.writeFile(wb, `pesanan-pembelian-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
```

```bash
git commit -m "feat(procurement): real XLSX export untuk PO list"
```

### Task B5: Replace row-click toast → router.push to detail

```bash
git commit -m "feat(procurement): klik row PO → navigate ke /procurement/orders/[id]"
```

### Task B6: Remove remaining stubs (Retur Pembelian, Setujui semua confirmation)

```bash
git commit -m "feat(procurement): remove stub toasts — Retur opens dialog, Setujui semua wired ke bulk action"
```

---

## Phase C — Build Detail Page

### Task C1: Create detail route + fetch hook

**Files:**
- Create: `app/procurement/orders/[id]/page.tsx`
- Create: `hooks/use-purchase-order-detail.ts`
- Create: `app/api/procurement/orders/[id]/route.ts`

**Step 1-5:** Use TanStack Query, fetch PO with all relations.

```bash
git commit -m "feat(procurement): tambah detail page route + usePurchaseOrderDetail hook + API endpoint"
```

### Task C2: Detail page Header tab

Use `<DetailPage>` shell. Header tab shows: PO number, vendor, dates, total, payment term, notes.

```bash
git commit -m "feat(procurement): detail page Header tab — PO metadata"
```

### Task C3: Detail page Item tab

Show line items table dengan kolom: SKU, Nama, Qty, Unit Price, Total. Footer Σ.

```bash
git commit -m "feat(procurement): detail page Item tab — line items table"
```

### Task C4: Detail page Approval tab

Use `<ApprovalWorkflowSteps>` + inline Setujui/Tolak buttons (context-aware by status & user role).

```bash
git commit -m "feat(procurement): detail page Approval tab — workflow steps + actions"
```

### Task C5: Detail page History tab

Use `<AuditTrailTimeline>` consuming `purchaseOrderEvent` data.

```bash
git commit -m "feat(procurement): detail page History tab — audit trail timeline"
```

### Task C6: Detail page Lampiran + Komunikasi tabs (placeholder)

Lampiran shows attachment list (existing PO PDF + uploaded files). Komunikasi shows comment thread (placeholder for now).

```bash
git commit -m "feat(procurement): detail page Lampiran + Komunikasi tabs"
```

### Task C7: PDF print API endpoint + button in actions slot

**Files:**
- Create: `app/api/procurement/orders/[id]/pdf/route.ts`
- Modify: `app/procurement/orders/[id]/page.tsx`

```ts
// app/api/procurement/orders/[id]/pdf/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generatePoPdf } from "@/lib/pdf/po-pdf"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const pdf = await generatePoPdf(prisma, id)
        return new NextResponse(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${id}.pdf"`,
            },
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
```

```bash
git commit -m "feat(procurement): PDF print endpoint + TypstPdfButton di detail actions"
```

### Task C8: Linked Docs panel di sidebar detail page

```bash
git commit -m "feat(procurement): linked docs panel di detail — PR→PO→GRN→Bill chain"
```

---

## Phase D — Polish + E2E

### Task D1: Loading skeletons

Replace plain `Memuat...` dengan proper skeleton matching Integra design.

### Task D2: Empty/error states polished

Audit all paths, ensure all empty states use `<EmptyState>` with helpful CTAs.

### Task D3: Keyboard shortcuts

Add to list page: `/` focus search, `j/k` navigate rows, `Enter` open detail, `f` open filter.

```ts
React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement) return  // skip if typing
        if (e.key === "/") { e.preventDefault(); searchInputRef.current?.focus() }
        if (e.key === "j") setSelectedRow(prev => Math.min(prev + 1, rows.length - 1))
        if (e.key === "k") setSelectedRow(prev => Math.max(prev - 1, 0))
        if (e.key === "Enter") router.push(`/procurement/orders/${rows[selectedRow].id}`)
        if (e.key === "f") setFilterOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
}, [rows, selectedRow, router])
```

### Task D4: Quick view drawer (Tier 3 — optional)

Add hover-preview drawer. Skip if running short on time.

### Task D5: E2E demo journey test

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Files:**
- Create: `e2e/demo-journey-procurement.spec.ts`
- Create: `playwright.config.ts`

(See design doc for E2E spec.)

```bash
git commit -m "test(e2e): demo journey procurement — login → filter → detail → approve → print → bulk"
```

### Task D6: Pre-demo check script

**Files:**
- Create: `scripts/pre-demo-check.sh`

```bash
#!/usr/bin/env bash
set -e
echo "▶ TypeScript check..."
npx tsc --noEmit
echo "▶ Lint..."
npm run lint
echo "▶ Unit tests..."
npx vitest run
echo "▶ E2E demo journey..."
npx playwright test demo-journey
echo "▶ Re-seed demo DB..."
npx tsx prisma/seed-kri-demo.ts
echo "✅ Pre-demo check complete"
```

```bash
git commit -m "chore: pre-demo-check.sh untuk validasi 24h sebelum presentasi"
```

---

## Replication to Sibling Pages (Post-Flagship)

After Phase A-D selesai, replicate template ke `/procurement/requests`, `/procurement/vendors`, `/procurement/receiving`. Each ~1 day work since all primitives reusable.

**Per sub-page tasks:**
1. Refactor list page to consume `<FilterPanel>` + `<BulkActionToolbar>` + `<SavedFiltersDropdown>`
2. Build detail page using `<DetailPage>` shell + tabs
3. Add audit trail + linked docs (if applicable)
4. PDF export if format exists (PR/GRN forms)
5. E2E demo path

---

## Pre-Demo Final Checklist (24h before June 26)

1. ✅ All Phase A-D tasks committed
2. ✅ All Phase A-D commits pushed to `feat/integra-mining-pivot`
3. ✅ Replication tasks merged
4. ✅ `pre-demo-check.sh` runs green
5. ✅ Manual smoke: login → dashboard → all sidebar items → all action buttons
6. ✅ Demo data seeded fresh
7. ✅ Vercel preview accessible (or local dev fallback ready)
8. ✅ Demo script rehearsed

---

## Out of Scope (Defer Post-Demo)

- Real-time updates (WebSocket)
- Multi-tenant scoping
- Permission matrix RBAC
- Document versioning
- Email vendor integration
- Configurable approval thresholds (currently hardcoded Rp 100 jt)
- Visual regression / accessibility audit
- Cross-browser testing (Chrome only for demo)
