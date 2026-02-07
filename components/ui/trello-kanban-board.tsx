"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Plus, GripVertical, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

// Types - exported for reusability
export interface KanbanTask {
    id: string
    title: string
    description?: string
    labels?: string[]
    assignee?: string
}

export interface KanbanColumn {
    id: string
    title: string
    tasks: KanbanTask[]
}

export interface KanbanBoardProps {
    columns: KanbanColumn[]
    onColumnsChange?: (columns: KanbanColumn[]) => void
    onTaskMove?: (taskId: string, fromColumnId: string, toColumnId: string) => void
    onTaskAdd?: (columnId: string, title: string) => void
    onTaskClick?: (task: KanbanTask) => void
    labelColors?: Record<string, string>
    columnColors?: Record<string, string>
    className?: string
    allowAddTask?: boolean
    variant?: "default" | "premium"
}

const defaultLabelColors: Record<string, string> = {
    research: "bg-pink-500",
    design: "bg-violet-500",
    frontend: "bg-blue-500",
    backend: "bg-emerald-500",
    devops: "bg-amber-500",
    docs: "bg-slate-500",
    urgent: "bg-red-500",
}

const defaultColumnColors: Record<string, string> = {
    backlog: "bg-slate-500",
    todo: "bg-blue-500",
    "in-progress": "bg-amber-500",
    review: "bg-violet-500",
    done: "bg-emerald-500",
}

export function KanbanBoard({
    columns: initialColumns,
    onColumnsChange,
    onTaskMove,
    onTaskAdd,
    onTaskClick,
    labelColors = defaultLabelColors,
    columnColors = defaultColumnColors,
    className,
    allowAddTask = true,
    variant = "premium", // Defaulting to premium as per request
}: KanbanBoardProps) {
    const [columns, setColumns] = React.useState<KanbanColumn[]>(initialColumns)
    const [draggedTask, setDraggedTask] = React.useState<{
        task: KanbanTask
        sourceColumnId: string
    } | null>(null)
    const [dropTarget, setDropTarget] = React.useState<string | null>(null)
    const [addingCardTo, setAddingCardTo] = React.useState<string | null>(null)
    const [newCardTitle, setNewCardTitle] = React.useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (addingCardTo && inputRef.current) {
            inputRef.current.focus()
        }
    }, [addingCardTo])

    // Update internal state if initialColumns changes
    React.useEffect(() => {
        if (JSON.stringify(initialColumns) !== JSON.stringify(columns)) {
            setColumns(initialColumns);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialColumns]);


    const handleDragStart = (task: KanbanTask, columnId: string) => {
        setDraggedTask({ task, sourceColumnId: columnId })
    }

    const handleDragOver = (e: React.DragEvent, columnId: string) => {
        e.preventDefault()
        setDropTarget(columnId)
    }

    const handleDrop = (targetColumnId: string) => {
        if (!draggedTask || draggedTask.sourceColumnId === targetColumnId) {
            setDraggedTask(null)
            setDropTarget(null)
            return
        }

        const newColumns = [...columns]
        const sourceCol = newColumns.find(c => c.id === draggedTask.sourceColumnId)
        const targetCol = newColumns.find(c => c.id === targetColumnId)

        if (sourceCol && targetCol) {
            sourceCol.tasks = sourceCol.tasks.filter(t => t.id !== draggedTask.task.id)
            targetCol.tasks.push(draggedTask.task)
            setColumns(newColumns)
            onColumnsChange?.(newColumns)
            onTaskMove?.(draggedTask.task.id, draggedTask.sourceColumnId, targetColumnId)
        }

        setDraggedTask(null)
        setDropTarget(null)
    }

    const handleAddCard = (columnId: string) => {
        if (!newCardTitle.trim()) {
            setAddingCardTo(null)
            return
        }

        const newColumns = [...columns]
        const col = newColumns.find(c => c.id === columnId)
        if (col) {
            col.tasks.push({
                id: Math.random().toString(36).substr(2, 9),
                title: newCardTitle,
            })
            setColumns(newColumns)
            onColumnsChange?.(newColumns)
            onTaskAdd?.(columnId, newCardTitle)
        }
        setAddingCardTo(null)
        setNewCardTitle("")
    }

    return (
        <div className={cn("flex h-full gap-6 pb-4 overflow-x-auto snap-x", className)}>
            {columns.map((column) => (
                <div
                    key={column.id}
                    className={cn(
                        "flex h-full min-w-[320px] w-[350px] flex-col rounded-3xl border transition-colors snap-center",
                        dropTarget === column.id ? "border-indigo-500/50 bg-indigo-500/5" : "border-zinc-200 bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-900/20"
                    )}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={() => handleDrop(column.id)}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800/50">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-3 w-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", columnColors[column.id] || "bg-zinc-500")} />
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 font-serif tracking-tight text-lg">{column.title}</h3>
                            <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                {column.tasks.length}
                            </span>
                        </div>
                        <MoreHorizontal className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                    </div>

                    {/* Tasks Container */}
                    <div className="flex-1 space-y-3 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        {column.tasks.map((task) => (
                            <div
                                key={task.id}
                                draggable
                                onDragStart={() => handleDragStart(task, column.id)}
                                onClick={() => onTaskClick?.(task)}
                                className={cn(
                                    "relative group cursor-pointer overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md active:scale-95",
                                    draggedTask?.task.id === task.id && "opacity-50 ring-2 ring-indigo-500 w-full"
                                )}
                            >
                                {/* Grain Overlay */}
                                <div
                                    className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
                                />

                                {/* Subtle Spotlight based on First Label - Now Monochrome/Subtle - Default Visible */}
                                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[50px] opacity-20 transition-opacity bg-zinc-400/20" />

                                <div className="relative z-10 flex flex-col gap-3">
                                    {/* Labels */}
                                    <div className="flex flex-wrap gap-2">
                                        {task.labels?.map((label) => (
                                            <span
                                                key={label}
                                                className={cn(
                                                    "px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-semibold text-white/90 shadow-sm",
                                                    labelColors[label] || "bg-zinc-700"
                                                )}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Title */}
                                    <h4 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 font-serif leading-snug">
                                        {task.title}
                                    </h4>

                                    {/* Footer Info */}
                                    {(task.description || task.assignee) && (
                                        <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
                                            {task.description && (
                                                <p className="line-clamp-1 max-w-[70%] text-zinc-500 dark:text-zinc-400">
                                                    {task.description}
                                                </p>
                                            )}

                                            {task.assignee && (
                                                <div className="ml-auto flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 px-2 py-1 border border-zinc-200 dark:border-zinc-800">
                                                    <div className="h-4 w-4 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 dark:text-indigo-300 rounded-full flex items-center justify-center text-[9px] font-bold">
                                                        {task.assignee.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{task.assignee}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {addingCardTo === column.id ? (
                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                                <input
                                    ref={inputRef}
                                    value={newCardTitle}
                                    onChange={(e) => setNewCardTitle(e.target.value)}
                                    placeholder="Enter card title..."
                                    className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-medium"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleAddCard(column.id)
                                        if (e.key === "Escape") setAddingCardTo(null)
                                    }}
                                />
                                <div className="mt-3 flex gap-2">
                                    <Button size="sm" onClick={() => handleAddCard(column.id)} className="h-7 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                                        Add
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setAddingCardTo(null)} className="h-7 text-xs">
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : allowAddTask && (
                            <button
                                onClick={() => setAddingCardTo(column.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900/50 hover:text-zinc-300 transition-all font-medium group"
                            >
                                <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" /> Add a card
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}





