import { vi, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'

import { prisma } from './lib/prisma'

vi.mock('./lib/prisma', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}))

vi.mock('next/cache', () => ({
    unstable_cache: (fn: any) => fn,
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn()
}))

vi.mock('./lib/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-id', email: 'test@example.com' } },
                error: null
            })
        }
    })
}))

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>

beforeEach(() => {
    mockReset(prismaMock)
})
