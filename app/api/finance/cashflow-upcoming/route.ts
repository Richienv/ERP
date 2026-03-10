import { NextRequest, NextResponse } from "next/server"
import { getUpcomingObligations } from "@/lib/actions/finance-cashflow"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get("days") || "90", 10)
        const clampedDays = Math.min(Math.max(days, 7), 365)

        const data = await getUpcomingObligations(clampedDays)
        return NextResponse.json(data)
    } catch (error: any) {
        console.error("[cashflow-upcoming] Error:", error?.message)
        return NextResponse.json(
            { error: error?.message || "Failed to fetch upcoming obligations" },
            { status: error?.message === "Unauthorized" ? 401 : 500 }
        )
    }
}
