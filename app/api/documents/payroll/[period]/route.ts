import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { DocumentService } from "@/lib/services/document-service"
import { getPayrollExportData } from "@/app/actions/hcm"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ period: string }> }
) {
    try {
        const params = await props.params
        const period = params.period
        const disposition = req.nextUrl.searchParams.get("disposition") || "attachment"
        const contentDisposition = disposition === "inline" ? "inline" : "attachment"

        const supabase = await createClient()
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const exportResult = await getPayrollExportData(period)
        if (!exportResult.success || !("data" in exportResult) || !exportResult.data) {
            const message = "error" in exportResult ? String(exportResult.error) : "Payroll run tidak ditemukan"
            const notFound = message.toLowerCase().includes("belum") || message.toLowerCase().includes("tidak ditemukan")
            return NextResponse.json({ error: message }, { status: notFound ? 404 : 400 })
        }

        const { data } = exportResult
        const templateData = {
            company_name: "ERP System",
            period: data.period,
            period_label: data.periodLabel,
            status: data.status,
            generated_at: data.generatedAt,
            posted_at: data.postedAt || null,
            journal_reference: data.postedJournalReference || null,
            summary: {
                employees: data.summary.employees,
                gross: data.summary.gross,
                deductions: data.summary.deductions,
                net: data.summary.net,
                overtime_hours: data.summary.overtimeHours,
            },
            rows: data.rows.map((row) => ({
                employee_code: row.employeeCode,
                employee_name: row.employeeName,
                department: row.department,
                position: row.position,
                attendance_days: row.attendanceDays,
                overtime_hours: row.overtimeHours,
                basic_salary: row.basicSalary,
                allowances: row.transportAllowance + row.mealAllowance + row.positionAllowance,
                overtime_pay: row.overtimePay,
                deductions: row.totalDeductions,
                net_salary: row.netSalary,
            })),
        }

        const pdfBuffer = await DocumentService.generatePDF("payroll_report", templateData)
        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="Payroll-${period}.pdf"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error: any) {
        console.error("Payroll PDF Generation Error:", error)
        return NextResponse.json({ error: error.message || "Failed to generate payroll PDF" }, { status: 500 })
    }
}
