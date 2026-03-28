"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ─── Style Constants (reference: payments-view.tsx Catat Penerimaan Baru) ───

const ACTIVE_ORANGE =
    "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 font-bold"
const EMPTY_ZINC =
    "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
const ACTIVE_EMERALD =
    "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
const LABEL_CLASS =
    "text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block"

const NB_SENTINEL = "__NB_EMPTY__"

const SIZE_MAP = {
    default: "max-w-3xl sm:max-w-3xl",
    narrow: "max-w-xl sm:max-w-xl",
    wide: "max-w-4xl sm:max-w-4xl",
} as const

type IconComponent = React.ComponentType<{ className?: string }>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHELL COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NBDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    size?: "default" | "narrow" | "wide"
    children: React.ReactNode
}

function NBDialog({ open, onOpenChange, size = "default", children }: NBDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className={cn(
                    SIZE_MAP[size],
                    "p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0"
                )}
            >
                {children}
            </DialogContent>
        </Dialog>
    )
}

// ─── Header ───

interface NBDialogHeaderProps {
    icon: IconComponent
    title: string
    subtitle?: string
}

function NBDialogHeader({ icon: Icon, title, subtitle }: NBDialogHeaderProps) {
    return (
        <DialogHeader className="bg-black text-white px-5 py-3">
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Icon className="h-4 w-4" /> {title}
            </DialogTitle>
            {subtitle && (
                <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                    {subtitle}
                </p>
            )}
        </DialogHeader>
    )
}

// ─── Body (scrollable) ───

interface NBDialogBodyProps {
    children: React.ReactNode
}

function NBDialogBody({ children }: NBDialogBodyProps) {
    return (
        <div className="overflow-y-auto max-h-[72vh]">
            <div className="p-4 space-y-3">{children}</div>
        </div>
    )
}

// ─── Footer (sticky) ───

interface NBDialogFooterProps {
    onCancel: () => void
    onSubmit: () => void
    submitting?: boolean
    submitLabel: string
    disabled?: boolean
}

function NBDialogFooter({
    onCancel,
    onSubmit,
    submitting,
    submitLabel,
    disabled,
}: NBDialogFooterProps) {
    return (
        <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
            <Button
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
                className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
            >
                Batal
            </Button>
            <Button
                onClick={onSubmit}
                disabled={submitting || disabled}
                className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
            >
                {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {submitting ? "Menyimpan..." : submitLabel}
            </Button>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NBSectionProps {
    icon: IconComponent
    title: string
    optional?: boolean
    children: React.ReactNode
}

function NBSection({ icon: Icon, title, optional, children }: NBSectionProps) {
    return (
        <div className="border border-zinc-200 dark:border-zinc-700">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {title}
                </span>
                {optional && (
                    <span className="text-[10px] font-medium text-zinc-400 ml-auto">
                        opsional
                    </span>
                )}
            </div>
            <div className="p-3 space-y-3">{children}</div>
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ATOMIC FIELD COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── NBInput ───

interface NBInputProps {
    label: string
    required?: boolean
    value: string
    onChange: (value: string) => void
    type?: "text" | "date" | "number"
    placeholder?: string
    disabled?: boolean
    className?: string
}

function NBInput({
    label,
    required,
    value,
    onChange,
    type = "text",
    placeholder,
    disabled,
    className,
}: NBInputProps) {
    const hasValue = value !== "" && value !== undefined
    return (
        <div className={className}>
            <label className={LABEL_CLASS}>
                {label}{" "}
                {required && <span className="text-red-500">*</span>}
            </label>
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    "border font-medium h-8 text-sm rounded-none transition-colors placeholder:text-zinc-400 placeholder:italic placeholder:font-normal",
                    hasValue ? ACTIVE_ORANGE : EMPTY_ZINC
                )}
            />
        </div>
    )
}

// ─── NBCurrencyInput ───

interface NBCurrencyInputProps {
    label: string
    required?: boolean
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    className?: string
}

function NBCurrencyInput({
    label,
    required,
    value,
    onChange,
    disabled,
    className,
}: NBCurrencyInputProps) {
    const hasValue = Number(value) > 0
    return (
        <div className={className}>
            <label className={LABEL_CLASS}>
                {label}{" "}
                {required && <span className="text-red-500">*</span>}
            </label>
            <div
                className={cn(
                    "flex items-center border h-8 rounded-none transition-colors",
                    hasValue ? ACTIVE_EMERALD : EMPTY_ZINC
                )}
            >
                <span
                    className={cn(
                        "pl-2 text-[10px] font-bold select-none",
                        hasValue
                            ? "text-emerald-500"
                            : "text-zinc-300 dark:text-zinc-600"
                    )}
                >
                    Rp
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    disabled={disabled}
                    className={cn(
                        "w-full h-full bg-transparent text-right text-sm font-mono font-bold pr-2 pl-1 outline-none placeholder:text-zinc-300 placeholder:font-normal",
                        hasValue
                            ? "text-emerald-700 dark:text-emerald-400"
                            : ""
                    )}
                    value={
                        Number(value)
                            ? Number(value).toLocaleString("id-ID")
                            : value
                    }
                    onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "")
                        onChange(raw)
                    }}
                />
            </div>
        </div>
    )
}

// ─── NBSelect ───

interface NBSelectOption {
    value: string
    label: string
}

interface NBSelectProps {
    label: string
    required?: boolean
    value: string
    onValueChange: (value: string) => void
    options?: NBSelectOption[]
    placeholder?: string
    emptyLabel?: string
    disabled?: boolean
    className?: string
    children?: React.ReactNode
}

function NBSelect({
    label,
    required,
    value,
    onValueChange,
    options,
    placeholder,
    emptyLabel,
    disabled,
    className,
    children,
}: NBSelectProps) {
    const hasValue = value !== "" && value !== undefined

    const handleValueChange = (val: string) => {
        onValueChange(val === NB_SENTINEL ? "" : val)
    }

    return (
        <div className={className}>
            <label className={LABEL_CLASS}>
                {label}{" "}
                {required && <span className="text-red-500">*</span>}
            </label>
            <Select
                value={value || NB_SENTINEL}
                onValueChange={handleValueChange}
                disabled={disabled}
            >
                <SelectTrigger
                    className={cn(
                        "h-8 text-sm rounded-none border",
                        hasValue ? ACTIVE_ORANGE : EMPTY_ZINC
                    )}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {placeholder && (
                        <SelectItem value={NB_SENTINEL}>
                            {emptyLabel ?? placeholder}
                        </SelectItem>
                    )}
                    {options
                        ? options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                              </SelectItem>
                          ))
                        : children}
                </SelectContent>
            </Select>
        </div>
    )
}

// ─── NBTextarea ───

interface NBTextareaProps {
    label: string
    required?: boolean
    value: string
    onChange: (value: string) => void
    placeholder?: string
    rows?: number
    disabled?: boolean
    className?: string
}

function NBTextarea({
    label,
    required,
    value,
    onChange,
    placeholder,
    rows = 3,
    disabled,
    className,
}: NBTextareaProps) {
    const hasValue = value !== "" && value !== undefined
    return (
        <div className={className}>
            <label className={LABEL_CLASS}>
                {label}{" "}
                {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
                className={cn(
                    "w-full border text-sm rounded-none transition-colors px-3 py-2 outline-none resize-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal",
                    hasValue ? ACTIVE_ORANGE : EMPTY_ZINC
                )}
            />
        </div>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBSelect,
    NBTextarea,
}

export type { NBSelectOption }
