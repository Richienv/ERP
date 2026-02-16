'use server'

import {
    AttendanceStatus,
    EmployeeStatus,
    LeaveStatus,
    LeaveType,
    PaymentMethod,
    Priority,
    TaskStatus,
    TaskType,
} from '@prisma/client'
import { revalidatePath, revalidateTag } from 'next/cache'
import { withPrismaAuth } from '@/lib/db'
import { assertRole, getAuthzUser } from '@/lib/authz'
import { postJournalEntry } from '@/lib/actions/finance'

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')
const LEAVE_APPROVAL_PREFIX = 'LEAVE_APPROVAL::'
const PAYROLL_RUN_PREFIX = 'PAYROLL_RUN::'

const SDM_APPROVER_ROLES = [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIRECTOR',
    'ROLE_MANAGER',
    'ROLE_HR',
    'admin',
    'CEO',
    'DIRECTOR',
    'manager',
]

const SDM_SUPER_ROLES = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR', 'ADMIN', 'CEO', 'DIRECTOR']
const SDM_HR_KEYWORDS = ['hr', 'sdm', 'human capital', 'people']
const SDM_MANAGER_KEYWORDS = ['manager', 'head', 'supervisor', 'lead', 'director', 'ceo']
const SDM_BROAD_APPROVAL_DEPARTMENTS = ['management', 'finance', 'hr', 'sdm']

interface PayrollLineData {
    employeeId: string
    employeeCode: string
    employeeName: string
    department: string
    position: string
    attendanceDays: number
    leaveDays: number
    lateCount: number
    overtimeHours: number
    basicSalary: number
    transportAllowance: number
    mealAllowance: number
    positionAllowance: number
    overtimePay: number
    bpjsKesehatan: number
    bpjsKetenagakerjaan: number
    pph21: number
    grossSalary: number
    totalDeductions: number
    netSalary: number
}

interface PayrollSummaryData {
    gross: number
    deductions: number
    net: number
    employees: number
    overtimeHours: number
}

interface PayrollRunPayload {
    period: string
    periodLabel: string
    generatedAt: string
    generatedBy: string
    formulaVersion?: string
    status: 'PENDING_APPROVAL' | 'POSTED'
    summary: PayrollSummaryData
    lines: PayrollLineData[]
    compliance?: {
        bpjsTotal: number
        taxTotal: number
    }
    postedAt?: string
    postedBy?: string
    postedJournalReference?: string
    disbursementStatus?: 'PENDING' | 'PAID'
    disbursedAt?: string
    disbursedBy?: string
    disbursementReference?: string
    disbursementMethod?: PaymentMethod
}

export interface PayrollExportRow {
    employeeId: string
    employeeCode: string
    employeeName: string
    department: string
    position: string
    attendanceDays: number
    leaveDays: number
    lateCount: number
    overtimeHours: number
    basicSalary: number
    transportAllowance: number
    mealAllowance: number
    positionAllowance: number
    overtimePay: number
    bpjsKesehatan: number
    bpjsKetenagakerjaan: number
    pph21: number
    grossSalary: number
    totalDeductions: number
    netSalary: number
}

export interface PayrollRunExportData {
    period: string
    periodLabel: string
    status: 'PENDING_APPROVAL' | 'POSTED'
    generatedAt: string
    postedAt?: string | null
    postedBy?: string | null
    postedJournalReference?: string | null
    disbursementStatus?: 'PENDING' | 'PAID'
    disbursedAt?: string | null
    disbursementReference?: string | null
    disbursementMethod?: PaymentMethod | null
    summary: PayrollSummaryData
    rows: PayrollExportRow[]
}

export interface PayslipData {
    period: string
    periodLabel: string
    generatedAt: string
    employee: {
        id: string
        code: string
        name: string
        department: string
        position: string
        email?: string | null
    }
    payroll: PayrollLineData
    summary: PayrollSummaryData
    postedAt?: string | null
    postedJournalReference?: string | null
}

interface SDMActorProfile {
    id: string
    department: string
    position: string
    status: EmployeeStatus
}

const toDayWindow = (raw?: string | Date) => {
    const base = raw ? new Date(raw) : new Date()
    const start = new Date(base)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
}

const toStartOfDay = (raw: string | Date) => {
    const date = new Date(raw)
    date.setHours(0, 0, 0, 0)
    return date
}

