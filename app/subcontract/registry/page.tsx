"use client"

import { useSubcontractRegistry } from "@/hooks/use-subcontract-registry"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { SubcontractorList } from "@/components/subcontract/subcontractor-list"

export default function SubcontractRegistryPage() {
    const { data, isLoading } = useSubcontractRegistry()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-orange-400" />

    return (
        <div className="p-6 space-y-6">
            <SubcontractorList subcontractors={data.subcontractors} />
        </div>
    )
}
