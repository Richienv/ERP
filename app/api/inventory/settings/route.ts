import { NextResponse } from "next/server"
import { z } from "zod"
import { getNegativeStockPolicy, setNegativeStockPolicy } from "@/lib/inventory-settings"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/role-guard"

export const dynamic = "force-dynamic"

const SettingsUpdateSchema = z
  .object({
    allowNegativeStock: z.boolean().optional(),
  })
  .strict()

/**
 * GET /api/inventory/settings
 * Returns inventory-related system settings.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowNegativeStock = await getNegativeStockPolicy()
    return NextResponse.json({ allowNegativeStock })
  } catch (error) {
    console.error("[api/inventory/settings] GET error:", error)
    return NextResponse.json({ allowNegativeStock: false }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/settings
 * Update inventory-related system settings. Admin only.
 */
export async function PUT(request: Request) {
  try {
    try {
      await requireRole(["admin"])
    } catch (err) {
      return NextResponse.json(
        { error: "Akses ditolak: pengaturan inventori hanya dapat diubah oleh admin" },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Body permintaan tidak valid" }, { status: 400 })
    }

    const parsed = SettingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Data pengaturan tidak valid",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    if (typeof parsed.data.allowNegativeStock === "boolean") {
      await setNegativeStockPolicy(parsed.data.allowNegativeStock)
    }

    const allowNegativeStock = await getNegativeStockPolicy()
    return NextResponse.json({ allowNegativeStock })
  } catch (error) {
    console.error("[api/inventory/settings] PUT error:", error)
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan" },
      { status: 500 },
    )
  }
}