const formatTime = (value?: Date | null) => {
    if (!value) return '-'
    return new Date(value).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

const calculateWorkingHours = (checkIn?: Date | null, checkOut?: Date | null) => {
    if (!checkIn || !checkOut) return 0
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime()
    if (diffMs <= 0) return 0
    const rawHours = diffMs / (1000 * 60 * 60)
    const standardBreak = rawHours >= 6 ? 1 : 0
    return Math.max(0, Number((rawHours - standardBreak).toFixed(2)))
}

const calculateOvertimeHours = (workingHours: number) => {
    return Number(Math.max(0, workingHours - 8).toFixed(2))
}

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase()

const hasKeyword = (value: string, keywords: string[]) => {
    const normalized = normalizeText(value)
    return keywords.some((keyword) => normalized.includes(keyword))
}

const normalizeRole = (role: string) => role.trim().toUpperCase()
const isSDMSuperRole = (role: string) => SDM_SUPER_ROLES.includes(normalizeRole(role))

const isHRActor = (actor: SDMActorProfile) =>
    hasKeyword(actor.department, SDM_HR_KEYWORDS) || hasKeyword(actor.position, SDM_HR_KEYWORDS)

const isManagerActor = (actor: SDMActorProfile) => hasKeyword(actor.position, SDM_MANAGER_KEYWORDS)

const isBroadApprovalDepartment = (department: string) => hasKeyword(department, SDM_BROAD_APPROVAL_DEPARTMENTS)

const toEmployeeName = (firstName: string, lastName?: string | null) => {
    return `${firstName} ${lastName || ''}`.trim()
}

const normalizeLeaveType = (raw: string): LeaveType => {
    const value = raw.toUpperCase()
    if (value in LeaveType) return LeaveType[value as keyof typeof LeaveType]
    return LeaveType.OTHER
}

async function resolveCurrentEmployeeId(prisma: any, email?: string | null) {
    if (!email) return null

    const employee = await prisma.employee.findUnique({
        where: { email },
        select: { id: true, status: true },
    })

    if (!employee || employee.status !== 'ACTIVE') return null
    return employee.id
}

async function resolveActorProfile(prisma: any, user: { email?: string | null }) {
    if (!user.email) return null

    return (await prisma.employee.findUnique({
        where: { email: user.email },
        select: {
            id: true,
            department: true,
            position: true,
            status: true,
        },
    })) as SDMActorProfile | null
}

async function assertLeaveApprovalAuthority(
    prisma: any,
    user: { role: string; email?: string | null },
    options: { leaveId: string; targetDepartment: string }
) {
    if (isSDMSuperRole(user.role)) return

    const actor = await resolveActorProfile(prisma, user)
    if (!actor || actor.status !== 'ACTIVE') {
        throw new Error('Profil approver belum terhubung atau tidak aktif.')
    }

    if (isHRActor(actor)) {
        return
    }

    if (!isManagerActor(actor)) {
        throw new Error('Hanya manager/HR yang dapat memproses approval cuti.')
    }

    const sameDepartment = normalizeText(actor.department) === normalizeText(options.targetDepartment)
    if (!sameDepartment) {
        throw new Error('Manager hanya dapat menyetujui cuti di departemen yang sama.')
    }

    const pendingTask = await prisma.employeeTask.findFirst({
        where: {
            relatedId: options.leaveId,
            status: TaskStatus.PENDING,
            notes: { startsWith: LEAVE_APPROVAL_PREFIX },
        },
        select: { employeeId: true },
    })

    if (pendingTask?.employeeId && pendingTask.employeeId !== actor.id) {
        throw new Error('Approval ini sedang ditugaskan ke approver lain.')
    }
}

async function assertPayrollAuthority(
    prisma: any,
    user: { role: string; email?: string | null },
    options?: { assignedApproverId?: string | null }
) {
    if (isSDMSuperRole(user.role)) {
        return { actor: null as SDMActorProfile | null, isSuper: true, isHR: false }
    }

    const actor = await resolveActorProfile(prisma, user)
    if (!actor || actor.status !== 'ACTIVE') {
        throw new Error('Profil approver payroll belum terhubung atau tidak aktif.')
    }

    const hrActor = isHRActor(actor)
    const managerActor = isManagerActor(actor)
    const broadDepartment = isBroadApprovalDepartment(actor.department)

    if (!hrActor && !(managerActor && broadDepartment)) {
        throw new Error('Akses payroll hanya untuk tim HR/SDM atau manager departemen terkait.')
    }

    if (options?.assignedApproverId && options.assignedApproverId !== actor.id && !hrActor) {
        throw new Error('Hanya approver payroll yang ditugaskan yang dapat melakukan aksi ini.')
    }

    return { actor, isSuper: false, isHR: hrActor }
}

async function resolveLeaveApproverId(prisma: any, department: string) {
    const departmentManager = await prisma.employee.findFirst({
        where: {
            status: 'ACTIVE',
            department,
            OR: [
                { position: { contains: 'manager', mode: 'insensitive' } },
                { position: { contains: 'head', mode: 'insensitive' } },
                { position: { contains: 'supervisor', mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    })

    if (departmentManager?.id) return departmentManager.id

    const fallbackApprover = await prisma.employee.findFirst({
        where: {
            status: 'ACTIVE',
            OR: [
                { position: { contains: 'manager', mode: 'insensitive' } },
                { position: { contains: 'head', mode: 'insensitive' } },
                { position: { contains: 'director', mode: 'insensitive' } },
                { position: { contains: 'ceo', mode: 'insensitive' } },
                { department: { contains: 'management', mode: 'insensitive' } },
                { department: { contains: 'hr', mode: 'insensitive' } },
                { department: { contains: 'sdm', mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    })

    return fallbackApprover?.id || null
}

const parsePayrollPayload = (notes?: string | null): PayrollRunPayload | null => {
    if (!notes || !notes.startsWith(PAYROLL_RUN_PREFIX)) return null
    const raw = notes.slice(PAYROLL_RUN_PREFIX.length)
    try {
        return JSON.parse(raw) as PayrollRunPayload
    } catch {
        return null
    }
}

const isValidPeriod = (period: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period)

const createPayrollPeriodWindow = (period: string) => {
    const [yearRaw, monthRaw] = period.split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    return { start, end }
}

const calculateMonthlyOvertime = (rows: Array<{ checkIn: Date | null; checkOut: Date | null }>) => {
    return Number(
        rows
            .reduce((sum, row) => sum + calculateOvertimeHours(calculateWorkingHours(row.checkIn, row.checkOut)), 0)
            .toFixed(2)
    )
}

async function resolvePayrollApproverId(prisma: any) {
    const approver = await prisma.employee.findFirst({
        where: {
            status: 'ACTIVE',
            OR: [
                { position: { contains: 'hr', mode: 'insensitive' } },
                { position: { contains: 'manager', mode: 'insensitive' } },
                { position: { contains: 'director', mode: 'insensitive' } },
                { position: { contains: 'ceo', mode: 'insensitive' } },
                { department: { contains: 'sdm', mode: 'insensitive' } },
                { department: { contains: 'hr', mode: 'insensitive' } },
            ],
        },
        orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
        select: { id: true },
    })

    if (approver?.id) return approver.id

    const fallback = await prisma.employee.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { firstName: 'asc' },
        select: { id: true },
    })

    return fallback?.id || null
}

async function resolvePayrollAccounts(prisma: any) {
    const accounts = await prisma.gLAccount.findMany({
        select: { code: true, type: true, name: true },
    })

    const findByKeyword = (type: string, keywords: string[]) =>
        accounts.find(
            (account: any) =>
                account.type === type &&
                keywords.some((keyword) =>
                    `${account.code} ${account.name}`.toLowerCase().includes(keyword.toLowerCase())
                )
        )

    const expenseAccount =
        findByKeyword('EXPENSE', ['gaji', 'salary', 'payroll', 'upah']) ||
        accounts.find((account: any) => account.type === 'EXPENSE')
    const cashAccount =
        findByKeyword('ASSET', ['kas', 'bank', 'cash']) ||
        accounts.find((account: any) => account.type === 'ASSET')
    const taxAccount =
        findByKeyword('LIABILITY', ['pph', 'tax', 'pajak']) ||
        accounts.find((account: any) => account.type === 'LIABILITY')
    const bpjsAccount =
        findByKeyword('LIABILITY', ['bpjs', 'jaminan', 'benefit']) ||
        accounts.find(
            (account: any) =>
                account.type === 'LIABILITY' && (!taxAccount || account.code !== taxAccount.code)
        ) ||
        taxAccount
    const payrollPayableAccount =
        findByKeyword('LIABILITY', ['payroll payable', 'utang gaji', 'gaji payable', 'payable gaji']) ||
        accounts.find(
            (account: any) =>
                account.type === 'LIABILITY' &&
                account.code !== taxAccount?.code &&
                account.code !== bpjsAccount?.code
        ) ||
        taxAccount

    if (!expenseAccount || !cashAccount || !taxAccount || !bpjsAccount || !payrollPayableAccount) {
        return {
            success: false as const,
            error:
                'Konfigurasi COA payroll belum lengkap. Pastikan akun Expense, Asset (Kas/Bank), dan Liability tersedia.',
        }
    }

    return {
        success: true as const,
        data: {
            expenseCode: expenseAccount.code,
            cashCode: cashAccount.code,
            taxCode: taxAccount.code,
            bpjsCode: bpjsAccount.code,
            payrollPayableCode: payrollPayableAccount.code,
        },
    }
}

async function buildPayrollDraft(prisma: any, period: string, generatedBy: string) {
    const { start, end } = createPayrollPeriodWindow(period)
    const periodLabel = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const employees = await prisma.employee.findMany({
        where: {
            status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
        orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
        select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
            baseSalary: true,
        },
    })

    const attendanceRows = await prisma.attendance.findMany({
        where: {
            date: { gte: start, lt: end },
            employeeId: { in: employees.map((employee: any) => employee.id) },
        },
        select: {
            employeeId: true,
            status: true,
            isLate: true,
            checkIn: true,
            checkOut: true,
        },
    })

    const rowsByEmployeeId = new Map<string, any[]>()
    for (const row of attendanceRows) {
        const list = rowsByEmployeeId.get(row.employeeId) || []
        list.push(row)
        rowsByEmployeeId.set(row.employeeId, list)
    }

    const lines: PayrollLineData[] = employees.map((employee: any) => {
        const rows = rowsByEmployeeId.get(employee.id) || []
        const attendanceDays = rows.filter((row) => row.status === 'PRESENT' || row.status === 'REMOTE').length
        const leaveDays = rows.filter((row) => row.status === 'LEAVE').length
        const lateCount = rows.filter((row) => row.isLate).length
        const overtimeHours = calculateMonthlyOvertime(rows)

        const baseSalary = Number(employee.baseSalary || 0)
        const transportAllowance = Math.round(baseSalary * 0.07)
        const mealAllowance = Math.round(baseSalary * 0.03)
        const positionAllowance = Math.round(baseSalary * 0.1)
        const overtimePay = Math.round(overtimeHours * (baseSalary / 173) * 1.5)

        const grossSalary = baseSalary + transportAllowance + mealAllowance + positionAllowance + overtimePay

        const bpjsKesehatan = Math.min(Math.round(baseSalary * 0.01), 150_000)
        const bpjsKetenagakerjaan = Math.min(Math.round(baseSalary * 0.02), 360_000)
        const taxableIncome = Math.max(0, grossSalary - (bpjsKesehatan + bpjsKetenagakerjaan))
        const pph21 = Math.round(taxableIncome * 0.05)
        const totalDeductions = bpjsKesehatan + bpjsKetenagakerjaan + pph21
        const netSalary = Math.max(0, grossSalary - totalDeductions)

        return {
            employeeId: employee.id,
            employeeCode: employee.employeeId,
            employeeName: toEmployeeName(employee.firstName, employee.lastName),
            department: employee.department,
            position: employee.position,
            attendanceDays,
            leaveDays,
            lateCount,
            overtimeHours,
            basicSalary: baseSalary,
            transportAllowance,
            mealAllowance,
            positionAllowance,
            overtimePay,
            bpjsKesehatan,
            bpjsKetenagakerjaan,
            pph21,
            grossSalary,
            totalDeductions,
            netSalary,
        }
    })

    const summary: PayrollSummaryData = lines.reduce(
        (acc, line) => {
            acc.gross += line.grossSalary
            acc.deductions += line.totalDeductions
            acc.net += line.netSalary
            acc.overtimeHours += line.overtimeHours
            return acc
        },
        { gross: 0, deductions: 0, net: 0, employees: lines.length, overtimeHours: 0 }
    )

    summary.gross = Math.round(summary.gross)
    summary.deductions = Math.round(summary.deductions)
    summary.net = Math.round(summary.net)
    summary.overtimeHours = Number(summary.overtimeHours.toFixed(2))

    const payload: PayrollRunPayload = {
        period,
        periodLabel,
        generatedAt: new Date().toISOString(),
        generatedBy,
        formulaVersion: '2026.02',
        status: 'PENDING_APPROVAL',
        summary,
        lines,
        compliance: {
            bpjsTotal: lines.reduce((sum, line) => sum + line.bpjsKesehatan + line.bpjsKetenagakerjaan, 0),
            taxTotal: lines.reduce((sum, line) => sum + line.pph21, 0),
        },
        disbursementStatus: 'PENDING',
    }

    return payload
}

export async function getEmployees(options?: { includeInactive?: boolean }) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const employees = await prisma.employee.findMany({
                where: options?.includeInactive
                    ? undefined
                    : { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
                include: {
                    _count: {
                        select: {
                            attendance: true,
                            leaveRequests: true,
                            tasks: true,
                        },
                    },
                },
            })

            return employees.map((employee) => ({
                id: employee.id,
                employeeCode: employee.employeeId,
                name: toEmployeeName(employee.firstName, employee.lastName),
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                phone: employee.phone,
                department: employee.department,
                position: employee.position,
                status: employee.status,
                joinDate: employee.joinDate.toISOString().slice(0, 10),
                baseSalary: Number(employee.baseSalary || 0),
                metrics: {
                    attendanceEntries: employee._count.attendance,
                    leaveRequests: employee._count.leaveRequests,
                    openTasks: employee._count.tasks,
                },
            }))
        })
    } catch (error) {
        console.error('Failed to fetch employees:', error)
        return []
    }
}

export async function createEmployee(data: {
    employeeCode?: string
    firstName: string
    lastName?: string
    email?: string
    phone?: string
    department: string
    position: string
    joinDate: string
    status?: EmployeeStatus
    baseSalary?: number
}) {
    try {
        const firstName = data.firstName?.trim()
        const department = data.department?.trim()
        const position = data.position?.trim()

        if (!firstName || !department || !position || !data.joinDate) {
            return { success: false, error: 'Nama depan, departemen, posisi, dan tanggal masuk wajib diisi' }
        }

        return await withPrismaAuth(async (prisma) => {
            const generatedCode = data.employeeCode?.trim()
                ? data.employeeCode.trim().toUpperCase()
                : `EMP-${new Date().getFullYear()}${Math.floor(Math.random() * 100000)
                    .toString()
                    .padStart(5, '0')}`

            const existingCode = await prisma.employee.findUnique({ where: { employeeId: generatedCode } })
            if (existingCode) {
                return { success: false, error: `Kode karyawan ${generatedCode} sudah digunakan` }
            }

            if (data.email?.trim()) {
                const existingEmail = await prisma.employee.findUnique({ where: { email: data.email.trim() } })
                if (existingEmail) {
                    return { success: false, error: 'Email karyawan sudah digunakan' }
                }
            }

            const employee = await prisma.employee.create({
                data: {
                    employeeId: generatedCode,
                    firstName,
                    lastName: data.lastName?.trim() || null,
                    email: data.email?.trim() || null,
                    phone: data.phone?.trim() || null,
                    department,
                    position,
                    joinDate: toStartOfDay(data.joinDate),
                    status: data.status || 'ACTIVE',
                    baseSalary: Number.isFinite(data.baseSalary) ? Number(data.baseSalary) : 0,
                },
            })

            revalidateTagSafe('employee')
            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/employee-master')
            revalidatePath('/dashboard')

            return {
                success: true,
                employee: {
                    id: employee.id,
                    name: toEmployeeName(employee.firstName, employee.lastName),
                    code: employee.employeeId,
                },
            }
        })
    } catch (error: any) {
        console.error('Failed to create employee:', error)
        return { success: false, error: error?.message || 'Gagal membuat karyawan' }
    }
}

export async function updateEmployee(
    employeeId: string,
    data: {
        firstName: string
        lastName?: string
        email?: string
        phone?: string
        department: string
        position: string
        joinDate: string
        status: EmployeeStatus
        baseSalary?: number
    }
) {
    try {
        if (!employeeId) return { success: false, error: 'Employee ID tidak valid' }

        const firstName = data.firstName?.trim()
        const department = data.department?.trim()
        const position = data.position?.trim()

        if (!firstName || !department || !position || !data.joinDate) {
            return { success: false, error: 'Nama depan, departemen, posisi, dan tanggal masuk wajib diisi' }
        }

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
            if (!existing) return { success: false, error: 'Karyawan tidak ditemukan' }

            if (data.email?.trim()) {
                const collision = await prisma.employee.findFirst({
                    where: {
                        email: data.email.trim(),
                        id: { not: employeeId },
                    },
                    select: { id: true },
                })
                if (collision) return { success: false, error: 'Email sudah digunakan oleh karyawan lain' }
            }

            await prisma.employee.update({
                where: { id: employeeId },
                data: {
                    firstName,
                    lastName: data.lastName?.trim() || null,
                    email: data.email?.trim() || null,
                    phone: data.phone?.trim() || null,
                    department,
                    position,
                    joinDate: toStartOfDay(data.joinDate),
                    status: data.status,
                    baseSalary: Number.isFinite(data.baseSalary) ? Number(data.baseSalary) : 0,
                },
            })

            revalidateTagSafe('employee')
            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/employee-master')
            revalidatePath('/dashboard')

            return { success: true }
        })
    } catch (error: any) {
        console.error('Failed to update employee:', error)
        return { success: false, error: error?.message || 'Gagal mengubah karyawan' }
    }
}

export async function deactivateEmployee(employeeId: string) {
    try {
        if (!employeeId) return { success: false, error: 'Employee ID tidak valid' }

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
            if (!existing) return { success: false, error: 'Karyawan tidak ditemukan' }

            await prisma.employee.update({
                where: { id: employeeId },
                data: { status: 'INACTIVE' },
            })

            revalidateTagSafe('employee')
            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/employee-master')
            revalidatePath('/dashboard')

            return { success: true }
        })
    } catch (error: any) {
        console.error('Failed to deactivate employee:', error)
        return { success: false, error: error?.message || 'Gagal menonaktifkan karyawan' }
    }
}

