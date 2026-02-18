"use client"

import { useQuotations } from "@/hooks/use-quotations"
import QuotationsClient from "./client-view"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function QuotationsPage() {
    const { data, isLoading } = useQuotations()

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-blue-400" />
    }

    return <QuotationsClient initialQuotations={data ?? []} />
}
