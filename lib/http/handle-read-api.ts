import { jsonFail, jsonOk, type ApiCacheTier } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"

/**
 * Shared GET kernel: session gate, { ok, data } envelope, no zero-fallback lie.
 */
export async function handleReadApi<T>(
    load: () => Promise<T>,
    options: { cache?: ApiCacheTier; failMessage: string },
) {
    const user = await requireApiUser()
    if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

    try {
        return jsonOk(await load(), { cache: options.cache ?? "NONE" })
    } catch (error) {
        console.error("[API]", options.failMessage, error)
        return jsonFail(500, options.failMessage, "INTERNAL")
    }
}
