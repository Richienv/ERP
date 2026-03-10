import { NextResponse } from "next/server"
import { getAccuracyTrend } from "@/lib/actions/finance-cashflow"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const months = Number(searchParams.get("months") || 3)
        const data = await getAccuracyTrend(Math.min(months, 12))
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch accuracy trend" },
            { status: error.message === "Unauthorized" ? 401 : 500 }
        )
    }
}
