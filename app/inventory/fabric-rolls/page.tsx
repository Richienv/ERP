import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getFabricRolls, getWarehousesForRolls, getFabricProducts } from "@/lib/actions/fabric-rolls"
import { FabricRollList } from "@/components/inventory/fabric-roll-list"

export const dynamic = "force-dynamic"

async function FabricRollData() {
    const [rolls, warehouses, products] = await Promise.all([
        getFabricRolls(),
        getWarehousesForRolls(),
        getFabricProducts(),
    ])

    return (
        <FabricRollList
            rolls={rolls}
            products={products}
            warehouses={warehouses}
        />
    )
}

function FabricRollSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
        </div>
    )
}

export default function FabricRollsPage() {
    return (
        <div className="mf-page">
            <div>
                <h2 className="mf-title">Fabric Rolls</h2>
                <p className="text-muted-foreground">Tracking per-roll kain: penerimaan, pemotongan, sisa meter.</p>
            </div>

            <Suspense fallback={<FabricRollSkeleton />}>
                <FabricRollData />
            </Suspense>
        </div>
    )
}
