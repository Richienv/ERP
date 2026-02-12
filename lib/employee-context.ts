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
    options?: { requireActive?: boolean }
): Promise<EmployeeContext | null> {
    const requireActive = options?.requireActive ?? true

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
        employee = await (prisma as any).employee.findUnique({
            where: { email: user.email },
            select,
        })
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

export function canApproveForDepartment(params: {
    role: string
    actorDepartment?: string | null
    actorPosition?: string | null
    targetDepartment?: string | null
}) {
    if (isSuperRole(params.role)) return true
    const actorDepartment = params.actorDepartment || ""
    const actorPosition = params.actorPosition || ""
    if (isHRPosition(actorDepartment, actorPosition)) return true
    if (!isManagerPosition(actorPosition)) return false
    return sameDepartment(actorDepartment, params.targetDepartment || "")
}

