import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface OnboardingTask {
    key: string
    title: string
    description: string
    department: string
}

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const rawTemplates = await prisma.onboardingTemplate.findMany({
            orderBy: { createdAt: "desc" },
        })

        const templates = rawTemplates.map((t) => {
            const tasks = (t.tasks as unknown as OnboardingTask[]) || []
            return {
                id: t.id,
                name: t.name,
                taskCount: tasks.length,
                createdAt: t.createdAt.toISOString(),
            }
        })

        return NextResponse.json({ templates })
    } catch (e) {
        console.error("[API] onboarding-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
