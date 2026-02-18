"use client"

import { useFabricRolls } from "@/hooks/use-fabric-rolls"
import { FabricRollList } from "@/components/inventory/fabric-roll-list"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function FabricRollsPage() {
    const { data, isLoading } = useFabricRolls()

    return (
        <div className="mf-page">
            <div>
                <h2 className="mf-title">Fabric Rolls</h2>
                <p className="text-muted-foreground">Tracking per-roll kain: penerimaan, pemotongan, sisa meter.</p>
            </div>

            {isLoading || !data ? (
                <TablePageSkeleton accentColor="bg-violet-400" />
            ) : (
                <FabricRollList
                    rolls={data.rolls}
                    products={data.products}
                    warehouses={data.warehouses}
                />
            )}
        </div>
    )
}
