"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()

    useEffect(() => {
        // Redirect to invoices page with the invoice ID as a query param
        // so the Kanban page can highlight/open it
        router.replace(`/finance/invoices?highlight=${id}`)
    }, [id, router])

    return (
        <div className="mf-page flex items-center justify-center min-h-[50vh]">
            <div className="text-center space-y-2">
                <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                    Mengalihkan ke halaman invoice...
                </p>
            </div>
        </div>
    )
}
