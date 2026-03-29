import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"

function isValidPeriod(period: string) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
}

function toEmployeeName(firstName: string, lastName?: string | null) {
    return `${firstName} ${lastName || ""}`.trim()
}

function parsePayrollPayload(notes?: string | null) {
    if (!notes || !notes.startsWith(PAYROLL_RUN_PREFIX)) return null
    const raw = notes.slice(PAYROLL_RUN_PREFIX.length)
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const now = new Date()
        const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const period = searchParams.get("period") || defaultPeriod

        if (!isValidPeriod(period)) {
            return NextResponse.json({ success: false, error: "Format periode tidak valid. Gunakan YYYY-MM." })
        }

        const runTask = await prisma.employeeTask.findFirst({
            where: {
                relatedId: `PAYROLL-${period}`,
                notes: { startsWith: PAYROLL_RUN_PREFIX },
            },
            orderBy: { updatedAt: "desc" },
            include: {
                employee: { select: { firstName: true, lastName: true } },
            },
        })

        if (!runTask) {
            return NextResponse.json({ success: true, exists: false })
        }

        const payload = parsePayrollPayload(runTask.notes)
        if (!payload) {
            return NextResponse.json({ success: false, error: "Data payroll run korup atau tidak terbaca" })
        }

        return NextResponse.json({
            success: true,
            exists: true,
            run: {
                period: payload.period,
                periodLabel: payload.periodLabel,
                summary: payload.summary ?? { gross: 0, deductions: 0, net: 0, employees: 0, overtimeHours: 0 },
                status:
                    payload.status === "POSTED" || payload.postedJournalReference
                        ? "POSTED"
                        : "PENDING_APPROVAL",
                postedAt: payload.postedAt || null,
                postedBy: payload.postedBy || null,
                postedJournalReference: payload.postedJournalReference || null,
                disbursementStatus: payload.disbursementStatus || "PENDING",
                disbursedAt: payload.disbursedAt || null,
                disbursementReference: payload.disbursementReference || null,
                disbursementMethod: payload.disbursementMethod || null,
                generatedAt: payload.generatedAt,
                generatedBy: payload.generatedBy,
                approverName: toEmployeeName(runTask.employee.firstName, runTask.employee.lastName),
                lines: payload.lines || [],
            },
        })
    } catch (e) {
        console.error("[API] payroll-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
