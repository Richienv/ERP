import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Liveness / readiness probe.
 *
 * Deliberately unauthenticated — load balancers, uptime monitors and container
 * orchestrators need to call this without credentials.
 *
 * Because it is public, it MUST NOT expose anything beyond up/down:
 * no error messages, no stack traces, no connection strings, no env values.
 * Failure detail is logged server-side only.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Abort the DB probe rather than letting a hung connection hang the health check. */
const DB_PROBE_TIMEOUT_MS = 5000

const NO_STORE = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const

async function probeDatabase(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`DB probe timed out after ${DB_PROBE_TIMEOUT_MS}ms`)),
                DB_PROBE_TIMEOUT_MS,
            )
        })

        await Promise.race([prisma.$queryRaw`SELECT 1`, timeout])
        return true
    } catch (error) {
        // Server-side only. Never returned to the caller.
        console.error('[health] Database probe failed:', error)
        return false
    } finally {
        if (timer) clearTimeout(timer)
    }
}

export async function GET() {
    const dbUp = await probeDatabase()

    if (!dbUp) {
        return NextResponse.json(
            {
                status: 'degraded',
                db: 'down',
                timestamp: new Date().toISOString(),
            },
            { status: 503, headers: NO_STORE },
        )
    }

    return NextResponse.json(
        {
            status: 'ok',
            db: 'up',
            timestamp: new Date().toISOString(),
        },
        { status: 200, headers: NO_STORE },
    )
}
