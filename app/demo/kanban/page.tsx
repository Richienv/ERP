"use client"

import { KanbanBoard, KanbanColumn } from "@/components/ui/trello-kanban-board";

const simpleColumns: KanbanColumn[] = [
    {
        id: "todo",
        title: "To Do",
        tasks: [
            { id: "1", title: "Review Stock Levels", description: "Check electronics category for low stock items.", labels: ["urgent"] },
            { id: "2", title: "Order New Materials", description: "Cotton fabric rolls needed for production.", labels: ["procurement"] },
            { id: "3", title: "Audit Warehouse A", labels: ["operations"] },
        ],
    },
    {
        id: "in-progress",
        title: "In Progress",
        tasks: [
            { id: "4", title: "Q1 Financial Report", assignee: "RJ" },
            { id: "5", title: "Supplier Negotiation", description: "Meeting with fabric supplier regarding price increase.", labels: ["meeting"] },
        ],
    },
    {
        id: "done",
        title: "Done",
        tasks: [
            { id: "6", title: "Payroll January", assignee: "HR" },
            { id: "7", title: "System Maintenance", labels: ["tech"] },
        ],
    },
]

export default function DemoKanban() {
    return (
        <div className="bg-black min-h-screen p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-10">
                    <h1 className="mb-2 text-3xl font-bold text-white font-serif">Task Board</h1>
                    <p className="text-zinc-400">Manage ERP tasks and workflows.</p>
                </div>
                <div className="h-[600px]">
                    <KanbanBoard
                        columns={simpleColumns}
                        columnColors={{
                            todo: "bg-indigo-500",
                            "in-progress": "bg-amber-500",
                            done: "bg-emerald-500",
                        }}
                        labelColors={{
                            urgent: "bg-rose-500",
                            procurement: "bg-blue-500",
                            operations: "bg-slate-500",
                            meeting: "bg-purple-500",
                            tech: "bg-cyan-500"
                        }}
                        allowAddTask={true}
                    />
                </div>
            </div>
        </div>
    )
}
