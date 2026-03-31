import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"

function isValidPeriod(period: string) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
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

        // Get payroll run
        const runTask = await prisma.employeeTask.findFirst({
            where: {
                relatedId: `PAYROLL-${period}`,
                notes: { startsWith: PAYROLL_RUN_PREFIX },
            },
            orderBy: { updatedAt: "desc" },
        })

        if (!runTask) {
            return NextResponse.json({ success: false, error: "Payroll run tidak ditemukan" })
        }

        const payload = parsePayrollPayload(runTask.notes)
        if (!payload || !payload.lines) {
            return NextResponse.json({ success: false, error: "Data payroll run tidak valid" })
        }

        const rows = payload.lines
        const bpjsKesehatan = rows.reduce((sum: number, row: any) => sum + (row.bpjsKesehatan || 0), 0)
        const bpjsKetenagakerjaan = rows.reduce((sum: number, row: any) => sum + (row.bpjsKetenagakerjaan || 0), 0)
        const bpjsJHT = rows.reduce((sum: number, row: any) => sum + (row.bpjsJHT ?? 0), 0)
        const bpjsJP = rows.reduce((sum: number, row: any) => sum + (row.bpjsJP ?? 0), 0)
        const totalBpjs = bpjsKesehatan + bpjsKetenagakerjaan
        const totalPph21 = rows.reduce((sum: number, row: any) => sum + (row.pph21 || 0), 0)

        return NextResponse.json({
            success: true,
            report: {
                period: payload.period,
                periodLabel: payload.periodLabel,
                employeeCount: rows.length,
                totals: {
                    bpjsKesehatan,
                    bpjsKetenagakerjaan,
                    bpjsJHT,
                    bpjsJP,
                    bpjsTotal: totalBpjs,
                    pph21: totalPph21,
                },
                rows: rows.map((row: any) => ({
                    employeeCode: row.employeeCode,
                    employeeName: row.employeeName,
                    department: row.department,
                    bpjsKesehatan: row.bpjsKesehatan || 0,
                    bpjsKetenagakerjaan: row.bpjsKetenagakerjaan || 0,
                    bpjsJHT: row.bpjsJHT ?? 0,
                    bpjsJP: row.bpjsJP ?? 0,
                    pph21: row.pph21 || 0,
                    netSalary: row.netSalary || 0,
                })),
            },
        })
    } catch (e) {
        console.error("[API] payroll-compliance:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
