import { NextResponse } from "next/server"

export type ApiFailCode =
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "VALIDATION"
    | "INTERNAL"

export type ApiOk<T> = { ok: true; data: T }
export type ApiFail = { ok: false; error: string; code: ApiFailCode }

export const API_CACHE = {
    REALTIME: "private, max-age=0, s-maxage=15, stale-while-revalidate=15",
    DASHBOARD: "private, max-age=0, s-maxage=30, stale-while-revalidate=30",
    NONE: "no-store",
} as const

export type ApiCacheTier = keyof typeof API_CACHE

export function jsonOk<T>(data: T, init?: { status?: number; cache?: ApiCacheTier }) {
    const headers: Record<string, string> = {
        "Cache-Control": API_CACHE[init?.cache ?? "NONE"],
    }
    return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, {
        status: init?.status ?? 200,
        headers,
    })
}

export function jsonFail(status: number, error: string, code: ApiFailCode) {
    return NextResponse.json({ ok: false, error, code } satisfies ApiFail, {
        status,
        headers: { "Cache-Control": API_CACHE.NONE },
    })
}

export function statusToCode(status: number): ApiFailCode {
    if (status === 401) return "UNAUTHORIZED"
    if (status === 403) return "FORBIDDEN"
    if (status === 404) return "NOT_FOUND"
    if (status === 422 || status === 400) return "VALIDATION"
    return "INTERNAL"
}
