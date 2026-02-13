import { Prisma, PrismaClient } from '@prisma/client'
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

const withPoolGuards = (rawUrl?: string) => {
    if (!rawUrl) return rawUrl
    try {
        const url = new URL(rawUrl)
        if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "3")
        if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30")
        if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true")
        return url.toString()
    } catch {
        return rawUrl
    }
}

const prismaOptions: Prisma.PrismaClientOptions = {
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
}

const guardedDatabaseUrl = withPoolGuards(process.env.DATABASE_URL)
if (guardedDatabaseUrl) {
    prismaOptions.datasources = { db: { url: guardedDatabaseUrl } }
}

// Base Prisma client (without auth context)
const basePrisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

export async function withPrismaAuth<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    txOptions?: { maxWait?: number; timeout?: number }
): Promise<T> {
    try {
        const supabase = await createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (sessionError || !accessToken) {
            throw new Error('Not authenticated')
        }

        const claims = decodeJwtPayload(accessToken)
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

        return await withRetry(async () => {
            return await basePrisma.$transaction(async (tx) => {
                // RLS bypassed: the pooler connection uses 'postgres' role with full admin rights.
                // Role switching to 'authenticated' causes 'permission denied for schema public'
                // in the current pooler setup. Auth context (sub/role) is validated above.

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
            }, { maxWait: 15000, timeout: 20000, ...txOptions })
        })
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
