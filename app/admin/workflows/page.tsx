"use client";

import React, { useState } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { validateWorkflow } from "@/lib/workflow-validator";
import { WorkflowDefinition, WorkflowStep } from "@/types/workflow";
import { parseExcelWorkflow } from "@/lib/excel-parser";

export default function WorkflowPage() {
    const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [mermaidUrl, setMermaidUrl] = useState<string>("");

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.json')) {
            // Handle JSON
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const json = JSON.parse(text);
                    const validation = validateWorkflow(json);
                    handleValidationResult(json, validation);
                } catch (err) {
                    setErrors(["Invalid JSON file. Please check syntax."]);
                    setWorkflow(null);
                }
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            // Handle Excel
            const buffer = await file.arrayBuffer();
            const result = parseExcelWorkflow(buffer, file.name);

            if (result.workflow && result.errors.length === 0) {
                const validation = validateWorkflow(result.workflow);
                handleValidationResult(result.workflow, validation);
            } else {
                setErrors(result.errors);
                setWorkflow(null);
            }
        } else {
            setErrors(["Unsupported file format. Please upload .json or .xlsx"]);
        }
    };

    const handleValidationResult = (json: any, validation: any) => {
        if (!validation.isValid) {
            setErrors(validation.errors);
            setWorkflow(null);
            setMermaidUrl("");
        } else {
            setErrors([]);
            setWorkflow(json as WorkflowDefinition);
            generateDiagram(json as WorkflowDefinition);
        }
    };

    const generateDiagram = (data: WorkflowDefinition) => {
        // Convert JSON to Mermaid Syntax
        let graph = "graph TD\n";

        // Styling
        graph += "  classDef sales fill:#e0e7ff,stroke:#4338ca,stroke-width:2px;\n";
        graph += "  classDef inventory fill:#fff7ed,stroke:#ea580c,stroke-width:2px;\n";
        graph += "  classDef default fill:#f4f4f5,stroke:#71717a,stroke-width:2px;\n";

        data.steps.forEach((step) => {
            // Node Definition
            const label = `"${step.label}<br/>(${step.action})<br/>[${step.model}]"`;
            graph += `  ${step.id}[${label}]\n`;

            // Styling based on Model
            if (['SalesOrder', 'Quotation', 'Customer'].includes(step.model)) {
                graph += `  class ${step.id} sales;\n`;
            } else if (['StockLevel', 'StockMovement', 'Product'].includes(step.model)) {
                graph += `  class ${step.id} inventory;\n`;
            }

            // Edges (Flow)
            if (step.next) {
                step.next.forEach((nextId) => {
                    graph += `  ${step.id} --> ${nextId}\n`;
                });
            }

            // Edges (Conditions)
            if (step.conditions) {
                step.conditions.forEach((cond: any) => {
                    const condLabel = `|${cond.field} ${cond.operator} ${cond.value}|`;
                    graph += `  ${step.id} -- ${condLabel} --> ${cond.nextId}\n`;
                });
            }
        });

        // Encode to Base64 for Mermaid.ink
        const base64Graph = btoa(graph);
        setMermaidUrl(`https://mermaid.ink/img/${base64Graph}`);
    };

    return (
        <div className="mf-page">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Workflow Engine</h1>
                <p className="text-muted-foreground">
                    Import strict JSON definitions to generate system-compliant user flows.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Upload Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Import Workflow</CardTitle>
                        <CardDescription>Upload a .json file following the WDL schema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 border-muted-foreground/25">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-10 h-10 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-muted-foreground">JSON or Excel (.xlsx)</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".json,.xlsx"
                                    onChange={handleFileUpload}
                                />
                            </label>
                        </div>

                        {/* Error Display */}
                        {errors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Validation Failed</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-4 mt-2 space-y-1">
                                        {errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Success Display */}
                        {workflow && (
                            <Alert className="border-green-500 text-green-600 bg-green-50">
                                <CheckCircle2 className="h-4 w-4 stroke-green-600" />
                                <AlertTitle>Valid Workflow Detected</AlertTitle>
                                <AlertDescription>
                                    Loaded <strong>{workflow.workflowName}</strong> with {workflow.steps.length} steps.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Preview Section */}
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Workflow Visualization</CardTitle>
                        <CardDescription>Auto-generated from your JSON structure.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center min-h-[300px] bg-white/5 rounded-md border border-dashed m-6 mt-0">
                        {mermaidUrl ? (
                            <img src={mermaidUrl} alt="Workflow Diagram" className="max-w-full rounded-md shadow-sm" />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <FileJson className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Upload a valid file to verify the flow.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* JSON Preview (Optional Debug) */}
            {workflow && (
                <Card>
                    <CardHeader>
                        <CardTitle>Parsed Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 rounded-lg bg-black/80 text-xs text-green-400 overflow-auto max-h-[300px]">
                            {JSON.stringify(workflow, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
