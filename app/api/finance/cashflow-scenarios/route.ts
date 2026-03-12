import { NextRequest, NextResponse } from "next/server"
import { getCashflowScenarios, createCashflowScenario } from "@/lib/actions/finance-cashflow"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
        const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))
        const data = await getCashflowScenarios(month, year)
        return NextResponse.json({ success: true, scenarios: data })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, month, year } = body
        if (!name || !month || !year) {
            return NextResponse.json({ success: false, error: "Missing name, month, or year" }, { status: 400 })
        }
        const result = await createCashflowScenario(name, month, year)
        return NextResponse.json({ success: true, ...result })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
