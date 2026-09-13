import { NextRequest } from "next/server"
import { getInvoiceKanbanData } from "@/lib/actions/finance-invoices"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const type = url.searchParams.get("type")
    return handleReadApi(
        () => getInvoiceKanbanData({
            q: url.searchParams.get("q"),
            type: type === "INV_OUT" || type === "INV_IN" ? type : "ALL",
        }),
        { cache: "REALTIME", failMessage: "Gagal memuat invoice" },
    )
}
