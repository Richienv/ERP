"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipboardCheck, Check, Clock } from "lucide-react"
import { toast } from "sonner"
import type { EmployeeOnboardingStatus } from "@/lib/actions/hcm-onboarding"

interface OnboardingChecklistProps {
    data: EmployeeOnboardingStatus
    onToggleTask: (
        employeeId: string,
        templateId: string,
        taskKey: string,
        completed: boolean
    ) => Promise<{ success: boolean; error?: string }>
}

export function OnboardingChecklist({ data, onToggleTask }: OnboardingChecklistProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const handleToggle = async (taskKey: string, currentlyCompleted: boolean) => {
        setLoading(taskKey)
        const result = await onToggleTask(
            data.employeeId,
            data.templateId,
            taskKey,
            !currentlyCompleted
        )
        setLoading(null)

        if (result.success) {
            toast.success(!currentlyCompleted ? "Tugas selesai!" : "Tugas dibuka kembali")
        } else {
            toast.error(result.error || "Gagal mengubah status")
        }
    }

    const progressColor =
        data.progressPct >= 100
            ? 'bg-emerald-500'
            : data.progressPct >= 50
            ? 'bg-blue-500'
            : 'bg-amber-500'

    // Group tasks by department
    const departments = [...new Set(data.tasks.map((t) => t.department))].sort()

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {data.templateName}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400">{data.employeeName}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 border-2 border-black ${
                        data.progressPct >= 100
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-600'
                    }`}>
                        {data.progressPct}%
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="px-4 py-2 border-b border-zinc-200">
                <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                    <span className="text-zinc-400 uppercase tracking-widest">Progress</span>
                    <span>{data.completedCount} / {data.totalCount}</span>
                </div>
                <div className="h-2 bg-zinc-100 border border-zinc-200 overflow-hidden">
                    <div
                        className={`h-full ${progressColor} transition-all`}
                        style={{ width: `${data.progressPct}%` }}
                    />
                </div>
            </div>

            {/* Tasks by department */}
            <div className="divide-y divide-zinc-100">
                {departments.map((dept) => (
                    <div key={dept}>
                        <div className="px-4 py-1.5 bg-zinc-50 border-b border-zinc-200">
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                                {dept}
                            </span>
                        </div>
                        {data.tasks
                            .filter((t) => t.department === dept)
                            .map((task) => (
                                <div
                                    key={task.key}
                                    className={`px-4 py-2.5 flex items-start gap-3 ${
                                        task.completed ? 'bg-emerald-50/50' : ''
                                    }`}
                                >
                                    <Checkbox
                                        checked={task.completed}
                                        disabled={loading === task.key}
                                        onCheckedChange={() => handleToggle(task.key, task.completed)}
                                        className="mt-0.5 border-2 border-black rounded-none"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold ${task.completed ? 'line-through text-zinc-400' : ''}`}>
                                            {task.title}
                                        </div>
                                        <div className="text-[10px] text-zinc-400">{task.description}</div>
                                        {task.completedAt && (
                                            <div className="flex items-center gap-1 mt-0.5 text-[9px] text-emerald-600 font-bold">
                                                <Check className="h-2.5 w-2.5" />
                                                Selesai {new Date(task.completedAt).toLocaleDateString('id-ID')}
                                            </div>
                                        )}
                                    </div>
                                    {!task.completed && (
                                        <Clock className="h-3.5 w-3.5 text-zinc-300 shrink-0 mt-0.5" />
                                    )}
                                </div>
                            ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
