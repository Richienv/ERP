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
        <div className="bg-amber-50 border border-amber-300 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-800">
                    {data.count} transaksi bank belum direkonsiliasi
                </span>
            </div>
            <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                Terdapat Rp {formatIDR(data.totalAmount)} dalam transaksi bank yang belum direkonsiliasi
                pada periode ini. Laporan keuangan mungkin tidak akurat.
            </p>
            <button
                onClick={() => router.push("/finance/reconciliation")}
                className="mt-2 text-xs font-semibold px-3 py-1.5 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-colors"
            >
                Selesaikan Rekonsiliasi →
            </button>
        </div>
    )
}
