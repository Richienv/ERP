import type { PrismaClient } from "@prisma/client"
import type { AuthzUser } from "@/lib/authz"

export type EmployeeContext = {
    id: string
    employeeCode: string
    email: string | null
    status: string
    department: string
    position: string
    fullName: string
}

const SUPER_ROLES = ["ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR", "ADMIN", "CEO", "DIRECTOR"]
const HR_KEYWORDS = ["hr", "sdm", "human capital", "people"]
const MANAGER_KEYWORDS = ["manager", "head", "supervisor", "lead", "director", "ceo"]

const normalizeText = (value?: string | null) => (value || "").trim().toLowerCase()
const normalizeRole = (value?: string | null) => (value || "").trim().toUpperCase()
const hasKeyword = (value: string, keywords: string[]) =>
    keywords.some((keyword) => normalizeText(value).includes(keyword))

export const isSuperRole = (role: string) => SUPER_ROLES.includes(normalizeRole(role))
export const isHRPosition = (department: string, position: string) =>
    hasKeyword(department, HR_KEYWORDS) || hasKeyword(position, HR_KEYWORDS)
export const isManagerPosition = (position: string) => hasKeyword(position, MANAGER_KEYWORDS)

export const sameDepartment = (left?: string | null, right?: string | null) =>
    normalizeText(left) === normalizeText(right)

export async function resolveEmployeeContext(
    prisma: PrismaClient,
    user: AuthzUser,
    options?: { requireActive?: boolean; autoProvision?: boolean }
): Promise<EmployeeContext | null> {
    const requireActive = options?.requireActive ?? true
    const autoProvision = options?.autoProvision ?? true

    const select = {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        department: true,
        position: true,
    }

    let employee = null as any
    if (user.employeeId) {
        employee = await (prisma as any).employee.findUnique({
            where: { id: user.employeeId },
            select,
        })
    }

    if (!employee && user.email) {
        employee = await (prisma as any).employee.findFirst({
            where: { email: { equals: user.email, mode: 'insensitive' } },
            select,
        })
    }

    // Auto-provision: create Employee record from auth user if not found
    if (!employee && autoProvision && user.email) {
        try {
            const emailPrefix = user.email.split('@')[0] || 'user'
            const nameParts = emailPrefix.replace(/[._-]/g, ' ').split(' ')
            const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'User'
            const lastName = nameParts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || null

            // Generate unique employee code
            const count = await (prisma as any).employee.count()
            const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`

            employee = await (prisma as any).employee.create({
                data: {
                    employeeId: employeeCode,
                    firstName,
                    lastName,
                    email: user.email,
                    department: 'Umum',
                    position: 'Staff',
                    joinDate: new Date(),
                    status: 'ACTIVE',
                    baseSalary: 0,
                },
                select,
            })

            console.log(`[resolveEmployeeContext] Auto-provisioned employee ${employeeCode} for ${user.email}`)
        } catch (e) {
            console.error("[resolveEmployeeContext] Auto-provision failed:", e)
            return null
        }
    }

    if (!employee) return null
    if (requireActive && employee.status !== "ACTIVE") return null

    return {
        id: employee.id,
        employeeCode: employee.employeeId,
        email: employee.email,
        status: employee.status,
        department: employee.department || "-",
        position: employee.position || "-",
        fullName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
    }
}

/** Check if a role string indicates manager-level access */
const isManagerRole = (role: string) => {
    const r = normalizeRole(role).replace(/^ROLE_/, '')
    return ['MANAGER', 'PURCHASING'].includes(r) || hasKeyword(role, MANAGER_KEYWORDS)
}

/** Purchasing roles can approve PRs from any department */
const isPurchasingRole = (role: string) => {
    const r = normalizeRole(role).replace(/^ROLE_/, '')
    return r === 'PURCHASING'
}

export function canApproveForDepartment(params: {
    role: string
    actorDepartment?: string | null
    actorPosition?: string | null
    targetDepartment?: string | null
}) {
    if (isSuperRole(params.role)) return true
    // Purchasing roles can approve PRs cross-department
    if (isPurchasingRole(params.role)) return true
    const actorDepartment = params.actorDepartment || ""
    const actorPosition = params.actorPosition || ""
    if (isHRPosition(actorDepartment, actorPosition)) return true
    // Check both employee position AND user role for manager-level access
    if (!isManagerPosition(actorPosition) && !isManagerRole(params.role)) return false
    return sameDepartment(actorDepartment, params.targetDepartment || "")
}