export async function bulkDeactivateEmployees(employeeIds: string[]) {
    try {
        if (!employeeIds.length) return { success: false, error: 'Tidak ada karyawan yang dipilih' }

        return await withPrismaAuth(async (prisma) => {
            const result = await prisma.employee.updateMany({
                where: { id: { in: employeeIds }, status: { not: 'INACTIVE' } },
                data: { status: 'INACTIVE' },
            })

            revalidateTagSafe('employee')
            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/employee-master')
            revalidatePath('/dashboard')

            return { success: true, count: result.count }
        })
    } catch (error: any) {
        console.error('Failed to bulk deactivate employees:', error)
        return { success: false, error: error?.message || 'Gagal menonaktifkan karyawan' }
    }
}

export async function getAttendanceSnapshot(params?: { date?: string; department?: string }) {
    try {
        const { start, end } = toDayWindow(params?.date)

        return await withPrismaAuth(async (prisma) => {
            const employeeFilter = {
                status: { in: ['ACTIVE', 'ON_LEAVE'] as EmployeeStatus[] },
                ...(params?.department && params.department !== 'all'
                    ? { department: params.department }
                    : {}),
            }

            const [employees, attendanceRows] = await Promise.all([
                prisma.employee.findMany({
                    where: employeeFilter,
                    orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        department: true,
                        position: true,
                    },
                }),
                prisma.attendance.findMany({
                    where: {
                        date: { gte: start, lt: end },
                    },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                department: true,
                                position: true,
                            },
                        },
                    },
                }),
            ])

            const attendanceMap = new Map(attendanceRows.map((row) => [row.employeeId, row]))

            const rows = employees.map((employee) => {
                const attendance = attendanceMap.get(employee.id)
                const status = attendance?.status || AttendanceStatus.ABSENT
                const workingHours = calculateWorkingHours(attendance?.checkIn, attendance?.checkOut)
                const overtimeHours = calculateOvertimeHours(workingHours)

                return {
                    id: employee.id,
                    employeeCode: employee.employeeId,
                    name: toEmployeeName(employee.firstName, employee.lastName),
                    department: employee.department,
                    position: employee.position,
                    clockIn: formatTime(attendance?.checkIn),
                    clockOut: formatTime(attendance?.checkOut),
                    workingHours,
                    overtimeHours,
                    status,
                    isLate: Boolean(attendance?.isLate),
                }
            })

            const presentCount = rows.filter((row) => row.status === 'PRESENT' || row.status === 'REMOTE').length
            const leaveCount = rows.filter((row) => row.status === 'LEAVE').length
            const lateCount = rows.filter((row) => row.isLate).length
            const absentCount = Math.max(rows.length - presentCount - leaveCount, 0)

            const departments = [...new Set(rows.map((row) => row.department))].sort((a, b) =>
                a.localeCompare(b)
            )

            return {
                date: start.toISOString(),
                rows,
                departments,
                stats: {
                    totalEmployees: rows.length,
                    presentCount,
                    leaveCount,
                    lateCount,
                    absentCount,
                    attendanceRate: rows.length > 0 ? Math.round(((presentCount + leaveCount) / rows.length) * 100) : 0,
                },
            }
        })
    } catch (error) {
        console.error('Failed to get attendance snapshot:', error)
        return {
            date: new Date().toISOString(),
            rows: [],
            departments: [],
            stats: {
                totalEmployees: 0,
                presentCount: 0,
                leaveCount: 0,
                lateCount: 0,
                absentCount: 0,
                attendanceRate: 0,
            },
        }
    }
}

