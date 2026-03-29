import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const DEFAULT_NUMBERING = [
    { module: "Sales Order", prefix: "SO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SO-2602-0001", lastNumber: 0 },
    { module: "Purchase Order", prefix: "PO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "PO-2602-0001", lastNumber: 0 },
    { module: "Invoice", prefix: "INV", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "INV-2602-0001", lastNumber: 0 },
    { module: "Delivery Note", prefix: "SJ", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SJ-2602-0001", lastNumber: 0 },
    { module: "Work Order", prefix: "WO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "WO-2602-0001", lastNumber: 0 },
    { module: "Goods Received", prefix: "GRN", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "GRN-2602-0001", lastNumber: 0 },
    { module: "Purchase Request", prefix: "PR", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "PR-2602-0001", lastNumber: 0 },
    { module: "Journal Entry", prefix: "JE", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "JE-2602-0001", lastNumber: 0 },
    { module: "Subcontract Order", prefix: "SC", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SC-2602-0001", lastNumber: 0 },
    { module: "Cost Sheet", prefix: "CS", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "CS-2602-0001", lastNumber: 0 },
]

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        return NextResponse.json({ success: true, data: DEFAULT_NUMBERING })
    } catch (e) {
        console.error("[API] numbering-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
