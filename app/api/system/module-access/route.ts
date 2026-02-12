import { NextResponse } from "next/server"
import { getActiveModulesForCurrentUser } from "@/app/actions/documents-system"

export async function GET() {
    const result = await getActiveModulesForCurrentUser()
    if (!result.success) {
        return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
}
