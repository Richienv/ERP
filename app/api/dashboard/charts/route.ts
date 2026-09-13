import { getDashboardCharts } from "@/app/actions/dashboard"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(getDashboardCharts, {
        cache: "DASHBOARD",
        failMessage: "Gagal memuat grafik",
    })
}
