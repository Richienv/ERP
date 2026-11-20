"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuotationDetail } from "@/hooks/use-quotation-detail"
import { QuotationForm } from "@/components/sales/quotation-form"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function EditQuotationPage() {
    const { id } = useParams<{ id: string }>()
    const { data: quotation, isLoading } = useQuotationDetail(id)

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    if (!quotation) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Penawaran Tidak Ditemukan</h1>
                <Button asChild variant="outline" className="mt-4 border border-border rounded-md">
                    <Link href="/sales/quotations">Kembali</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="mf-page">
            <div className="max-w-5xl">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild className="border border-border rounded-md shadow-sm">
                    <Link href={`/sales/quotations/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Edit Penawaran</h1>
                    <p className="text-zinc-400 text-xs font-medium  ">{quotation.number}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm p-6">
                <QuotationForm initialData={quotation} />
            </div>
            </div>
        </div>
    )
}
