import { Suspense } from "react"
import { getVendors } from "@/app/actions/vendor"
import { VendorsView } from "@/app/procurement/vendors/vendors-view"
import { Loader2 } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
    const vendors = await getVendors()

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        }>
            <VendorsView initialVendors={vendors} />
        </Suspense>
    )
}
