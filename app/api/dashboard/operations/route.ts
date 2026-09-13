import { getDashboardOperations } from "@/app/actions/dashboard"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(getDashboardOperations, {
        cache: "DASHBOARD",
        failMessage: "Gagal memuat operasi",
    })
}
