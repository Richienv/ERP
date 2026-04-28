import type { DocType } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthzUser } from '@/lib/authz'

const PROCUREMENT_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_MANAGER', 'ROLE_PURCHASING', 'ROLE_RECEIVING'] as const
const FINANCE_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_FINANCE', 'ROLE_ACCOUNTANT'] as const
const HCM_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_HCM_MANAGER'] as const
const MFG_VIEWERS = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ROLE_MANAGER', 'ROLE_MANUFACTURING'] as const

/**
 * Normalize role string by stripping `ROLE_` prefix and uppercasing.
 * Mirrors `lib/authz.ts:normalizeRole` to keep this module self-contained
 * while staying consistent with `assertRole()` behavior.
 */
function normalizeRole(role: string): string {
    return role.toUpperCase().replace(/^ROLE_/, '')
}

/**
 * Returns true if the user's role matches any allowed role after normalization,
 * OR the user is ADMIN (super-grant — mirrors `lib/authz.ts:65-67`).
 *
 * Handles both canonical (`ROLE_MANAGER`) and legacy unprefixed (`manager`)
 * role strings, since both exist in the wild (see `prisma/seed.ts:148`).
 */
function rolePass(userRole: string, allowed: readonly string[]): boolean {
    const u = normalizeRole(userRole)
    if (u === 'ADMIN') return true
    return allowed.some((r) => normalizeRole(r) === u)
}

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
            return rolePass(user.role, PROCUREMENT_VIEWERS)

        case 'INVOICE_AR':
        case 'INVOICE_AP':
        case 'FAKTUR_PAJAK':
            return rolePass(user.role, FINANCE_VIEWERS)

        case 'PAYSLIP': {
            if (rolePass(user.role, HCM_VIEWERS)) return true
            // Payslip model may not exist yet in schema — guard explicitly so we
            // don't TypeError when the optional chain returns undefined.
            const payslipModel = (prisma as any).payslip
            if (!payslipModel) return false
            try {
                const slip = await payslipModel.findUnique({
                    where: { id: entityId },
                    select: { employeeId: true },
                })
                return slip?.employeeId != null && slip.employeeId === user.employeeId
            } catch {
                return false
            }
        }

        case 'BOM':
        case 'SPK':
            return rolePass(user.role, MFG_VIEWERS)

        default:
            return false // deny unknown DocTypes
    }
}
