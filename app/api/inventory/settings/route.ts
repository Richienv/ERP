import { NextResponse } from "next/server"
import { getNegativeStockPolicy, setNegativeStockPolicy } from "@/lib/inventory-settings"

export const dynamic = "force-dynamic"

/**
 * GET /api/inventory/settings
 * Returns inventory-related system settings.
 */
export async function GET() {
  try {
    const allowNegativeStock = await getNegativeStockPolicy()
    return NextResponse.json({ allowNegativeStock })
  } catch (error) {
    console.error("[api/inventory/settings] GET error:", error)
    return NextResponse.json({ allowNegativeStock: false }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/settings
 * Update inventory-related system settings.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (typeof body.allowNegativeStock === "boolean") {
      await setNegativeStockPolicy(body.allowNegativeStock)
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
