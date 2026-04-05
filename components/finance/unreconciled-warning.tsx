"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { getUnreconciledBankEntryCount } from "@/lib/actions/finance-reports"

interface UnreconciledWarningProps {
    startDate: Date
    endDate: Date
}

export function UnreconciledWarning({ startDate, endDate }: UnreconciledWarningProps) {
    const router = useRouter()
    const [data, setData] = useState<{ count: number; totalAmount: number } | null>(null)

    useEffect(() => {
        let cancelled = false
        getUnreconciledBankEntryCount(startDate, endDate)
            .then(result => { if (!cancelled) setData(result) })
            .catch(() => { /* silently ignore — warning is non-critical */ })
        return () => { cancelled = true }
    }, [startDate.toISOString(), endDate.toISOString()])

    if (!data || data.count === 0) return null

    const formatIDR = (n: number) => n.toLocaleString("id-ID")

    return (
        <div className="bg-amber-50 border-2 border-amber-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] p-4 mb-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                    {data.count} transaksi bank belum direkonsiliasi
                </span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                Terdapat Rp {formatIDR(data.totalAmount)} dalam transaksi bank yang belum direkonsiliasi
                pada periode ini. Laporan keuangan mungkin tidak akurat.
            </p>
            <button
                onClick={() => router.push("/finance/reconciliation")}
                className="mt-2 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-colors"
            >
                Selesaikan Rekonsiliasi →
            </button>
        </div>
    )
}
