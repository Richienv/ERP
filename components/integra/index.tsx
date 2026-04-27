/**
 * Integra design system components — Bloomberg-lite corporate.
 *
 * Use these inside any page wrapped in `<div className="integra-app">`
 * (or as a top-level export in app/layout.tsx for full-app integration).
 *
 * All numerics use mono font + tnum. All text in Indonesian.
 */
"use client"

import * as React from "react"
import Link from "next/link"
import { INT } from "@/lib/integra-tokens"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────
// PANEL — card on canvas
// ─────────────────────────────────────────────────────────────────

export function Panel({
    title,
    meta,
    actions,
    children,
    bodyClassName,
    className,
}: {
    title?: React.ReactNode
    meta?: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
    bodyClassName?: string
    className?: string
}) {
    return (
        <div className={cn(INT.panel, className)}>
            {(title || meta || actions) && (
                <div className={INT.panelHead}>
                    <div className="flex items-center gap-2.5">
                        {title && <h3 className={INT.panelTitle}>{title}</h3>}
                        {meta && <span className={INT.panelMeta}>{meta}</span>}
                    </div>
                    {actions && <div className="flex items-center gap-1">{actions}</div>}
                </div>
            )}
            <div className={cn(INT.panelBody, bodyClassName)}>{children}</div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// KPI RAIL + KPI CELL
// ─────────────────────────────────────────────────────────────────

export type KPIData = {
    label: string
    value: React.ReactNode  // formatted display (string or jsx)
    unit?: string           // "Rp", "%", "hari"
    delta?: number          // signed percentage (0.084 = +8.4%)
    deltaKind?: "up" | "down" | "flat"
    deltaText?: string      // override delta display
    foot?: React.ReactNode  // context text after delta
}

export function KPIRail({ items }: { items: KPIData[] }) {
    return (
        <div className={INT.kpiRail}>
            {items.map((item, i) => (
                <KPI key={i} {...item} />
            ))}
        </div>
    )
}

export function KPI({ label, value, unit, delta, deltaKind, deltaText, foot }: KPIData) {
    return (
        <div className={INT.kpiCell}>
            <div className={INT.kpiLabel}>{label}</div>
            <div>
                <div className={INT.kpiValueRow}>
                    {unit && unit === "Rp" && <span className={INT.kpiUnit}>{unit}</span>}
                    <span className={INT.kpiValue}>{value}</span>
                    {unit && unit !== "Rp" && <span className={INT.kpiUnit}>{unit}</span>}
                </div>
                {(delta !== undefined || deltaText || foot) && (
                    <div className={cn(INT.kpiFoot, "mt-1")}>
                        {deltaKind && (delta !== undefined || deltaText) && (
                            <DeltaPill kind={deltaKind} value={deltaText ?? formatDelta(delta!)} />
                        )}
                        {foot}
                    </div>
                )}
            </div>
        </div>
    )
}

function formatDelta(n: number): string {
    const arrow = n > 0 ? "▲" : n < 0 ? "▼" : "—"
    const abs = Math.abs(n * 100).toFixed(1).replace(".", ",")
    return `${arrow} ${abs}%`
}

// ─────────────────────────────────────────────────────────────────
// PILLS
// ─────────────────────────────────────────────────────────────────

export function DeltaPill({ kind, value }: { kind: "up" | "down" | "flat"; value: string }) {
    const cls = kind === "up" ? INT.deltaUp : kind === "down" ? INT.deltaDown : INT.deltaFlat
    return <span className={cls}>{value}</span>
}

export function StatusPill({
    kind,
    children,
}: {
    kind: "ok" | "warn" | "err" | "info" | "neutral" | "outline"
    children: React.ReactNode
}) {
    const map = {
        ok: INT.pillOk,
        warn: INT.pillWarn,
        err: INT.pillErr,
        info: INT.pillInfo,
        neutral: INT.pillNeutral,
        outline: INT.pillOutline,
    }
    return (
        <span className={map[kind]}>
            <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: "currentColor", opacity: 0.6 }} />
            {children}
        </span>
    )
}

// ─────────────────────────────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────────────────────────────

export function IntegraButton({
    variant = "secondary",
    children,
    onClick,
    type = "button",
    href,
    className,
    icon,
    disabled,
    title,
}: {
    variant?: "primary" | "secondary" | "ghost"
    children: React.ReactNode
    onClick?: () => void
    type?: "button" | "submit"
    href?: string
    className?: string
    icon?: React.ReactNode
    disabled?: boolean
    title?: string
}) {
    const cls = cn(
        variant === "primary" ? INT.btnPrimary :
            variant === "ghost" ? INT.btnGhost :
                INT.btnSecondary,
        className,
    )
    if (href && !disabled) {
        return (
            <Link href={href} className={cls} title={title}>
                {icon}
                {children}
            </Link>
        )
    }
    return (
        <button type={type} onClick={onClick} className={cls} disabled={disabled} title={title}>
            {icon}
            {children}
        </button>
    )
}

