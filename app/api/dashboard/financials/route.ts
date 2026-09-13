import { getDashboardFinancials } from "@/app/actions/dashboard"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(getDashboardFinancials, {
        cache: "DASHBOARD",
        failMessage: "Gagal memuat ringkasan keuangan",
    })
}
