import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

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
