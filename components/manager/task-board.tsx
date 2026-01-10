"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Plus, Phone, MessageSquare, AlertCircle, Calendar, User, CheckCircle2, XCircle, Filter, Search } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"

export function ManagerTaskBoard() {
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<any>(null)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black font-serif tracking-tight flex items-center gap-2">
                    📋 Task Management Center
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsFilterOpen(true)} className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">
                        <Filter className="h-4 w-4 mr-2" /> Filter: My Tasks
                    </Button>
                    <Button size="sm" onClick={() => setIsNewTaskOpen(true)} className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                        <Plus className="h-4 w-4 mr-1" /> New Task
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[600px] overflow-x-auto pb-4">
                {/* Column 1: TO DO */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>TO DO (18)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>

                    {/* Task Card: Critical */}
                    <TaskCard
                        id="TASK-2456"
                        title="Order polyester yarn ASAP"
                        desc="Production stopped on Line 2 if not arrived by Monday."
                        priority="URGENT 🔥"
                        variant="destructive"
                        tags={[{ icon: AlertCircle, text: "Blocker: Waiting supplier quote" }]}
                        assignee="PA"
                        due="Due: 5 PM"
                        onClick={() => setSelectedTask({ id: "TASK-2456", title: "Order polyester yarn ASAP", status: "TODO" })}
                    />

                    {/* Task Card: Normal */}
                    <TaskCard
                        id="TASK-2458"
                        title="Schedule Line 3 maintenance"
                        desc=""
                        priority="MAINTENANCE"
                        variant="secondary"
                        assignee="PJ"
                        due="Tomorrow"
                        onClick={() => setSelectedTask({ id: "TASK-2458", title: "Schedule Line 3 maintenance", status: "TODO" })}
                    />
                </div>

                {/* Column 2: IN PROGRESS */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>IN PROGRESS (24)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>

                    {/* Task Card: Progress */}
                    <TaskCard
                        id="TASK-2441"
                        title="Fix color defect SO-234"
                        desc=""
                        priority="HIGH"
                        variant="outline"
                        assignee="ID"
                        progress={85}
                        actions={true}
                        footer='"Redying now, will finish 7PM" - 15m ago'
                        onClick={() => setSelectedTask({ id: "TASK-2441", title: "Fix color defect SO-234", status: "IN_PROGRESS" })}
                    />
                </div>

                {/* Column 3: REVIEW */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>REVIEW (7)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                    <TaskCard
                        id="TASK-2398"
                        title="Approve rework plan"
                        desc="Impact: Rp 67M"
                        priority="APPROVAL"
                        variant="blue"
                        assignee="ME"
                        hasReviewAction={true}
                        footer="Waiting: 2 hours"
                        footerType="warning"
                        onClick={() => setSelectedTask({ id: "TASK-2398", title: "Approve rework plan", status: "REVIEW", isApproval: true })}
                    />
                </div>

                {/* Column 4: COMPLETED */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>COMPLETED (156)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                    <Card className="bg-zinc-50 dark:bg-zinc-900 border border-black/20 opacity-75 hover:opacity-100 transition-opacity rounded-xl">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-emerald-600 border border-emerald-200 bg-emerald-50 px-1 rounded">✅ TODAY</span>
                                <span className="text-xs font-mono text-muted-foreground">#TASK-2389</span>
                            </div>
                            <h3 className="font-medium text-sm leading-tight decoration-slate-400 line-through text-muted-foreground">Shipped SO-2026-234</h3>
                            <div className="text-xs text-muted-foreground">2000m to PT Mode Fashion</div>
                            <div className="text-[10px] text-muted-foreground border-t border-black/5 pt-1 mt-1 font-medium">
                                By: Warehouse Team • 4:30 PM
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* NEW TASK DIALOG */}
            <NewTaskDialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen} />

            {/* FILTER DIALOG */}
            <FilterDialog open={isFilterOpen} onOpenChange={setIsFilterOpen} />

            {/* TASK DETAIL DIALOG */}
            {selectedTask && <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />}

        </div>
    )
}

// --- SUB-COMPONENTS & DIALOGS ---

