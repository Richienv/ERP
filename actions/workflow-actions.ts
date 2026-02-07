"use server";

import { prisma } from "@/lib/prisma";
import { WorkflowStep } from "@/types/workflow";

export async function provisionRoles(steps: WorkflowStep[]) {
    try {
        // 1. Group Steps by Role
        const roleMap = new Map<string, Set<string>>();

        steps.forEach(step => {
            if (step.role && step.role !== "System" && step.role !== "IoT System" && step.role !== "AI Assistant") {
                if (!roleMap.has(step.role)) {
                    roleMap.set(step.role, new Set());
                }
                const permissions = roleMap.get(step.role);
                if (step.moduleKey) {
                    permissions?.add(step.moduleKey);
                }
            }
        });

        // 2. Upsert Roles to Database
        const results = [];
        for (const [roleName, permissions] of roleMap.entries()) {
            // Generate a code (e.g., "Production Manager" -> "PRODUCTION_MANAGER")
            const code = roleName.toUpperCase().replace(/[^A-Z0-9]/g, "_");

            const role = await prisma.systemRole.upsert({
                where: { code },
                update: {
                    permissions: Array.from(permissions),
                    updatedAt: new Date()
                },
                create: {
                    code,
                    name: roleName,
                    description: `Auto-provisioned from Workflow Import`,
                    permissions: Array.from(permissions),
                    isSystem: false
                }
            });
            results.push(role);
        }

        return { success: true, count: results.length };

    } catch (error: any) {
        console.error("Failed to provision roles:", error);
        return { success: false, error: error.message };
    }
}
