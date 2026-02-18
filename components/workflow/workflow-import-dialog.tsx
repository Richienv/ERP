"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseExcelWorkflow } from "@/lib/excel-parser";
import { validateWorkflow } from "@/lib/workflow-validator";
import { WorkflowDefinition } from "@/types/workflow";
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context";
import { provisionRoles } from "@/actions/workflow-actions";
import { useQueryClient } from "@tanstack/react-query";

interface WorkflowImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorkflowImportDialog({ open, onOpenChange }: WorkflowImportDialogProps) {
    const { setActiveModules } = useWorkflowConfig();
    const queryClient = useQueryClient();
    const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [mermaidUrl, setMermaidUrl] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const resetState = () => {
        setWorkflow(null);
        setErrors([]);
        setMermaidUrl("");
        setIsProcessing(false);
    };

    const processFile = async (file: File) => {
        resetState();
        setIsProcessing(true);

        // Small delay to allow UI to render loading state
        await new Promise(resolve => setTimeout(resolve, 500));

        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target?.result as string);
                    const validation = validateWorkflow(json);
                    handleValidationResult(json, validation);
                } catch (err) {
                    setErrors(["File JSON tidak valid"]);
                } finally {
                    // Extended delay for smooth UX
                    setTimeout(() => setIsProcessing(false), 1500);
                }
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            try {
                const buffer = await file.arrayBuffer();
                const result = parseExcelWorkflow(buffer, file.name);
                if (result.errors.length > 0) {
                    setErrors(result.errors);
                } else if (result.workflow) {
                    const validation = validateWorkflow(result.workflow);
                    handleValidationResult(result.workflow, validation);
                }
            } catch (err: any) {
                console.error("Import Error:", err);
                setErrors([`Gagal memproses file: ${err.message || "Kesalahan tidak diketahui"}`]);
            } finally {
                // Extended delay for smooth UX
                setTimeout(() => setIsProcessing(false), 1500);
            }
        } else {
            setErrors(["Tipe file tidak didukung. Gunakan .json atau .xlsx"]);
            setIsProcessing(false);
        }
    };

    const handleValidationResult = (json: WorkflowDefinition, validation: { isValid: boolean, errors: string[] }) => {
        if (!validation.isValid) {
            setErrors(validation.errors);
        } else {
            setWorkflow(json);
            generateDiagram(json);
        }
    };

    // ... (previous code)

    const generateDiagram = (data: WorkflowDefinition) => {
        let graph = "graph TD\n";
        graph += "  classDef sales fill:#e0e7ff,stroke:#4338ca,stroke-width:2px;\n";
        graph += "  classDef inventory fill:#fff7ed,stroke:#ea580c,stroke-width:2px;\n";
        graph += "  classDef gap fill:#fee2e2,stroke:#ef4444,stroke-width:2px,stroke-dasharray: 5 5;\n"; // Gap Style

        // Smooth Edges
        graph += "  linkStyle default interpolate basis;\n";

        // Group steps by Role for Swimlanes
        const roleGroups: Record<string, typeof data.steps> = {};
        data.steps.forEach(step => {
            const role = step.role || "Unassigned";
            if (!roleGroups[role]) roleGroups[role] = [];
            roleGroups[role].push(step);
        });

        // Render Subgraphs
        Object.entries(roleGroups).forEach(([role, steps]) => {
            graph += `  subgraph "${role}"\n`;
            steps.forEach(step => {
                let label = `"${step.label}<br/>(${step.action})"`;

                // Add Data Inputs to Label if present
                if (step.dataInput && step.dataInput.length > 0) {
                    label = `"${step.label}<br/><b>Input:</b> ${step.dataInput.join(', ')}"`;
                }

                // Gap Label Override
                if (step.isGap) {
                    label = `"${step.label}<br/>(Fitur Belum Tersedia)"`;
                }

                graph += `    ${step.id}[${label}]\n`;

                // Styling
                if (step.isGap) {
                    graph += `    class ${step.id} gap;\n`;
                } else if (['SalesOrder', 'Quotation'].includes(step.model)) {
                    graph += `    class ${step.id} sales;\n`;
                } else if (['StockLevel', 'StockMovement'].includes(step.model)) {
                    graph += `    class ${step.id} inventory;\n`;
                }
            });
            graph += `  end\n`;
        });

        // Render Edges
        data.steps.forEach((step) => {
            if (step.next) {
                step.next.forEach((nextId) => {
                    graph += `  ${step.id} --> ${nextId}\n`;
                });
            }
        });

        // Check for GAP steps
        // Fix for Unicode (Emojis lead to btoa error)
        const base64Graph = btoa(unescape(encodeURIComponent(graph)));
        setMermaidUrl(`https://mermaid.ink/img/${base64Graph}`);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetState();
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle>Impor Blueprint Alur Kerja</DialogTitle>
                    <DialogDescription>Tarik dan lepas file Process Logic Sheet (.xlsx) atau JSON Anda di sini.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 min-h-[300px] relative">
                    {/* Loading Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl border border-indigo-100">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                            <p className="text-indigo-600 font-medium animate-pulse">Memproses Blueprint...</p>
                            <p className="text-xs text-zinc-500 mt-1">Menganalisis Alur & Gaps...</p>
                        </div>
                    )}

                    {/* Dropzone */}
                    {!workflow && !isProcessing && (
                        <div
                            className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-colors
                    ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-zinc-50'}
                    ${errors.length > 0 ? 'border-red-300 bg-red-50' : ''}
                `}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <Upload className={`w-12 h-12 mb-4 ${isDragging ? 'text-indigo-500' : 'text-zinc-400'}`} />
                            <p className="text-zinc-600 font-medium">Tarik & Lepas file Anda di sini</p>
                            <p className="text-xs text-zinc-400 mt-1">Mendukung file .xlsx dan .json yang valid</p>

                            {/* Manual Select */}
                            <input
                                type="file"
                                className="hidden"
                                id="file-upload"
                                accept=".json,.xlsx"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) processFile(file);
                                }}
                            />
                            <Button variant="outline" size="sm" className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                                Pilih File
                            </Button>
                        </div>
                    )}

                    {/* Errors */}
                    {errors.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Gagal Validasi</AlertTitle>
                            <AlertDescription className="text-xs">
                                {errors.map((e, i) => <div key={i}>{e}</div>)}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Preview */}
                    {workflow && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-semibold">{workflow.workflowName}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetState} className="hover:bg-green-100 text-green-800">
                                    <X className="w-4 h-4 mr-2" /> Hapus
                                </Button>
                            </div>

                            <div className="border rounded-lg p-4 bg-white/50 w-full flex justify-center">
                                {mermaidUrl && (
                                    <img src={mermaidUrl} alt="Workflow Diagram" className="max-w-full rounded shadow-sm" />
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={resetState}>Batal</Button>
                                <Button
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    disabled={isProcessing}
                                    onClick={async () => {
                                        if (workflow) {
                                            setIsProcessing(true);
                                            try {
                                                // 1. Provision Roles in Database
                                                await provisionRoles(workflow.steps);

                                                // 2. Extract unique keys for Local Config
                                                const keys = new Set<string>();
                                                workflow.steps.forEach(s => {
                                                    if (s.moduleKey) keys.add(s.moduleKey);
                                                });

                                                // 3. Update Global Context to configured modules
                                                setActiveModules(Array.from(keys));

                                                // 4. Close Dialog & Refresh
                                                onOpenChange(false);
                                                queryClient.invalidateQueries();

                                            } catch (err) {
                                                console.error("Provisioning failed", err);
                                                // Continue anyway to allow frontend config
                                                onOpenChange(false);
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        }
                                    }}
                                >
                                    {isProcessing ? "Menyimpan..." : "Terapkan & Konfigurasi ERP"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
