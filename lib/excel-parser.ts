import * as XLSX from 'xlsx';
import { WorkflowDefinition, WorkflowStep, WorkflowModel, WorkflowAction } from '@/types/workflow';
import MODULES_CONFIG from '@/config/modules.json';

// Type describing the Row in Excel
interface ExcelRow {
    Step_Order: number;
    Role: string;
    Action_Verb: string;
    Object: string;
    Condition?: string;
    Data_Input?: string;
    Mapped_Module_Key: string;
}

const MODULES = MODULES_CONFIG as Record<string, { name: string; model: string; action: string }>;

export function parseExcelWorkflow(fileBuffer: ArrayBuffer, fileName: string): { workflow: WorkflowDefinition | null; errors: string[] } {
    const errors: string[] = [];
    try {
        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with raw headers
        const rawRows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

        if (rawRows.length === 0) {
            return { workflow: null, errors: ["Excel file is empty"] };
        }

        const steps: WorkflowStep[] = [];

        // Map Rows to Steps
        rawRows.forEach((row, index) => {
            const rowIndex = index + 2; // Excel row number (1-indexed + header)

            // Check Required Fields
            if (!row.Step_Order) errors.push(`Row ${rowIndex}: Missing 'Step_Order'`);
            if (!row.Mapped_Module_Key) errors.push(`Row ${rowIndex}: Missing 'Mapped_Module_Key'`);

            // Validate Module Key (Trim to ensure reliability)
            const cleanKey = row.Mapped_Module_Key ? row.Mapped_Module_Key.toString().trim() : "";
            const existingModule = MODULES[cleanKey];

            let moduleDef = existingModule;
            const isModuleKeyValid = !!existingModule;

            if (!existingModule) {
                // GAP LOGIC: Create a temporary module definition for the gap
                moduleDef = {
                    name: `${row.Action_Verb} ${row.Object}`, // Clean name, UI handles "Unavailable" label
                    model: row.Object as any, // Cast to any to bypass strict enum check for Gaps
                    action: row.Action_Verb as any, // Fallback to provided Action
                };
            }

            const stepId = `step_${index + 1}`; // New step ID generation based on index
            const nextStepId = index < rawRows.length - 1 ? `step_${index + 2}` : undefined; // New next step ID generation

            const step: WorkflowStep = {
                id: stepId,
                label: moduleDef ? moduleDef.name : "Unknown", // Safe access
                model: moduleDef.model as WorkflowModel, // Cast back
                action: moduleDef.action as WorkflowAction, // Cast back
                role: row.Role,
                moduleKey: cleanKey, // Use the clean key
                condition: row.Condition,
                dataInput: row.Data_Input ? row.Data_Input.split(',').map(s => s.trim()) : [],
                description: `${row.Role} performs ${moduleDef.action} on ${moduleDef.model}`,
                next: nextStepId ? [nextStepId] : [],
                isGap: !isModuleKeyValid // True if not in dictionary
            };

            steps.push(step);
        });

        if (errors.length > 0) {
            return { workflow: null, errors };
        }

        return {
            workflow: {
                workflowName: fileName.replace(/\.[^/.]+$/, ""), // remove extension
                description: "Imported from Excel",
                version: "1.0",
                steps: steps
            },
            errors: []
        };

    } catch (e: any) {
        return { workflow: null, errors: [`Failed to parse Excel: ${e.message}`] };
    }
}
