import type { DocType } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthzUser } from '@/lib/authz'

const PROCUREMENT_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_MANAGER', 'ROLE_PURCHASING', 'ROLE_RECEIVING'] as const
const FINANCE_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_FINANCE', 'ROLE_ACCOUNTANT'] as const
const HCM_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_HCM_MANAGER'] as const
const MFG_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_MANAGER', 'ROLE_MANUFACTURING'] as const

/**
 * Polymorphic entity authorization dispatcher for document downloads.
 *
 * Determines whether `user` may view the underlying business entity referenced
 * by a document of `type` with the given `entityId`.
 *
 * Role allowlists per document family:
 * - Procurement (PO/PR/GRN/VENDOR_PROFILE): purchasing/receiving + admin/exec/manager
 * - Finance (INVOICE_AR/INVOICE_AP/FAKTUR_PAJAK): finance/accountant + admin/exec
 * - Manufacturing (BOM/SPK): manufacturing + admin/exec/manager
 * - HCM (PAYSLIP): HCM viewers OR the employee that owns the payslip
 *
 * Unknown DocTypes deny by default (defense in depth).
 */
export async function canViewEntity(
    user: AuthzUser,
    type: DocType,
    entityId: string,
): Promise<boolean> {
    switch (type) {
        case 'PO':
        case 'PR':
        case 'GRN':
        case 'VENDOR_PROFILE':
            return PROCUREMENT_VIEWERS.includes(user.role as any)

        case 'INVOICE_AR':
        case 'INVOICE_AP':
        case 'FAKTUR_PAJAK':
            return FINANCE_VIEWERS.includes(user.role as any)

        case 'PAYSLIP': {
            if (HCM_VIEWERS.includes(user.role as any)) return true
            // Payslip model may not exist yet in schema — guard with optional chain + catch.
            const slip = await (prisma as any).payslip?.findUnique({
                where: { id: entityId },
                select: { employeeId: true },
            }).catch(() => null)
            return slip?.employeeId != null && slip.employeeId === user.employeeId
        }

        case 'BOM':
        case 'SPK':
            return MFG_VIEWERS.includes(user.role as any)

        default:
            return false // deny unknown DocTypes
    }
}
