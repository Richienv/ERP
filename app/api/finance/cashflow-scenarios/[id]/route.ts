import { NextRequest, NextResponse } from "next/server"
import { getCashflowScenario, updateCashflowScenario, deleteCashflowScenario } from "@/lib/actions/finance-cashflow"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const data = await getCashflowScenario(id)
        if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
        return NextResponse.json({ success: true, scenario: data })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await req.json()
        await updateCashflowScenario(id, body)
        return NextResponse.json({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await deleteCashflowScenario(id)
        return NextResponse.json({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
