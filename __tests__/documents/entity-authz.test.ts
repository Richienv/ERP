import { describe, it, expect, vi } from 'vitest'
import { canViewEntity } from '@/lib/documents/entity-authz'

vi.mock('@/lib/db', () => ({
    prisma: {
        payslip: {
            findUnique: vi.fn(),
        },
    },
}))

const mkUser = (role: string, employeeId: string | null = null) => ({
    id: 'u1', role, email: 't@t.com', employeeId,
})

describe('canViewEntity', () => {
    describe('procurement docs (PO/PR/GRN/VENDOR_PROFILE)', () => {
        const types = ['PO', 'PR', 'GRN', 'VENDOR_PROFILE'] as const
        it.each(types)('ROLE_PURCHASING can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_PURCHASING'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_ADMIN can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_ADMIN'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_FINANCE cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), t, 'e1')).toBe(false)
        })
        it.each(types)('ROLE_STAFF cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_STAFF'), t, 'e1')).toBe(false)
        })
    })

    describe('finance docs (INVOICE_AR/INVOICE_AP/FAKTUR_PAJAK)', () => {
        const types = ['INVOICE_AR', 'INVOICE_AP', 'FAKTUR_PAJAK'] as const
        it.each(types)('ROLE_FINANCE can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_PURCHASING cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_PURCHASING'), t, 'e1')).toBe(false)
        })
    })

    describe('manufacturing docs (BOM/SPK)', () => {
        it('ROLE_MANUFACTURING can view BOM', async () => {
            expect(await canViewEntity(mkUser('ROLE_MANUFACTURING'), 'BOM', 'e1')).toBe(true)
        })
        it('ROLE_FINANCE cannot view SPK', async () => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), 'SPK', 'e1')).toBe(false)
        })
    })

    describe('PAYSLIP (owner OR HCM)', () => {
        it('ROLE_HCM_MANAGER can view any payslip', async () => {
            expect(await canViewEntity(mkUser('ROLE_HCM_MANAGER'), 'PAYSLIP', 'e1')).toBe(true)
        })
        it('owner can view their own payslip', async () => {
            const { prisma } = await import('@/lib/db')
            ;(prisma.payslip!.findUnique as any).mockResolvedValue({ employeeId: 'emp-99' })
            expect(await canViewEntity(mkUser('ROLE_STAFF', 'emp-99'), 'PAYSLIP', 'pay-1')).toBe(true)
        })
        it('non-owner cannot view another employee payslip', async () => {
            const { prisma } = await import('@/lib/db')
            ;(prisma.payslip!.findUnique as any).mockResolvedValue({ employeeId: 'emp-other' })
            expect(await canViewEntity(mkUser('ROLE_STAFF', 'emp-99'), 'PAYSLIP', 'pay-1')).toBe(false)
        })
    })

    it('unknown DocType denies by default', async () => {
        expect(await canViewEntity(mkUser('ROLE_ADMIN'), 'UNKNOWN_TYPE' as any, 'e1')).toBe(false)
    })
})
