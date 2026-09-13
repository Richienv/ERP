import { getVendorAPBalances, getVendorBills, getVendorPayments } from "@/lib/actions/finance-ap"
import { getVendors } from "@/lib/actions/procurement"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

const OPEN_BILL_STATUSES = new Set(["ISSUED", "PARTIAL", "OVERDUE"])

export async function GET() {
    return handleReadApi(async () => {
        const [payments, vendorsRaw, allBills, apBalances] = await Promise.all([
            getVendorPayments(),
            getVendors(),
            getVendorBills(),
            getVendorAPBalances(),
        ])
        const vendors = vendorsRaw.map((vendor) => ({ id: vendor.id, name: vendor.name }))
        const openBills = allBills.filter((bill) => OPEN_BILL_STATUSES.has(bill.status))
        return { payments, vendors, openBills, apBalances }
    }, { cache: "REALTIME", failMessage: "Gagal memuat pembayaran vendor" })
}
