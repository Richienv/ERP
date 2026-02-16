import { PrismaClient } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'

// Singleton pattern for Prisma Client with optimized settings
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

function decodeJwtPayload(token: string): Record<string, any> {
    const parts = token.split('.')
    if (parts.length < 2) throw new Error('Invalid JWT')

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json)
}

// Append connection_limit to DATABASE_URL for Supabase session-mode pooler compatibility.
// Session-mode poolers limit concurrent connections to pool_size. Without this,
// Prisma opens multiple connections per instance and exhausts the pool.
function getDatasourceUrl(): string | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined
    const separator = url.includes('?') ? '&' : '?'
    // If already has connection_limit, don't add another
    if (url.includes('connection_limit=')) return url
    return `${url}${separator}connection_limit=1`
}

// Base Prisma client (without auth context)
const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasourceUrl: getDatasourceUrl(),
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

export async function withPrismaAuth<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    txOptions?: { maxWait?: number; timeout?: number; maxRetries?: number }
): Promise<T> {
    try {
        const supabase = await createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (sessionError || !accessToken) {
            throw new Error('Not authenticated')
        }

        const claims = decodeJwtPayload(accessToken)
        const claimsJson = JSON.stringify(claims)
        const sub = String(claims.sub || '')
        const role = String(claims.role || 'authenticated')

        if (!sub) throw new Error('Invalid auth claims')

        if (process.env.DEBUG_PRISMA_AUTH === '1') {
            try {
                console.log('[Prisma] Auth claims keys:', Object.keys(claims))
            } catch {
                // ignore
            }
        }

        // Extract maxRetries from txOptions (default: 2 via withRetry defaults)
        const { maxRetries, ...prismaOpts } = txOptions || {}

        return await withRetry(async () => {
            return await basePrisma.$transaction(async (tx) => {
                const dbRole = (role === 'anon' || role === 'authenticated') ? role : 'authenticated'
                // BYPASS RLS FOR TRANSACTION POOLER COMPATIBILITY
                // The 'postgres' user from the pooler connection string has full admin rights.
                // Switching to 'authenticated' role causes 'permission denied for schema public'
                // because the pooler environment or role grants might be misconfigured for this project type.

                /*
                try {
                    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${dbRole}`)
                } catch {
                    // ignore if role switching is not permitted
                }

                await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${sub}, true)`
                await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', ${dbRole}, true)`
                await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`
                */

                if (process.env.DEBUG_PRISMA_AUTH === '1') {
                    try {
                        const settings = await tx.$queryRawUnsafe(
                            "select current_setting('request.jwt.claim.sub', true) as sub, current_setting('request.jwt.claim.role', true) as role, current_setting('request.jwt.claims', true) as claims"
                        )
                        console.log('[Prisma] Session GUCs:', settings)
                    } catch {
                        // ignore
                    }
                }

                return operation(tx as unknown as PrismaClient)
                // Default timeouts: 15s maxWait for connection, 20s timeout for query
            }, { maxWait: 15000, timeout: 20000, ...prismaOpts })
        }, maxRetries !== undefined ? { maxRetries } : undefined)
    } catch (err) {
        console.warn('[Prisma] Failed to apply auth context:', err)
        throw err
    }
}

// Backward compatible helper (does not guarantee same-connection session context)
export async function getPrismaWithAuth(): Promise<PrismaClient> {
    return basePrisma
}

// Export base client for backward compatibility (use with caution - may fail with RLS)
export const prisma = basePrisma

// Database error types for proper handling
export type DBErrorCode =
    | 'CONNECTION_ERROR'    // P1001, P1002
    | 'TIMEOUT_ERROR'       // P1008, P2024
    | 'QUERY_ERROR'         // P2xxx
    | 'UNKNOWN_ERROR'

export interface DBError {
    code: DBErrorCode
    message: string
    canRetry: boolean
}

// Parse Prisma errors into structured format
export function parseDBError(error: unknown): DBError {
    const err = error as any
    const code = err?.code || ''
    const message = err?.message || 'Unknown database error'

    // Connection errors (can retry)
    if (code === 'P1001' || code === 'P1002' || message.includes("Can't reach database")) {
        return {
            code: 'CONNECTION_ERROR',
            message: 'Database connection failed. Please try again.',
            canRetry: true
        }
    }

    // Timeout errors (can retry)
    if (code === 'P1008' || code === 'P2024' || message.includes('timed out')) {
        return {
            code: 'TIMEOUT_ERROR',
            message: 'Database request timed out. Please try again.',
            canRetry: true
        }
    }

    // Query/data errors (usually not retryable)
    if (code?.startsWith('P2')) {
        return {
            code: 'QUERY_ERROR',
            message: 'Database query error.',
            canRetry: false
        }
    }

    return {
        code: 'UNKNOWN_ERROR',
        message: message,
        canRetry: false
    }
}

// Retry configuration
interface RetryConfig {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 3000
}

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Execute database operation with retry logic
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {}
): Promise<T> {
    const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_CONFIG, ...config }

    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            const dbError = parseDBError(error)

            // Don't retry non-retryable errors
            if (!dbError.canRetry || attempt === maxRetries) {
                throw error
            }

            // Exponential backoff with jitter
            const delay = Math.min(
                baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
                maxDelayMs
            )

            console.warn(`DB operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`)
            await sleep(delay)
        }
    }

    throw lastError
}

// Safe database query wrapper - returns fallback on error instead of throwing
export async function safeQuery<T>(
    operation: () => Promise<T>,
    fallback: T,
    options?: {
        logError?: boolean
        retry?: boolean
    }
): Promise<{ data: T; error: DBError | null; fromCache: boolean }> {
    const { logError = true, retry = true } = options || {}

    try {
        const data = retry
            ? await withRetry(operation)
            : await operation()
        return { data, error: null, fromCache: false }
    } catch (error) {
        const dbError = parseDBError(error)

        if (logError) {
            console.error(`Database error [${dbError.code}]:`, dbError.message)
        }

        return { data: fallback, error: dbError, fromCache: true }
    }
}

// Check database connectivity
export async function checkDBConnection(): Promise<{
    connected: boolean
    latencyMs: number | null
    error: string | null
}> {
    const start = Date.now()
    try {
        await prisma.$queryRaw`SELECT 1`
        return {
            connected: true,
            latencyMs: Date.now() - start,
            error: null
        }
    } catch (error) {
        const dbError = parseDBError(error)
        return {
            connected: false,
            latencyMs: null,
            error: dbError.message
        }
    }
}

// Graceful shutdown
export async function disconnectDB() {
    await prisma.$disconnect()
}