export async function recordAttendanceEvent(data: {
    employeeId: string
    mode: 'CLOCK_IN' | 'CLOCK_OUT'
    dateTime?: string
    status?: AttendanceStatus
}) {
    try {
        if (!data.employeeId) return { success: false, error: 'Pilih karyawan terlebih dahulu' }

        return await withPrismaAuth(async (prisma) => {
            const employee = await prisma.employee.findUnique({
                where: { id: data.employeeId },
                select: { id: true, firstName: true, lastName: true, status: true },
            })

            if (!employee) return { success: false, error: 'Karyawan tidak ditemukan' }
            if (employee.status !== 'ACTIVE' && employee.status !== 'ON_LEAVE') {
                return { success: false, error: 'Karyawan tidak aktif untuk absensi' }
            }

            const eventTime = data.dateTime ? new Date(data.dateTime) : new Date()
            const dayStart = toStartOfDay(eventTime)
            const dayEnd = new Date(dayStart)
            dayEnd.setDate(dayEnd.getDate() + 1)

            const existing = await prisma.attendance.findFirst({
                where: {
                    employeeId: data.employeeId,
                    date: { gte: dayStart, lt: dayEnd },
                },
            })

            if (data.mode === 'CLOCK_IN') {
                if (existing?.checkIn) {
                    return { success: false, error: 'Karyawan sudah clock-in hari ini' }
                }

                const lateThreshold = new Date(dayStart)
                lateThreshold.setHours(8, 15, 0, 0)
                const isLate = eventTime.getTime() > lateThreshold.getTime()

                if (existing) {
                    await prisma.attendance.update({
                        where: { id: existing.id },
                        data: {
                            checkIn: eventTime,
                            status: data.status || AttendanceStatus.PRESENT,
                            isLate,
                        },
                    })
                } else {
                    await prisma.attendance.create({
                        data: {
                            employeeId: data.employeeId,
                            date: dayStart,
                            checkIn: eventTime,
                            status: data.status || AttendanceStatus.PRESENT,
                            isLate,
                        },
                    })
                }
            }

            if (data.mode === 'CLOCK_OUT') {
                if (!existing || !existing.checkIn) {
                    return { success: false, error: 'Belum ada clock-in untuk karyawan ini hari ini' }
                }
                if (existing.checkOut) {
                    return { success: false, error: 'Karyawan sudah clock-out hari ini' }
                }

                await prisma.attendance.update({
                    where: { id: existing.id },
                    data: { checkOut: eventTime },
                })
            }

            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/attendance')
            revalidatePath('/dashboard')

            return {
                success: true,
                message: `${toEmployeeName(employee.firstName, employee.lastName)} berhasil ${
                    data.mode === 'CLOCK_IN' ? 'clock-in' : 'clock-out'
                }`,
            }
        })
    } catch (error: any) {
        console.error('Failed to record attendance event:', error)
        return { success: false, error: error?.message || 'Gagal mencatat absensi' }
    }
}

