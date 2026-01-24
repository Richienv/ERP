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

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>

beforeEach(() => {
    mockReset(prismaMock)
})
