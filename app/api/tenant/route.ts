import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

/**
 * Public endpoint — returns tenant branding info (no auth required).
 * Used by login page to display tenant name/logo.
 */
export async function GET() {
    const tenantSlug = process.env.TENANT_SLUG
    if (!tenantSlug) {
        return NextResponse.json({
            tenantName: null,
            tenantSlug: null,
            logoUrl: null,
            primaryColor: null,
        })
    }

    try {
        const prisma = new PrismaClient()
        try {
            const tenant = await (prisma as any).tenantConfig.findUnique({
                where: { tenantSlug },
                select: {
                    tenantSlug: true,
                    tenantName: true,
                    logoUrl: true,
                    primaryColor: true,
                },
            })
            return NextResponse.json(tenant || {
                tenantName: tenantSlug,
                tenantSlug,
                logoUrl: null,
                primaryColor: null,
            })
        } finally {
            await prisma.$disconnect()
        }
    } catch {
        return NextResponse.json({
            tenantName: tenantSlug,
            tenantSlug,
            logoUrl: null,
            primaryColor: null,
        })
    }
}
