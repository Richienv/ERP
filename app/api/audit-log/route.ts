import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get("entityType")
  const entityId = searchParams.get("entityId")

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 })
  }

  const data = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ data })
}
