"use client"

import { useWarehouses } from "@/hooks/use-warehouses"
import { WarehousesClient } from "./warehouses-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function WarehousesPage() {
    const { data, isLoading } = useWarehouses()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    return (
        <div className="mf-page">
            <WarehousesClient warehouses={data} />
        </div>
    )
}
