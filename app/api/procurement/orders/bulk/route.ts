import { NextResponse } from "next/server"
import {
    bulkApprovePurchaseOrders,
    bulkRejectPurchaseOrders,
} from "@/lib/actions/procurement"

type BulkRequestBody = {
    ids?: unknown
    action?: unknown
    reason?: unknown
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as BulkRequestBody
        const ids = Array.isArray(body.ids)
            ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
            : []
        const action = typeof body.action === "string" ? body.action : "approve"
        const reason = typeof body.reason === "string" ? body.reason : undefined

        if (ids.length === 0) {
            return NextResponse.json(
                { error: "ids required" },
                { status: 400 },
            )
        }

        const result =
            action === "reject"
                ? await bulkRejectPurchaseOrders(ids, reason)
                : await bulkApprovePurchaseOrders(ids)

        return NextResponse.json(result)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
