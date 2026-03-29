import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { MODULE_PERMISSIONS } from "@/lib/settings-helpers"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const roles = await prisma.systemRole.findMany({
            orderBy: { code: "asc" },
        })

        if (roles.length === 0) {
            return NextResponse.json({
                success: true,
                data: [
                    { roleCode: "ROLE_ADMIN", roleName: "Administrator", permissions: MODULE_PERMISSIONS.map((m) => m.key), isSystem: true },
                    { roleCode: "ROLE_MANAGER", roleName: "Manajer", permissions: ["DASHBOARD", "INVENTORY", "SALES", "PROCUREMENT", "MANUFACTURING", "QUALITY", "HCM"], isSystem: true },
                    { roleCode: "ROLE_ACCOUNTANT", roleName: "Akuntan", permissions: ["DASHBOARD", "FINANCE", "INVOICES", "JOURNAL"], isSystem: true },
                    { roleCode: "ROLE_STAFF", roleName: "Staf", permissions: ["DASHBOARD", "INVENTORY", "SALES"], isSystem: false },
                    { roleCode: "ROLE_PURCHASING", roleName: "Purchasing", permissions: ["DASHBOARD", "PROCUREMENT", "INVENTORY"], isSystem: false },
                    { roleCode: "ROLE_WAREHOUSE", roleName: "Gudang", permissions: ["DASHBOARD", "INVENTORY"], isSystem: false },
                    { roleCode: "ROLE_SALES", roleName: "Sales", permissions: ["DASHBOARD", "SALES"], isSystem: false },
                    { roleCode: "ROLE_VIEWER", roleName: "Viewer", permissions: ["DASHBOARD"], isSystem: false },
                ],
            })
        }

        return NextResponse.json({
            success: true,
            data: roles.map((r) => ({
                roleCode: r.code,
                roleName: r.name,
                permissions: r.permissions,
                isSystem: r.isSystem,
            })),
        })
    } catch (e) {
        console.error("[API] permissions-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
