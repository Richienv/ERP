import { NextRequest } from "next/server"
import { getVendorBillsRegistry } from "@/lib/actions/finance-ap"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") || "1")
    const pageSize = Number(url.searchParams.get("pageSize") || "20")
    return handleReadApi(
        () => getVendorBillsRegistry({
            q: url.searchParams.get("q"),
            status: url.searchParams.get("status"),
            page: Number.isFinite(page) ? page : 1,
            pageSize: Number.isFinite(pageSize) ? pageSize : 20,
        }),
        { cache: "REALTIME", failMessage: "Gagal memuat tagihan vendor" },
    )
}