export async function submitLeaveRequest(data: {
    employeeId?: string
    startDate: string
    endDate: string
    type: LeaveType | string
    reason?: string
}) {
    try {
        const user = await getAuthzUser()

        if (!data.startDate || !data.endDate) {
            return { success: false, error: 'Tanggal mulai dan tanggal selesai wajib diisi' }
        }

        const startDate = toStartOfDay(data.startDate)
        const endDate = toStartOfDay(data.endDate)
        if (startDate.getTime() > endDate.getTime()) {
            return { success: false, error: 'Tanggal selesai harus sama atau sesudah tanggal mulai' }
        }

        const leaveType = typeof data.type === 'string' ? normalizeLeaveType(data.type) : data.type

        return await withPrismaAuth(async (prisma) => {
            let employeeId = data.employeeId || null
            if (!employeeId) {
                const currentEmployee = await resolveCurrentEmployeeId(prisma, user.email)
                employeeId = currentEmployee
            }

            if (!employeeId) {
                return {
                    success: false,
                    error: 'Profil employee belum terhubung dengan akun Anda. Hubungi admin SDM.',
                }
            }

            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    status: true,
                },
            })

            if (!employee) return { success: false, error: 'Karyawan tidak ditemukan' }
            if (employee.status !== 'ACTIVE' && employee.status !== 'ON_LEAVE') {
                return { success: false, error: 'Status karyawan tidak valid untuk pengajuan cuti' }
            }

            const leave = await prisma.leaveRequest.create({
                data: {
                    employeeId: employee.id,
                    startDate,
                    endDate,
                    type: leaveType,
                    reason: data.reason?.trim() || null,
                    status: LeaveStatus.PENDING,
                },
            })

            const approverId = await resolveLeaveApproverId(prisma, employee.department)
            if (approverId) {
                await prisma.employeeTask.create({
                    data: {
                        employeeId: approverId,
                        title: `Approval Cuti: ${toEmployeeName(employee.firstName, employee.lastName)}`,
                        type: TaskType.ADMIN,
                        status: TaskStatus.PENDING,
                        priority: Priority.MEDIUM,
                        relatedId: leave.id,
                        notes: `${LEAVE_APPROVAL_PREFIX}${JSON.stringify({
                            leaveId: leave.id,
                            employeeId: employee.id,
                            startDate: leave.startDate.toISOString(),
                            endDate: leave.endDate.toISOString(),
                            type: leave.type,
                            reason: leave.reason,
                            requestedBy: user.id,
                            requestedAt: new Date().toISOString(),
                        })}`,
                    },
                })
            }

            revalidateTagSafe('hr')
            revalidatePath('/hcm')
            revalidatePath('/hcm/attendance')
            revalidatePath('/dashboard')

            return { success: true, leaveId: leave.id }
        })
    } catch (error: any) {
        console.error('Failed to submit leave request:', error)
        return { success: false, error: error?.message || 'Gagal mengajukan cuti' }
    }
}

export async function getLeaveRequests(params?: {
    status?: LeaveStatus | 'ALL'
    limit?: number
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where = params?.status && params.status !== 'ALL' ? { status: params.status } : undefined

            const requests = await prisma.leaveRequest.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            department: true,
                            position: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: params?.limit || 20,
            })

            const leaveIds = requests.map((request) => request.id)
            const taskMap = new Map<string, { approverName: string; taskStatus: TaskStatus }>()

            if (leaveIds.length > 0) {
                const approvalTasks = await prisma.employeeTask.findMany({
                    where: {
                        relatedId: { in: leaveIds },
                        notes: { startsWith: LEAVE_APPROVAL_PREFIX },
                    },
                    include: {
                        employee: {
                            select: { firstName: true, lastName: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                })

                for (const task of approvalTasks) {
                    if (!task.relatedId || taskMap.has(task.relatedId)) continue
                    taskMap.set(task.relatedId, {
                        approverName: toEmployeeName(task.employee.firstName, task.employee.lastName),
                        taskStatus: task.status,
                    })
                }
            }

            return requests.map((request) => {
                const meta = taskMap.get(request.id)
                return {
                    id: request.id,
                    employeeId: request.employee.id,
                    employeeCode: request.employee.employeeId,
                    employeeName: toEmployeeName(request.employee.firstName, request.employee.lastName),
                    department: request.employee.department,
                    position: request.employee.position,
                    startDate: request.startDate.toISOString(),
                    endDate: request.endDate.toISOString(),
                    type: request.type,
                    reason: request.reason,
                    status: request.status,
                    approverName: meta?.approverName || '-',
                    approvalTaskStatus: meta?.taskStatus || null,
                    createdAt: request.createdAt.toISOString(),
                }
            })
        })
    } catch (error) {
        console.error('Failed to get leave requests:', error)
        return []
    }
}

export async function approveLeaveRequest(leaveId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, SDM_APPROVER_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const leave = await prisma.leaveRequest.findUnique({
                where: { id: leaveId },
                include: {
                    employee: {
                        select: { id: true, firstName: true, lastName: true, department: true },
                    },
                },
            })

            if (!leave) throw new Error('Pengajuan cuti tidak ditemukan')
            if (leave.status !== LeaveStatus.PENDING) throw new Error('Pengajuan cuti sudah diproses')
            await assertLeaveApprovalAuthority(prisma, user, {
                leaveId,
                targetDepartment: leave.employee.department,
            })

            await prisma.leaveRequest.update({
                where: { id: leaveId },
                data: { status: LeaveStatus.APPROVED },
            })

            await prisma.employeeTask.updateMany({
                where: {
                    relatedId: leave.id,
                    status: TaskStatus.PENDING,
                    notes: { startsWith: LEAVE_APPROVAL_PREFIX },
                },
                data: {
                    status: TaskStatus.COMPLETED,
                    completedAt: new Date(),
                },
            })

            const dayPointer = toStartOfDay(leave.startDate)
            const endDate = toStartOfDay(leave.endDate)

            while (dayPointer.getTime() <= endDate.getTime()) {
                await prisma.attendance.upsert({
                    where: {
                        employeeId_date: {
                            employeeId: leave.employeeId,
                            date: dayPointer,
                        },
                    },
                    update: {
                        status: AttendanceStatus.LEAVE,
                        isLate: false,
                    },
                    create: {
                        employeeId: leave.employeeId,
                        date: dayPointer,
                        status: AttendanceStatus.LEAVE,
                        isLate: false,
                    },
                })

                dayPointer.setDate(dayPointer.getDate() + 1)
            }

            return {
                success: true,
                message: `Cuti ${toEmployeeName(leave.employee.firstName, leave.employee.lastName)} disetujui`,
            }
        })
    } catch (error: any) {
        console.error('Failed to approve leave request:', error)
        return { success: false, error: error?.message || 'Gagal menyetujui cuti' }
    } finally {
        revalidateTagSafe('hr')
        revalidatePath('/hcm')
        revalidatePath('/hcm/attendance')
        revalidatePath('/dashboard')
    }
}

