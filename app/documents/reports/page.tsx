"use client"

import { useDocuments } from "@/hooks/use-documents"
import { ReportsView } from "./reports-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

export default function DocumentsReportsPage() {
    const { data, isLoading, error } = useDocuments()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-violet-400" />
    }

    if (error || !data) {
        return (
            <div className="mf-page">
                <div className="border-2 border-red-400 bg-red-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-red-700">Gagal Memuat Laporan Sistem</h2>
                    </div>
                    <p className="text-xs text-red-700/80">{error?.message || "Terjadi kesalahan."}</p>
                </div>
            </div>
        )
    }

    return (
        <ReportsView
            documents={data.documents}
            documentsMeta={data.documentsMeta}
            documentsQuery={data.documentsQuery}
        />
    )
}
