import { getDashboardActivity } from "@/app/actions/dashboard"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(getDashboardActivity, {
        cache: "DASHBOARD",
        failMessage: "Gagal memuat aktivitas",
    })
}