export async function rejectLeaveRequest(leaveId: string, reason?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, SDM_APPROVER_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const leave = await prisma.leaveRequest.findUnique({
                where: { id: leaveId },
                include: {
                    employee: {
                        select: { firstName: true, lastName: true, department: true },
                    },
                },
            })

            if (!leave) return { success: false, error: 'Pengajuan cuti tidak ditemukan' }
            if (leave.status !== LeaveStatus.PENDING) return { success: false, error: 'Pengajuan cuti sudah diproses' }
            await assertLeaveApprovalAuthority(prisma, user, {
                leaveId,
                targetDepartment: leave.employee.department,
            })

            const appendedReason = reason?.trim() || 'Tidak ada alasan tambahan'

            await prisma.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: LeaveStatus.REJECTED,
                    reason: leave.reason
                        ? `${leave.reason}\n\nRejected by ${user.role}: ${appendedReason}`
                        : `Rejected by ${user.role}: ${appendedReason}`,
                },
            })

            await prisma.employeeTask.updateMany({
                where: {
                    relatedId: leave.id,
                    status: TaskStatus.PENDING,
                    notes: { startsWith: LEAVE_APPROVAL_PREFIX },
                },
                data: {
                    status: TaskStatus.REJECTED,
                    completedAt: new Date(),
                },
            })

            return {
                success: true,
                message: `Cuti ${toEmployeeName(leave.employee.firstName, leave.employee.lastName)} ditolak`,
            }
        })
    } catch (error: any) {
        console.error('Failed to reject leave request:', error)
        return { success: false, error: error?.message || 'Gagal menolak cuti' }
    } finally {
        revalidateTagSafe('hr')
        revalidatePath('/hcm')
        revalidatePath('/hcm/attendance')
        revalidatePath('/dashboard')
    }
}

export async function getPayrollRun(period: string) {
    try {
        if (!isValidPeriod(period)) {
            return { success: false, error: 'Format periode tidak valid. Gunakan YYYY-MM.' }
        }

        return await withPrismaAuth(async (prisma) => {
            const runTask = await prisma.employeeTask.findFirst({
                where: {
                    relatedId: `PAYROLL-${period}`,
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                orderBy: { updatedAt: 'desc' },
                include: {
                    employee: {
                        select: { firstName: true, lastName: true },
                    },
                },
            })

            if (!runTask) {
                return { success: true, exists: false }
            }

            const payload = parsePayrollPayload(runTask.notes)
            if (!payload) {
                return { success: false, error: 'Data payroll run korup atau tidak terbaca' }
            }

            return {
                success: true,
                exists: true,
                run: {
                    period: payload.period,
                    periodLabel: payload.periodLabel,
                    summary: payload.summary,
                    status:
                        payload.status === 'POSTED' || payload.postedJournalReference
                            ? 'POSTED'
                            : 'PENDING_APPROVAL',
                    postedAt: payload.postedAt || null,
                    postedBy: payload.postedBy || null,
                    postedJournalReference: payload.postedJournalReference || null,
                    disbursementStatus: payload.disbursementStatus || 'PENDING',
                    disbursedAt: payload.disbursedAt || null,
                    disbursementReference: payload.disbursementReference || null,
                    disbursementMethod: payload.disbursementMethod || null,
                    generatedAt: payload.generatedAt,
                    generatedBy: payload.generatedBy,
                    approverName: toEmployeeName(runTask.employee.firstName, runTask.employee.lastName),
                    lines: payload.lines,
                },
            }
        })
    } catch (error: any) {
        console.error('Failed to fetch payroll run:', error)
        return { success: false, error: error?.message || 'Gagal mengambil payroll run' }
    }
}

export async function getPayrollExportData(period: string) {
    try {
        const result = await getPayrollRun(period)
        if (!result.success) {
            return { success: false, error: 'error' in result ? result.error : 'Gagal mengambil data payroll' }
        }

        if (!('exists' in result) || !result.exists || !('run' in result) || !result.run) {
            return { success: false, error: 'Payroll draft belum tersedia untuk periode ini' }
        }

        const run = result.run
        const data: PayrollRunExportData = {
            period: run.period,
            periodLabel: run.periodLabel,
            status: run.status === 'POSTED' ? 'POSTED' : 'PENDING_APPROVAL',
            generatedAt: run.generatedAt,
            postedAt: run.postedAt,
            postedBy: run.postedBy,
            postedJournalReference: run.postedJournalReference,
            disbursementStatus: (run as any).disbursementStatus || 'PENDING',
            disbursedAt: (run as any).disbursedAt || null,
            disbursementReference: (run as any).disbursementReference || null,
            disbursementMethod: ((run as any).disbursementMethod as PaymentMethod | null) || null,
            summary: run.summary,
            rows: run.lines.map((line) => ({
                employeeId: line.employeeId,
                employeeCode: line.employeeCode,
                employeeName: line.employeeName,
                department: line.department,
                position: line.position,
                attendanceDays: line.attendanceDays,
                leaveDays: line.leaveDays,
                lateCount: line.lateCount,
                overtimeHours: line.overtimeHours,
                basicSalary: line.basicSalary,
                transportAllowance: line.transportAllowance,
                mealAllowance: line.mealAllowance,
                positionAllowance: line.positionAllowance,
                overtimePay: line.overtimePay,
                bpjsKesehatan: line.bpjsKesehatan,
                bpjsKetenagakerjaan: line.bpjsKetenagakerjaan,
                pph21: line.pph21,
                grossSalary: line.grossSalary,
                totalDeductions: line.totalDeductions,
                netSalary: line.netSalary,
            })),
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('Failed to build payroll export data:', error)
        return { success: false, error: error?.message || 'Gagal menyiapkan export payroll' }
    }
}

export async function getPayslipData(period: string, employeeId: string) {
    try {
        if (!isValidPeriod(period)) {
            return { success: false, error: 'Format periode tidak valid. Gunakan YYYY-MM.' }
        }
        if (!employeeId) {
            return { success: false, error: 'Employee ID tidak valid.' }
        }

        return await withPrismaAuth(async (prisma) => {
            const runTask = await prisma.employeeTask.findFirst({
                where: {
                    relatedId: `PAYROLL-${period}`,
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                orderBy: { updatedAt: 'desc' },
            })

            if (!runTask) return { success: false, error: 'Payroll draft belum tersedia untuk periode ini' }

            const payload = parsePayrollPayload(runTask.notes)
            if (!payload) return { success: false, error: 'Data payroll run tidak valid' }

            const payrollLine = payload.lines.find((line) => line.employeeId === employeeId)
            if (!payrollLine) return { success: false, error: 'Data payroll karyawan tidak ditemukan pada periode ini' }

            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    position: true,
                    email: true,
                },
            })

            if (!employee) return { success: false, error: 'Data karyawan tidak ditemukan' }

            const payslip: PayslipData = {
                period: payload.period,
                periodLabel: payload.periodLabel,
                generatedAt: payload.generatedAt,
                employee: {
                    id: employee.id,
                    code: employee.employeeId,
                    name: toEmployeeName(employee.firstName, employee.lastName),
                    department: employee.department,
                    position: employee.position,
                    email: employee.email,
                },
                payroll: payrollLine,
                summary: payload.summary,
                postedAt: payload.postedAt || null,
                postedJournalReference: payload.postedJournalReference || null,
            }

            return { success: true, data: payslip }
        })
    } catch (error: any) {
        console.error('Failed to fetch payslip data:', error)
        return { success: false, error: error?.message || 'Gagal mengambil data slip gaji' }
    }
}

export async function getPayrollComplianceReport(period: string) {
    try {
        const result = await getPayrollExportData(period)
        if (!result.success || !('data' in result) || !result.data) {
            return { success: false, error: 'error' in result ? result.error : 'Payroll run tidak ditemukan' }
        }

        const rows = result.data.rows
        const bpjsKesehatan = rows.reduce((sum, row) => sum + row.bpjsKesehatan, 0)
        const bpjsKetenagakerjaan = rows.reduce((sum, row) => sum + row.bpjsKetenagakerjaan, 0)
        const totalBpjs = bpjsKesehatan + bpjsKetenagakerjaan
        const totalPph21 = rows.reduce((sum, row) => sum + row.pph21, 0)

        return {
            success: true,
            report: {
                period: result.data.period,
                periodLabel: result.data.periodLabel,
                employeeCount: rows.length,
                totals: {
                    bpjsKesehatan,
                    bpjsKetenagakerjaan,
                    bpjsTotal: totalBpjs,
                    pph21: totalPph21,
                },
                rows: rows.map((row) => ({
                    employeeCode: row.employeeCode,
                    employeeName: row.employeeName,
                    department: row.department,
                    bpjsKesehatan: row.bpjsKesehatan,
                    bpjsKetenagakerjaan: row.bpjsKetenagakerjaan,
                    pph21: row.pph21,
                    netSalary: row.netSalary,
                })),
            },
        }
    } catch (error: any) {
        console.error('Failed to build payroll compliance report:', error)
        return { success: false, error: error?.message || 'Gagal menyiapkan laporan compliance payroll' }
    }
}

