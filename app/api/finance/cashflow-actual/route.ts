import { NextRequest, NextResponse } from "next/server"
import { getCashflowActualData } from "@/lib/actions/finance-cashflow"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
        const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))

        if (month < 1 || month > 12 || year < 2020 || year > 2100) {
            return NextResponse.json({ success: false, error: "Invalid month/year" }, { status: 400 })
        }

        const data = await getCashflowActualData(month, year)
        return NextResponse.json({ success: true, ...data })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        const status = message === "Unauthorized" ? 401 : 500
        return NextResponse.json({ success: false, error: message }, { status })
    }
}
