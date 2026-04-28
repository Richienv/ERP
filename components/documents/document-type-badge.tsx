"use client"
import { cn } from '@/lib/utils'

const LABELS: Record<string, { label: string; color: string }> = {
    PO:             { label: 'Purchase Order',   color: 'bg-blue-100 text-blue-800 border-blue-300' },
    PR:             { label: 'Purchase Request', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    GRN:            { label: 'Surat Jalan Masuk', color: 'bg-green-100 text-green-800 border-green-300' },
    VENDOR_PROFILE: { label: 'Profil Vendor',    color: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
    INVOICE_AR:     { label: 'Invoice (AR)',     color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    INVOICE_AP:     { label: 'Invoice (AP)',     color: 'bg-amber-100 text-amber-800 border-amber-300' },
    FAKTUR_PAJAK:   { label: 'Faktur Pajak',     color: 'bg-red-100 text-red-800 border-red-300' },
    PAYSLIP:        { label: 'Slip Gaji',        color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    BOM:            { label: 'BOM',              color: 'bg-pink-100 text-pink-800 border-pink-300' },
    SPK:            { label: 'SPK',              color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
}

export function DocumentTypeBadge({ type }: { type: string }) {
    const meta = LABELS[type] ?? { label: type, color: 'bg-zinc-100 text-zinc-700 border-zinc-300' }
    return (
        <span className={cn('inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none border', meta.color)}>
            {meta.label}
        </span>
    )
}
