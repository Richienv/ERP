import { WorkflowDefinition, WorkflowValidationResult, WorkflowModel, WorkflowAction } from "@/types/workflow";

import MODULES_CONFIG from '@/config/modules.json';

const MODULES = MODULES_CONFIG as Record<string, { model: string; action: string }>;
const VALID_MODELS = new Set(Object.values(MODULES).map(m => m.model));
const VALID_ACTIONS = new Set(Object.values(MODULES).map(m => m.action));

export function validateWorkflow(json: any): WorkflowValidationResult {
    const errors: string[] = [];

    // 1. Structure Check
    if (!json || typeof json !== 'object') {
        return { isValid: false, errors: ['Invalid JSON format'] };
    }
    if (!json.workflowName) errors.push('Missing "workflowName"');
    if (!json.steps || !Array.isArray(json.steps)) {
        errors.push('Missing "steps" array');
        return { isValid: false, errors };
    }

    const stepIds = new Set<string>();
    const steps = json.steps as any[];

    // 2. Collect IDs first for integrity check
    steps.forEach((step, index) => {
        if (!step.id) {
            errors.push(`Step at index ${index} is missing "id"`);
        } else {
            if (stepIds.has(step.id)) {
                errors.push(`Duplicate Step ID found: "${step.id}"`);
            }
            stepIds.add(step.id);
        }
    });

    // 3. Deep Validation of Steps
    steps.forEach((step, index) => {
        const stepRef = `Step ${step.id || index}`;

        // GAP LOGIC: Skip strict validation for Ghost Nodes
        if (step.isGap) {
            // Only check basic required fields for Gaps
            if (!step.label) errors.push(`${stepRef}: Missing "label"`);
        } else {
            // Module Key Validation (if present)
            if (step.moduleKey) {
                if (!MODULES[step.moduleKey]) {
                    errors.push(`${stepRef}: Invalid Module Key "${step.moduleKey}"`);
                } else {
                    // Verify Consistency
                    const def = MODULES[step.moduleKey];
                    if (def.model !== step.model) errors.push(`${stepRef}: Model mismatch for key ${step.moduleKey}. Expected ${def.model}, got ${step.model}`);
                    if (def.action !== step.action) errors.push(`${stepRef}: Action mismatch for key ${step.moduleKey}. Expected ${def.action}, got ${step.action}`);
                }
            }

            // Model Validation
            if (!step.model) {
                errors.push(`${stepRef}: Missing "model"`);
            } else if (!VALID_MODELS.has(step.model)) {
                errors.push(`${stepRef}: Invalid Model "${step.model}". Must be one of: ${Array.from(VALID_MODELS).join(', ')}`);
            }

            // Action Validation
            if (!step.action) {
                errors.push(`${stepRef}: Missing "action"`);
            } else if (!VALID_ACTIONS.has(step.action)) {
                errors.push(`${stepRef}: Invalid Action "${step.action}". Must be one of: ${Array.from(VALID_ACTIONS).join(', ')}`);
            }
        }

        // Next Step Integrity
        if (step.next && Array.isArray(step.next)) {
            step.next.forEach((nextId: string) => {
                if (!stepIds.has(nextId)) {
                    errors.push(`${stepRef}: Points to non-existent next step ID "${nextId}"`);
                }
            });
        }

        // Condition Integrity
        if (step.conditions && Array.isArray(step.conditions)) {
            step.conditions.forEach((cond: any) => {
                if (cond.nextId && !stepIds.has(cond.nextId)) {
                    errors.push(`${stepRef} (Condition): Points to non-existent next step ID "${cond.nextId}"`);
                }
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}
