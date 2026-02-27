import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const logs = await prisma.bOMEditLog.findMany({
            where: { bomId: id },
            orderBy: { createdAt: "desc" },
            take: 50,
        })
        return NextResponse.json({ success: true, data: logs })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
