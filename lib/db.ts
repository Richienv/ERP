import { PrismaClient } from '@prisma/client'
// NOTE: createClient is imported dynamically inside withPrismaAuth() only.
// Top-level import would leak "next/headers" into any file that imports prisma.

// Singleton pattern for Prisma Client with optimized settings
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Append connection_limit to DATABASE_URL for Supabase session-mode pooler compatibility.
// Supabase free tier allows ~15 pooler connections. We use 5 per Prisma instance
// to allow concurrent queries (dashboard loads, cache warming) without exhaustion.
function getDatasourceUrl(): string | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined
    const separator = url.includes('?') ? '&' : '?'
    // If already has connection_limit, don't add another
    if (url.includes('connection_limit=')) return url
    return `${url}${separator}connection_limit=10`
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
        // Use getUser() instead of getSession() — getSession() is deprecated in
        // Supabase JS v2.x and can return null in server-side contexts (Vercel
        // serverless) even when the user has a valid session cookie.
        // Since RLS is bypassed (postgres user has full access), we only need
        // to verify the user is authenticated, not pass JWT claims.
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            throw new Error('Not authenticated')
        }

        // Extract maxRetries from txOptions (default: 2 via withRetry defaults)
        const { maxRetries, ...prismaOpts } = txOptions || {}

        return await withRetry(async () => {
            return await basePrisma.$transaction(async (tx) => {
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
