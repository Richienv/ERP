import { NextResponse } from "next/server"
import { bulkUpdateVendorStatus } from "@/app/actions/vendor"

type BulkRequestBody = {
    ids?: unknown
    action?: unknown
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as BulkRequestBody
        const ids = Array.isArray(body.ids)
            ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
            : []
        const action = typeof body.action === "string" ? body.action : ""

        if (ids.length === 0) {
            return NextResponse.json(
                { error: "ids required" },
                { status: 400 },
            )
        }

        if (action !== "activate" && action !== "deactivate") {
            return NextResponse.json(
                { error: "action must be 'activate' or 'deactivate'" },
                { status: 400 },
            )
        }

        const targetStatus = action === "activate" ? "ACTIVE" : "INACTIVE"
        const result = await bulkUpdateVendorStatus(ids, targetStatus)

        return NextResponse.json(result)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
