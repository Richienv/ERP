import { getGLAccountsList, getJournalEntries } from "@/lib/actions/finance-gl"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(async () => {
        const [entries, accounts] = await Promise.all([
            getJournalEntries(50),
            getGLAccountsList(),
        ])
        return { entries, accounts }
    }, { cache: "REALTIME", failMessage: "Gagal memuat jurnal" })
}
