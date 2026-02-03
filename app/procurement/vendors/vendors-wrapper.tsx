import { getVendors } from "@/app/actions/vendor"
import { VendorsView } from "@/app/procurement/vendors/vendors-view"

export async function VendorsWrapper() {
    const vendors = await getVendors()
    return <VendorsView initialVendors={vendors} />
}
