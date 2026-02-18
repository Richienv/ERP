"use client"

import { ArrowLeft, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { useProcurementRequestForm } from "@/hooks/use-procurement-request-form"
import { CreateRequestForm } from "@/components/procurement/create-request-form"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function NewRequestPage() {
    const { data, isLoading } = useProcurementRequestForm()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-violet-400" />
    }

    return (
        <div className="mf-page">
            <div className="max-w-4xl">
            <Link
                href="/procurement/requests"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Permintaan
            </Link>

            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-violet-400">
                    <ClipboardList className="h-5 w-5 text-violet-500" />
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                            Buat Permintaan Baru
                        </h1>
                        <p className="text-zinc-400 text-xs font-medium mt-0.5">
                            Draft Purchase Request untuk pengadaan barang
                        </p>
                    </div>
                </div>
            </div>

            <CreateRequestForm
                products={data.products}
                employees={data.employees}
            />
            </div>
        </div>
    )
}
