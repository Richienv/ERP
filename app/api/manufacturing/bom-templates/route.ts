import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const BUILT_IN_TEMPLATES = [
    { name: "Garmen Lengkap", description: "Potong → Jahit → QC → Packing", stepsJson: ["CUTTING", "SEWING", "QC", "PACKING"], isBuiltIn: true },
    { name: "CMT", description: "Cut, Make, Trim standar", stepsJson: ["CUTTING", "SEWING", "FINISHING"], isBuiltIn: true },
    { name: "Sablon + Jahit", description: "Printing → Jahit → QC → Packing", stepsJson: ["PRINTING", "SEWING", "QC", "PACKING"], isBuiltIn: true },
]

async function ensureBuiltIns(userId: string) {
    for (const t of BUILT_IN_TEMPLATES) {
        const existing = await prisma.bOMTemplate.findFirst({ where: { name: t.name, isBuiltIn: true } })
        if (!existing) {
            await prisma.bOMTemplate.create({ data: { ...t, stepsJson: t.stepsJson, createdBy: userId } })
        }
    }
}

// GET /api/manufacturing/bom-templates
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await ensureBuiltIns(user.id)

        const templates = await prisma.bOMTemplate.findMany({ orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'asc' }] })
        return NextResponse.json({ templates })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// POST /api/manufacturing/bom-templates — create user template
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { name, description, stepsJson } = body as { name: string; description?: string; stepsJson: string[] }

        if (!name || !stepsJson?.length) {
            return NextResponse.json({ error: 'name and stepsJson required' }, { status: 400 })
        }

        const template = await prisma.bOMTemplate.create({
            data: { name, description, stepsJson, isBuiltIn: false, createdBy: user.id },
        })
        return NextResponse.json({ template })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
