export class ApiHttpError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
    ) {
        super(message)
        this.name = "ApiHttpError"
    }
}

type ApiFetchOptions = {
    timeoutMs?: number
    retry?: number
    signal?: AbortSignal
}

const DEFAULT_TIMEOUT_MS = 8_000

async function fetchOnce(url: string, timeoutMs: number, external?: AbortSignal): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    external?.addEventListener("abort", onAbort)
    try {
        return await fetch(url, {
            signal: controller.signal,
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
    } finally {
        clearTimeout(timer)
        external?.removeEventListener("abort", onAbort)
    }
}

/**
 * Browser/server fetch for KRI read APIs.
 * Throws on !ok so TanStack keeps stale data instead of caching empty tables.
 * GET 502/503 retry once. Timeout defaults to 8s.
 */
export async function apiFetch<T = any>(url: string, options: ApiFetchOptions = {}): Promise<T> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const retries = options.retry ?? 1
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetchOnce(url, timeoutMs, options.signal)
            const body = await res.json().catch(() => null)

            if (res.status === 401) {
                throw new ApiHttpError("Unauthorized", 401, "UNAUTHORIZED")
            }
            if (!res.ok) {
                const message = (body && (body.error || body.message)) || `HTTP ${res.status}`
                const retryable = res.status === 502 || res.status === 503 || res.status === 504
                if (retryable && attempt < retries) {
                    lastError = new ApiHttpError(String(message), res.status, body?.code)
                    continue
                }
                throw new ApiHttpError(String(message), res.status, body?.code)
            }

            if (body && typeof body === "object" && "ok" in body) {
                if (body.ok === false) {
                    throw new ApiHttpError(String(body.error || "Request failed"), res.status, body.code)
                }
                return body.data as T
            }
            return body as T
        } catch (error) {
            lastError = error
            const retryable =
                error instanceof ApiHttpError
                    ? error.status === 502 || error.status === 503 || error.status === 504
                    : error instanceof Error && error.name === "AbortError"
            if (attempt < retries && retryable) continue
            throw error
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Request failed")
}

type ApiMutateOptions = {
    method?: "POST" | "PATCH" | "PUT" | "DELETE"
    body?: unknown
    timeoutMs?: number
    signal?: AbortSignal
}

/**
 * Write helper: timeout, unwrap { ok, data }, never retry (avoid double-post).
 */
export async function apiMutate<T = any>(url: string, options: ApiMutateOptions = {}): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 15_000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    options.signal?.addEventListener("abort", onAbort)
    try {
        const res = await fetch(url, {
            method: options.method ?? "POST",
            credentials: "same-origin",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        })
        const parsed = await res.json().catch(() => null)
        if (!res.ok) {
            const message = (parsed && (parsed.error || parsed.message)) || `HTTP ${res.status}`
            throw new ApiHttpError(String(message), res.status, parsed?.code)
        }
        if (parsed && typeof parsed === "object" && "ok" in parsed) {
            if (parsed.ok === false) {
                throw new ApiHttpError(String(parsed.error || "Request failed"), res.status, parsed.code)
            }
            return parsed.data as T
        }
        return parsed as T
    } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener("abort", onAbort)
    }
}
