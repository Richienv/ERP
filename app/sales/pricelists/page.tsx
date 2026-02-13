export const dynamic = "force-dynamic"

import { getAllPriceLists } from "@/lib/actions/sales"
import { PriceListsClient } from "./client-view"

export default async function PriceListsPage() {
    const priceLists = await getAllPriceLists()

    return <PriceListsClient initialPriceLists={priceLists} />
}