function TaskCard({ id, title, desc, priority, variant, tags, assignee, due, progress, actions, footer, footerType, hasReviewAction, onClick }: any) {
    return (
        <Card onClick={onClick} className="bg-white dark:bg-zinc-950 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform cursor-pointer rounded-xl group relative overflow-hidden">
            {hasReviewAction && <div className="absolute top-0 right-0 w-8 h-8 bg-blue-100 rounded-bl-xl border-l border-b border-black flex items-center justify-center z-10"><CheckCircle2 className="h-4 w-4 text-blue-600" /></div>}
            <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <Badge variant={variant === 'destructive' ? 'destructive' : 'secondary'} className={`text-[10px] px-1.5 py-0.5 h-5 shadow-sm border border-black/10 ${variant === 'blue' ? 'bg-blue-600 text-white' : variant === 'outline' ? 'bg-amber-50 text-amber-700 border-black' : ''}`}>
                        {priority}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-muted-foreground">{id}</span>
                </div>
                <h3 className="font-bold text-sm leading-tight">{title}</h3>
                {desc && <p className="text-xs text-muted-foreground line-clamp-2 font-medium">{desc}</p>}

                {progress !== undefined && (
                    <>
                        <div className="w-full h-2 bg-zinc-100 border border-black/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 border-r border-black/20" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>{progress}% Done</span>
                            <span>Started: 2:30 PM</span>
                        </div>
                    </>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-black/10">
                    <div className="flex -space-x-2">
                        <Avatar className="h-6 w-6 border-2 border-white dark:border-zinc-900">
                            <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-bold">{assignee}</AvatarFallback>
                        </Avatar>
                    </div>
                    {due && <div className={`text-xs font-black ${variant === 'destructive' ? 'text-red-600' : 'text-muted-foreground'}`}>{due}</div>}
                    {hasReviewAction && (
                        <Button size="sm" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">Review</Button>
                    )}
                    {actions && (
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-100 rounded-full"><Phone className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-100 rounded-full"><MessageSquare className="h-3 w-3" /></Button>
                        </div>
                    )}
                </div>

                {tags?.map((Tag: any, i: number) => (
                    <div key={i} className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-700 font-bold p-1.5 rounded border border-red-100 dark:border-red-900 flex items-center gap-1">
                        <Tag.icon className="h-3 w-3" />
                        <span>{Tag.text}</span>
                    </div>
                ))}

                {footer && (
                    <div className={`text-[10px] p-1 rounded text-center border mt-2 ${footerType === 'warning' ? 'text-amber-600 font-bold bg-amber-50 border-amber-100' : 'text-muted-foreground italic bg-zinc-50 border-black/5'}`}>
                        {footer}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function NewTaskDialog({ open, onOpenChange }: any) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0">
                <DialogHeader className="p-4 border-b border-black bg-zinc-50">
                    <DialogTitle className="uppercase font-black text-lg">Create New Task</DialogTitle>
                    <DialogDescription>Assign a new priority task to the team.</DialogDescription>
                </DialogHeader>
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-xs font-bold uppercase">Task Title</Label>
                        <Input id="title" placeholder="e.g. Check Line 5 Output" className="border-black focus-visible:ring-black" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="priority" className="text-xs font-bold uppercase">Priority</Label>
                            <Select>
                                <SelectTrigger className="border-black"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="assignee" className="text-xs font-bold uppercase">Assign To</Label>
                            <Select>
                                <SelectTrigger className="border-black"><SelectValue placeholder="Select Team" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="prod">Production</SelectItem>
                                    <SelectItem value="maint">Maintenance</SelectItem>
                                    <SelectItem value="qc">Quality</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="desc" className="text-xs font-bold uppercase">Description / Parts Info</Label>
                        <Textarea id="desc" placeholder="Details about parts, location, or specific requirements..." className="border-black min-h-[100px]" />
                    </div>
                </div>
                <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-black font-bold uppercase bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">Cancel</Button>
                    <Button onClick={() => onOpenChange(false)} className="flex-1 bg-black text-white hover:bg-zinc-800 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bold">Create Task</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FilterDialog({ open, onOpenChange }: any) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[300px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0">
                <DialogHeader className="p-4 border-b border-black">
                    <DialogTitle className="uppercase font-black text-base">Filter Tasks</DialogTitle>
                </DialogHeader>
                <div className="p-4 space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="my-tasks" className="border-black data-[state=checked]:bg-black data-[state=checked]:text-white" />
                            <label htmlFor="my-tasks" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Assigned to Me</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="urgent" className="border-black data-[state=checked]:bg-black data-[state=checked]:text-white" />
                            <label htmlFor="urgent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Urgent Only</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="overdue" className="border-black data-[state=checked]:bg-black data-[state=checked]:text-white" />
                            <label htmlFor="overdue" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Overdue</label>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-4 border-t border-black">
                    <Button onClick={() => onOpenChange(false)} className="w-full bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Apply Filters</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function TaskDetailDialog({ task, onClose }: any) {
    const isApproval = task.isApproval;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
                <DialogHeader className="p-6 border-b border-black bg-zinc-50">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-black text-white hover:bg-black uppercase">{task.status}</Badge>
                        <span className="font-mono text-zinc-500 font-bold">{task.id}</span>
                    </div>
                    <DialogTitle className="text-xl font-black uppercase leading-tight">{task.title}</DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-3 rounded border border-black/10">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Assignee</span>
                                <div className="flex items-center gap-2 font-bold">
                                    <Avatar className="h-6 w-6"><AvatarFallback>PA</AvatarFallback></Avatar>
                                    Production Team
                                </div>
                            </div>
                            <div className="bg-zinc-50 p-3 rounded border border-black/10">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Due Date</span>
                                <div className="flex items-center gap-2 font-bold">
                                    <Calendar className="h-4 w-4" /> Today, 5 PM
                                </div>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-2">Description</span>
                            <p className="text-sm text-zinc-700 leading-relaxed">
                                {isApproval ? "Review required for rework plan involving 2000 yards of fabric. Estimated cost impact is Rp 67M. Requires Manager approval to proceed with chemical treatment." : "Full detailed description of the task would go here. Including technical specifications, part numbers, and specific location data."}
                            </p>
                        </div>
                    </div>

                    {isApproval && (
                        <div className="bg-blue-50 p-4 border border-blue-100 rounded-lg flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-blue-800 text-sm">Manager Approval Required</h4>
                                <p className="text-xs text-blue-600 mt-1">This action involves budget allocation less than 50M.</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t border-black bg-zinc-50 flex-col sm:flex-row gap-3">
                    {isApproval ? (
                        <div className="flex w-full gap-3">
                            <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold">Reject</Button>
                            <Button className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">Approve</Button>
                        </div>
                    ) : (
                        <Button onClick={onClose} className="w-full bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Close Details</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
