import { getMiningCommandPulse } from "@/lib/actions/mining-command"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(getMiningCommandPulse, {
        cache: "REALTIME",
        failMessage: "Gagal memuat kotak masuk operasi",
    })
}
