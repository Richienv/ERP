'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface OnboardingTask {
    key: string
    title: string
    description: string
    department: string
}

export interface OnboardingTemplateSummary {
    id: string
    name: string
    taskCount: number
    createdAt: string
}

export interface EmployeeOnboardingStatus {
    employeeId: string
    employeeName: string
    templateId: string
    templateName: string
    tasks: {
        key: string
        title: string
        description: string
        department: string
        completed: boolean
        completedAt: string | null
    }[]
    completedCount: number
    totalCount: number
    progressPct: number
}

// ==============================================================================
// Template Management
// ==============================================================================

/**
 * Get all onboarding templates (read-only — use singleton prisma).
 */
export async function getOnboardingTemplates(): Promise<OnboardingTemplateSummary[]> {
    try {
        await requireAuth()

        const templates = await prisma.onboardingTemplate.findMany({
            orderBy: { createdAt: 'desc' },
        })

        return templates.map((t) => {
            const tasks = (t.tasks as unknown as OnboardingTask[]) || []
            return {
                id: t.id,
                name: t.name,
                taskCount: tasks.length,
                createdAt: t.createdAt.toISOString(),
            }
        })
    } catch (error) {
        console.error("[getOnboardingTemplates] Error:", error)
        return []
    }
}

/**
 * Create a new onboarding template.
 */
export async function createOnboardingTemplate(data: {
    name: string
    tasks: OnboardingTask[]
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
    if (!data.name.trim()) {
        return { success: false, error: 'Nama template wajib diisi' }
    }
    if (data.tasks.length === 0) {
        return { success: false, error: 'Minimal 1 tugas diperlukan' }
    }

    try {
        const templateId = await withPrismaAuth(async (prisma: PrismaClient) => {
            const template = await prisma.onboardingTemplate.create({
                data: {
                    name: data.name.trim(),
                    tasks: data.tasks as unknown as object,
                },
            })
            return template.id
        })

        revalidatePath('/hcm/onboarding')
        return { success: true, templateId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat template'
        console.error("[createOnboardingTemplate] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Employee Onboarding
// ==============================================================================

/**
 * Start onboarding for an employee using a template.
 * Creates OnboardingProgress records for each task.
 */
export async function startOnboarding(
    employeeId: string,
    templateId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const template = await prisma.onboardingTemplate.findUniqueOrThrow({
                where: { id: templateId },
            })

            const tasks = (template.tasks as unknown as OnboardingTask[]) || []

            // Create progress records (upsert to avoid duplicates)
            for (const task of tasks) {
                await prisma.onboardingProgress.upsert({
                    where: {
                        employeeId_templateId_taskKey: {
                            employeeId,
                            templateId,
                            taskKey: task.key,
                        },
                    },
                    create: {
                        employeeId,
                        templateId,
                        taskKey: task.key,
                        completed: false,
                    },
                    update: {}, // Don't overwrite if exists
                })
            }
        })

        revalidatePath('/hcm/onboarding')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memulai onboarding'
        console.error("[startOnboarding] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get onboarding status for an employee (read-only — use singleton prisma).
 */
export async function getEmployeeOnboarding(
    employeeId: string
): Promise<EmployeeOnboardingStatus[]> {
    try {
        await requireAuth()

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                firstName: true,
                lastName: true,
            },
        })

        if (!employee) return []

        const progress = await prisma.onboardingProgress.findMany({
            where: { employeeId },
            include: {
                template: true,
            },
            orderBy: { taskKey: 'asc' },
        })

        // Group by template
        const templateMap = new Map<string, {
            templateId: string
            templateName: string
            tasks: OnboardingTask[]
            progressMap: Map<string, { completed: boolean; completedAt: Date | null }>
        }>()

        for (const p of progress) {
            if (!templateMap.has(p.templateId)) {
                templateMap.set(p.templateId, {
                    templateId: p.templateId,
                    templateName: p.template.name,
                    tasks: (p.template.tasks as unknown as OnboardingTask[]) || [],
                    progressMap: new Map(),
                })
            }
            templateMap.get(p.templateId)!.progressMap.set(p.taskKey, {
                completed: p.completed,
                completedAt: p.completedAt,
            })
        }

        const empName = [employee.firstName, employee.lastName].filter(Boolean).join(' ')

        return Array.from(templateMap.values()).map((t) => {
            const tasks = t.tasks.map((task) => {
                const prog = t.progressMap.get(task.key)
                return {
                    ...task,
                    completed: prog?.completed ?? false,
                    completedAt: prog?.completedAt?.toISOString() || null,
                }
            })

            const completedCount = tasks.filter((t) => t.completed).length
            const totalCount = tasks.length

            return {
                employeeId,
                employeeName: empName,
                templateId: t.templateId,
                templateName: t.templateName,
                tasks,
                completedCount,
                totalCount,
                progressPct: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
            }
        })
    } catch (error) {
        console.error("[getEmployeeOnboarding] Error:", error)
        return []
    }
}

/**
 * Toggle a task completion status.
 */
export async function toggleOnboardingTask(
    employeeId: string,
    templateId: string,
    taskKey: string,
    completed: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.onboardingProgress.update({
                where: {
                    employeeId_templateId_taskKey: {
                        employeeId,
                        templateId,
                        taskKey,
                    },
                },
                data: {
                    completed,
                    completedAt: completed ? new Date() : null,
                },
            })
        })

        revalidatePath('/hcm/onboarding')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah status tugas'
        console.error("[toggleOnboardingTask] Error:", error)
        return { success: false, error: msg }
    }
}
