"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, AlertTriangle, Play, Pause, Square } from "lucide-react"

export type TaskStatus = "pending" | "running" | "completed" | "issue"

export interface StaffTask {
    id: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
    status: TaskStatus
    time: string
    location?: string
    type: "production" | "quality" | "maintenance" | "warehouse"
}

interface TaskCardProps {
    task: StaffTask
    onStart: (id: string) => void
    onComplete: (id: string) => void
    onReport: (id: string) => void
}

export function TaskCard({ task, onStart, onComplete, onReport }: TaskCardProps) {
    const getStatusColor = (status: TaskStatus) => {
        switch (status) {
            case "running": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
            case "completed": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
            case "issue": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
            default: return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
        }
    }

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "high": return <Badge variant="destructive" className="h-5 text-[10px]">High</Badge>
            case "medium": return <Badge variant="secondary" className="h-5 text-[10px] bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300">Medium</Badge>
            default: return null
        }
    }

    return (
        <Card className={`border shadow-sm transition-all hover:shadow-md ${task.status === 'running' ? 'border-l-4 border-l-blue-500' : ''}`}>
            <CardHeader className="p-4 pb-2 space-y-2">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`h-5 text-[10px] uppercase ${getStatusColor(task.status)}`}>
                            {task.status}
                        </Badge>
                        {getPriorityBadge(task.priority)}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{task.time}</span>
                </div>
                <CardTitle className="text-sm font-semibold leading-tight">{task.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 py-2">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {task.description}
                </p>
                {task.location && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        {task.location}
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-4 pt-2 flex gap-2">
                {task.status === "pending" && (
                    <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 h-8 text-xs" onClick={() => onStart(task.id)}>
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                        Mulai
                    </Button>
                )}

                {task.status === "running" && (
                    <div className="flex gap-2 w-full">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20" onClick={() => onReport(task.id)}>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Lapor
                        </Button>
                        <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onComplete(task.id)}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            Selesai
                        </Button>
                    </div>
                )}

                {task.status === "completed" && (
                    <Button size="sm" variant="ghost" className="w-full h-8 text-xs text-green-600 cursor-default hover:bg-transparent">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Terkirim
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
