import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import { ReceivingView } from "./receiving-view"

export async function ReceivingWrapper() {
    const [pendingPOs, grns, warehouses, employees] = await Promise.all([
        getPendingPOsForReceiving(),
        getAllGRNs(),
        getWarehousesForGRN(),
        getEmployeesForGRN()
    ])

    return (
        <ReceivingView 
            pendingPOs={pendingPOs} 
            grns={grns}
            warehouses={warehouses}
            employees={employees}
        />
    )
}