// ─────────────────────────────────────────────────────────────────
// DATA TABLE — dense 30px rows, mono numeric columns
// ─────────────────────────────────────────────────────────────────

export type ColumnDef<T> = {
    key: string
    header: React.ReactNode
    render: (row: T) => React.ReactNode
    align?: "left" | "right" | "center"
    type?: "text" | "num" | "code" | "primary" | "muted" | "pill"
    width?: string  // e.g. "120px"
}

export function DataTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    rowClassName,
    totals,
    emptyMessage = "Tidak ada data",
}: {
    columns: ColumnDef<T>[]
    rows: T[]
    rowKey: (row: T) => string | number
    onRowClick?: (row: T) => void
    rowClassName?: (row: T, index: number) => string | undefined
    totals?: T  // optional totals row at bottom
    emptyMessage?: string
}) {
    if (rows.length === 0) {
        return (
            <div className="text-center py-10 text-[12.5px] text-[var(--integra-muted)]">
                {emptyMessage}
            </div>
        )
    }
    return (
        <div className={INT.tableWrap}>
            <table className={INT.table}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                className={c.align === "right" || c.type === "num" ? INT.thNum : INT.th}
                                style={c.width ? { width: c.width } : undefined}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => (
                        <tr
                            key={rowKey(r)}
                            className={cn(
                                INT.rowHover,
                                onRowClick && "cursor-pointer",
                                rowClassName?.(r, idx),
                            )}
                            onClick={onRowClick ? () => onRowClick(r) : undefined}
                        >
                            {columns.map((c) => (
                                <td key={c.key} className={cellClass(c)}>{c.render(r)}</td>
                            ))}
                        </tr>
                    ))}
                    {totals && (
                        <tr className={cn(INT.rowTotal)}>
                            {columns.map((c) => (
                                <td key={c.key} className={cellClass(c)}>{c.render(totals)}</td>
                            ))}
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

function cellClass<T>(c: ColumnDef<T>) {
    if (c.type === "num" || c.align === "right") return INT.tdNum
    if (c.type === "code") return INT.tdCode
    if (c.type === "primary") return INT.tdPrimary
    if (c.type === "muted") return INT.tdMuted
    return INT.td
}

// ─────────────────────────────────────────────────────────────────
// PAGE HEAD (above main content, under topbar)
// ─────────────────────────────────────────────────────────────────

export function PageHead({
    title,
    subtitle,
    metaRight,
}: {
    title: string
    subtitle?: string
    metaRight?: React.ReactNode
}) {
    return (
        <div className={INT.pageHead}>
            <div>
                <h1 className={INT.pageTitle}>{title}</h1>
                {subtitle && <p className={INT.pageSubtitle}>{subtitle}</p>}
            </div>
            {metaRight && <div className={INT.pageMetaRight}>{metaRight}</div>}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// LIVE DOT (pulsing green for "live data" indicator)
// ─────────────────────────────────────────────────────────────────

export function LiveDot() {
    return (
        <span className="relative inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--integra-green-ok)] animate-pulse" />
            <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-[var(--integra-green-ok)] animate-ping opacity-60" />
        </span>
    )
}

// ─────────────────────────────────────────────────────────────────
// SEGMENTED BUTTON GROUP (period selector, view toggle)
// ─────────────────────────────────────────────────────────────────

export function SegmentedButtons<T extends string>({
    options,
    value,
    onChange,
}: {
    options: Array<{ value: T; label: React.ReactNode }>
    value: T
    onChange: (v: T) => void
}) {
    return (
        <div className={INT.periodSelector}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(INT.periodBtn, value === opt.value && INT.periodBtnActive)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// UTIL BAR (progress bar with threshold colors)
// ─────────────────────────────────────────────────────────────────

export function UtilBar({
    value,  // 0-100
    label,
    rightText,
    thresholds = { red: 90, amber: 70 },
}: {
    value: number
    label?: React.ReactNode
    rightText?: React.ReactNode
    thresholds?: { red: number; amber: number }
}) {
    const color =
        value >= thresholds.red ? "bg-[var(--integra-red)]" :
            value >= thresholds.amber ? "bg-[var(--integra-amber)]" :
                "bg-[var(--integra-ink)]"
    return (
        <div className="flex items-center gap-3">
            {label && <div className="w-[120px] text-[12px] text-[var(--integra-ink-soft)]">{label}</div>}
            <div className="flex-1 h-1.5 bg-[#F1EFE8] rounded-[2px] overflow-hidden">
                <div
                    className={cn("h-full transition-all", color)}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
            {rightText && <div className="w-[70px] text-right font-mono text-[12px] text-[var(--integra-ink)] tnum">{rightText}</div>}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string
    description?: string
    action?: React.ReactNode
}) {
    return (
        <div className="text-center py-10 px-4">
            <h3 className="text-[13px] font-medium text-[var(--integra-ink)]">{title}</h3>
            {description && (
                <p className="text-[12px] text-[var(--integra-muted)] mt-1 mb-4 max-w-sm mx-auto">
                    {description}
                </p>
            )}
            {action}
        </div>
    )
}