export async function createPayrollDisbursementBatch(period: string, options?: {
    method?: PaymentMethod
    reference?: string
    notes?: string
}) {
    try {
        const user = await getAuthzUser()
        assertRole(user, SDM_APPROVER_ROLES)

        if (!isValidPeriod(period)) {
            return { success: false, error: 'Format periode tidak valid. Gunakan YYYY-MM.' }
        }

        const method = options?.method || 'TRANSFER'

        return await withPrismaAuth(async (prisma) => {
            const runTask = await prisma.employeeTask.findFirst({
                where: {
                    relatedId: `PAYROLL-${period}`,
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                orderBy: { updatedAt: 'desc' },
            })

            if (!runTask) return { success: false, error: 'Payroll run belum tersedia untuk periode ini' }

            await assertPayrollAuthority(prisma, user, { assignedApproverId: runTask.employeeId })

            const payload = parsePayrollPayload(runTask.notes)
            if (!payload) return { success: false, error: 'Data payroll run tidak valid' }
            if (!payload.postedJournalReference) {
                return { success: false, error: 'Payroll harus di-approve dan diposting ke jurnal terlebih dahulu' }
            }
            if (payload.disbursementStatus === 'PAID' && payload.disbursementReference) {
                return {
                    success: true,
                    message: `Disbursement payroll sudah dibuat (${payload.disbursementReference})`,
                    paymentNumber: payload.disbursementReference,
                }
            }

            const accounts = await resolvePayrollAccounts(prisma)
            if (!accounts.success) return { success: false, error: accounts.error }

            const year = new Date().getFullYear()
            const paymentCount = await prisma.payment.count({
                where: {
                    number: { startsWith: `PRPAY-${year}` },
                },
            })
            const paymentNumber = `PRPAY-${year}-${String(paymentCount + 1).padStart(4, '0')}`
            const reference = options?.reference?.trim() || `PAYDISB-${payload.period.replace('-', '')}`

            await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    date: new Date(),
                    amount: payload.summary.net,
                    method,
                    reference,
                    notes: JSON.stringify({
                        source: 'PAYROLL_DISBURSEMENT',
                        period: payload.period,
                        periodLabel: payload.periodLabel,
                        totalEmployees: payload.summary.employees,
                        netAmount: payload.summary.net,
                        requestedBy: user.id,
                        notes: options?.notes || null,
                    }),
                },
            })

            const disbursementJournalRef = reference.startsWith('PAYDISB-') ? reference : `PAYDISB-${payload.period.replace('-', '')}`
            const journalPost = await postJournalEntry({
                description: `Payroll Disbursement ${payload.periodLabel}`,
                date: new Date(),
                reference: disbursementJournalRef,
                lines: [
                    {
                        accountCode: accounts.data.payrollPayableCode,
                        debit: payload.summary.net,
                        credit: 0,
                        description: `Pelunasan utang gaji ${payload.periodLabel}`,
                    },
                    {
                        accountCode: accounts.data.cashCode,
                        debit: 0,
                        credit: payload.summary.net,
                        description: `Pembayaran payroll ${payload.periodLabel}`,
                    },
                ],
            })
            if (!journalPost.success) {
                return { success: false, error: 'error' in journalPost ? journalPost.error : 'Gagal posting jurnal disbursement payroll' }
            }

            const updatedPayload: PayrollRunPayload = {
                ...payload,
                disbursementStatus: 'PAID',
                disbursementReference: paymentNumber,
                disbursementMethod: method,
                disbursedAt: new Date().toISOString(),
                disbursedBy: user.id,
            }

            await prisma.employeeTask.update({
                where: { id: runTask.id },
                data: {
                    notes: `${PAYROLL_RUN_PREFIX}${JSON.stringify(updatedPayload)}`,
                    updatedAt: new Date(),
                },
            })

            revalidateTagSafe('hr')
            revalidateTagSafe('finance')
            revalidatePath('/hcm/payroll')
            revalidatePath('/finance/vendor-payments')
            revalidatePath('/dashboard')

            return {
                success: true,
                paymentNumber,
                journalReference: disbursementJournalRef,
                message: `Batch disbursement payroll ${payload.periodLabel} berhasil dibuat`,
            }
        })
    } catch (error: any) {
        console.error('Failed to create payroll disbursement batch:', error)
        return { success: false, error: error?.message || 'Gagal membuat batch disbursement payroll' }
    }
}

export async function generatePayrollDraft(period: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, SDM_APPROVER_ROLES)

        if (!isValidPeriod(period)) {
            return { success: false, error: 'Format periode tidak valid. Gunakan YYYY-MM.' }
        }

        return await withPrismaAuth(async (prisma) => {
            await assertPayrollAuthority(prisma, user)

            const current = await prisma.employeeTask.findFirst({
                where: {
                    relatedId: `PAYROLL-${period}`,
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                orderBy: { updatedAt: 'desc' },
            })

            if (current) {
                const currentPayload = parsePayrollPayload(current.notes)
                if (currentPayload?.postedJournalReference) {
                    return {
                        success: false,
                        error: `Periode ${period} sudah diposting ke jurnal (${currentPayload.postedJournalReference}).`,
                    }
                }
            }

            const approverId = await resolvePayrollApproverId(prisma)
            if (!approverId) {
                return { success: false, error: 'Tidak ada approver payroll aktif yang terkonfigurasi' }
            }

            const payload = await buildPayrollDraft(prisma, period, user.id)
            const notes = `${PAYROLL_RUN_PREFIX}${JSON.stringify(payload)}`

            if (current) {
                await prisma.employeeTask.update({
                    where: { id: current.id },
                    data: {
                        employeeId: approverId,
                        title: `Payroll Run ${payload.periodLabel}`,
                        type: TaskType.ADMIN,
                        status: TaskStatus.PENDING,
                        priority: Priority.HIGH,
                        notes,
                        completedAt: null,
                    },
                })
            } else {
                await prisma.employeeTask.create({
                    data: {
                        employeeId: approverId,
                        title: `Payroll Run ${payload.periodLabel}`,
                        type: TaskType.ADMIN,
                        status: TaskStatus.PENDING,
                        priority: Priority.HIGH,
                        relatedId: `PAYROLL-${period}`,
                        notes,
                    },
                })
            }

            revalidateTagSafe('hr')
            revalidateTagSafe('finance')
            revalidatePath('/hcm')
            revalidatePath('/hcm/payroll')
            revalidatePath('/finance')
            revalidatePath('/dashboard')

            return {
                success: true,
                message: `Payroll draft ${payload.periodLabel} berhasil dihitung`,
                summary: payload.summary,
            }
        })
    } catch (error: any) {
        console.error('Failed to generate payroll draft:', error)
        return { success: false, error: error?.message || 'Gagal menghitung payroll draft' }
    }
}

