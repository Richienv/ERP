"use client"

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useProcurementRequestForm } from "@/hooks/use-procurement-request-form"
import { CreateRequestForm } from "@/components/procurement/create-request-form"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function NewRequestPage() {
    const { data, isLoading } = useProcurementRequestForm()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-zinc-400" />
    }

    return (
        <div className="mf-page">
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/procurement/requests"
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Permintaan
                </Link>

                <CreateRequestForm
                    products={data.products}
                    employees={data.employees}
                />
            </div>
        </div>
    )
}
