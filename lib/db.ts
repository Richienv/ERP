import { PrismaClient } from '@prisma/client'

// Singleton pattern for Prisma Client with optimized settings
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Create Prisma Client with connection pool settings optimized for serverless/edge
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
