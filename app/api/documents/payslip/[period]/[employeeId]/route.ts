import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { DocumentService } from "@/lib/services/document-service"
import { getPayslipData } from "@/app/actions/hcm"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ period: string; employeeId: string }> }
) {
    try {
        const params = await props.params
        const period = params.period
        const employeeId = params.employeeId
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

        const payslipResult = await getPayslipData(period, employeeId)
        if (!payslipResult.success || !("data" in payslipResult) || !payslipResult.data) {
            const message = "error" in payslipResult ? String(payslipResult.error) : "Slip gaji tidak ditemukan"
            const notFound = message.toLowerCase().includes("tidak ditemukan")
            return NextResponse.json({ error: message }, { status: notFound ? 404 : 400 })
        }

        const { data } = payslipResult
        const templateData = {
            company_name: "ERP System",
            period: data.period,
            period_label: data.periodLabel,
            generated_at: data.generatedAt,
            posted_at: data.postedAt || null,
            journal_reference: data.postedJournalReference || null,
            employee: {
                id: data.employee.code,
                name: data.employee.name,
                department: data.employee.department,
                position: data.employee.position,
                email: data.employee.email || "-",
            },
            payroll: {
                attendance_days: data.payroll.attendanceDays,
                leave_days: data.payroll.leaveDays,
                late_count: data.payroll.lateCount,
                overtime_hours: data.payroll.overtimeHours,
                basic_salary: data.payroll.basicSalary,
                transport_allowance: data.payroll.transportAllowance,
                meal_allowance: data.payroll.mealAllowance,
                position_allowance: data.payroll.positionAllowance,
                overtime_pay: data.payroll.overtimePay,
                bpjs_kesehatan: data.payroll.bpjsKesehatan,
                bpjs_ketenagakerjaan: data.payroll.bpjsKetenagakerjaan,
                pph21: data.payroll.pph21,
                gross_salary: data.payroll.grossSalary,
                total_deductions: data.payroll.totalDeductions,
                net_salary: data.payroll.netSalary,
            },
        }

        const pdfBuffer = await DocumentService.generatePDF("payslip", templateData)
        const fileName = `Payslip-${data.employee.code}-${period}.pdf`

        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${contentDisposition}; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error: any) {
        console.error("Payslip PDF Generation Error:", error)
        return NextResponse.json({ error: error.message || "Failed to generate payslip PDF" }, { status: 500 })
    }
}