export async function approvePayrollRun(period: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, SDM_APPROVER_ROLES)

        if (!isValidPeriod(period)) {
            return { success: false, error: 'Format periode tidak valid. Gunakan YYYY-MM.' }
        }

        return await withPrismaAuth(async (prisma) => {
            const runTask = await prisma.employeeTask.findFirst({
                where: {
                    relatedId: `PAYROLL-${period}`,
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                orderBy: { updatedAt: 'desc' },
            })

            if (!runTask) return { success: false, error: 'Payroll draft belum dibuat untuk periode ini' }
            await assertPayrollAuthority(prisma, user, { assignedApproverId: runTask.employeeId })

            const payload = parsePayrollPayload(runTask.notes)
            if (!payload) return { success: false, error: 'Data payroll run tidak valid' }
            if (payload.postedJournalReference) {
                return {
                    success: true,
                    message: `Payroll sudah pernah diposting (${payload.postedJournalReference})`,
                }
            }

            const accounts = await resolvePayrollAccounts(prisma)
            if (!accounts.success) return { success: false, error: accounts.error }

            const bpjsTotal = payload.lines.reduce(
                (sum, line) => sum + line.bpjsKesehatan + line.bpjsKetenagakerjaan,
                0
            )
            const taxTotal = payload.lines.reduce((sum, line) => sum + line.pph21, 0)

            const lines: Array<{
                accountCode: string
                debit: number
                credit: number
                description?: string
            }> = [
                {
                    accountCode: accounts.data.expenseCode,
                    debit: payload.summary.gross,
                    credit: 0,
                    description: `Beban payroll ${payload.periodLabel}`,
                },
                {
                    accountCode: accounts.data.payrollPayableCode,
                    debit: 0,
                    credit: payload.summary.net,
                    description: `Utang gaji ${payload.periodLabel}`,
                },
            ]

            if (bpjsTotal > 0) {
                lines.push({
                    accountCode: accounts.data.bpjsCode,
                    debit: 0,
                    credit: bpjsTotal,
                    description: `Kewajiban BPJS ${payload.periodLabel}`,
                })
            }

            if (taxTotal > 0) {
                lines.push({
                    accountCode: accounts.data.taxCode,
                    debit: 0,
                    credit: taxTotal,
                    description: `Kewajiban PPh21 ${payload.periodLabel}`,
                })
            }

            const reference = `PAYROLL-${payload.period.replace('-', '')}`

            const posting = await postJournalEntry({
                description: `Payroll Posting ${payload.periodLabel}`,
                date: new Date(),
                reference,
                lines,
            })

            if (!posting.success) {
                return { success: false, error: 'error' in posting ? posting.error : 'Gagal post jurnal payroll' }
            }

            const updatedPayload: PayrollRunPayload = {
                ...payload,
                status: 'POSTED',
                disbursementStatus: payload.disbursementStatus || 'PENDING',
                postedAt: new Date().toISOString(),
                postedBy: user.id,
                postedJournalReference: reference,
            }

            await prisma.employeeTask.update({
                where: { id: runTask.id },
                data: {
                    status: TaskStatus.COMPLETED,
                    completedAt: new Date(),
                    notes: `${PAYROLL_RUN_PREFIX}${JSON.stringify(updatedPayload)}`,
                },
            })

            revalidateTagSafe('hr')
            revalidateTagSafe('finance')
            revalidatePath('/hcm')
            revalidatePath('/hcm/payroll')
            revalidatePath('/finance')
            revalidatePath('/finance/journal')
            revalidatePath('/dashboard')

            return {
                success: true,
                message: `Payroll ${payload.periodLabel} disetujui dan diposting ke jurnal`,
                journalReference: reference,
            }
        })
    } catch (error: any) {
        console.error('Failed to approve payroll run:', error)
        return { success: false, error: error?.message || 'Gagal menyetujui payroll run' }
    }
}

export async function getHCMDashboardData() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const { start, end } = toDayWindow()
            const periodLabel = new Date().toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
            })

            const [
                activeCount,
                totalCount,
                todayAttendance,
                pendingLeaveCount,
                leaveRequests,
                payrollAgg,
                latestPayrollTask,
            ] = await Promise.all([
                prisma.employee.count({ where: { status: 'ACTIVE' } }),
                prisma.employee.count(),
                prisma.attendance.findMany({
                    where: { date: { gte: start, lt: end } },
                    include: {
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                                department: true,
                            },
                        },
                    },
                }),
                prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
                prisma.leaveRequest.findMany({
                    where: { status: 'PENDING' },
                    include: {
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                                department: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                }),
                prisma.employee.aggregate({
                    _sum: { baseSalary: true },
                    where: { status: 'ACTIVE' },
                }),
                prisma.employeeTask.findFirst({
                    where: {
                        notes: { startsWith: PAYROLL_RUN_PREFIX },
                        relatedId: { startsWith: 'PAYROLL-' },
                    },
                    orderBy: { updatedAt: 'desc' },
                    select: { notes: true },
                }),
            ])

            const present = todayAttendance.filter(
                (item) => item.status === 'PRESENT' || item.status === 'REMOTE'
            ).length
            const late = todayAttendance.filter((item) => item.isLate).length
            const onLeave = todayAttendance.filter((item) => item.status === 'LEAVE').length
            const absent = Math.max(activeCount - present - onLeave, 0)

            const latestPayrollPayload = parsePayrollPayload(latestPayrollTask?.notes || null)
            const gross = latestPayrollPayload?.summary.gross ?? Number(payrollAgg._sum.baseSalary || 0)
            const deductions = latestPayrollPayload?.summary.deductions ?? 0
            const payrollStatus = latestPayrollPayload?.status === 'POSTED' ? 'POSTED' : pendingLeaveCount > 0 ? 'REVIEW' : 'READY'
            const payrollPeriod = latestPayrollPayload?.periodLabel || periodLabel

            return {
                attendance: {
                    present,
                    total: activeCount,
                    late,
                    onLeave,
                    absent,
                    attendanceRate: activeCount > 0 ? Math.round(((present + onLeave) / activeCount) * 100) : 0,
                    timestamp: new Date().toISOString(),
                },
                payroll: {
                    gross,
                    deductions,
                    net: gross - deductions,
                    status: payrollStatus,
                    period: payrollPeriod,
                },
                leaves: {
                    pendingCount: pendingLeaveCount,
                    requests: leaveRequests.map((item) => ({
                        id: item.id,
                        employeeName: toEmployeeName(item.employee.firstName, item.employee.lastName),
                        department: item.employee.department,
                        type: item.type,
                        startDate: item.startDate.toISOString(),
                        endDate: item.endDate.toISOString(),
                        days:
                            Math.max(
                                1,
                                Math.ceil(
                                    (toStartOfDay(item.endDate).getTime() - toStartOfDay(item.startDate).getTime()) /
                                        (24 * 60 * 60 * 1000)
                                ) + 1
                            ),
                    })),
                },
                headcount: {
                    active: activeCount,
                    total: totalCount,
                },
            }
        })
    } catch (error) {
        console.error('Failed to fetch HCM dashboard data:', error)
        return {
            attendance: {
                present: 0,
                total: 0,
                late: 0,
                onLeave: 0,
                absent: 0,
                attendanceRate: 0,
                timestamp: new Date().toISOString(),
            },
            payroll: {
                gross: 0,
                deductions: 0,
                net: 0,
                status: 'DRAFT',
                period: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            },
            leaves: {
                pendingCount: 0,
                requests: [],
            },
            headcount: {
                active: 0,
                total: 0,
            },
        }
    }
}
