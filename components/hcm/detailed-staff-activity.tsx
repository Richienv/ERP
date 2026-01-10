"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, MoreHorizontal, Activity, MessageSquare, CornerUpRight, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"

export function DetailedStaffActivity() {
    const staff = [
        { id: "EMP-001", name: "Asep Sunandar", role: "Operator Line 1", supervisor: "Pak Bambang", status: "Active", task: "Running Weaving Machine #4", output: "1,250 / 1,400", checkIn: "06:55 AM" },
        { id: "EMP-002", name: "Budi Santoso", role: "Maintenance Tech", supervisor: "Pak Hartono", status: "Busy", task: "Repairing Dyeing Machine #2", output: "Ticket #4092", checkIn: "07:05 AM" },
        { id: "EMP-003", name: "Siti Aminah", role: "QC Inspector", supervisor: "Bu Lilis", status: "Active", task: "Inspecting Batch #4567", output: "45 Batches", checkIn: "06:58 AM" },
        { id: "EMP-004", name: "Doni Pratama", role: "Forklift Driver", supervisor: "Pak Bambang", status: "Break", task: "Lunch Break", output: "12 Loads", checkIn: "06:45 AM" },
        { id: "EMP-005", name: "Rina Wati", role: "Operator Line 2", supervisor: "Pak Bambang", status: "Active", task: "Monitoring Knitting Patterns", output: "980 / 1,200", checkIn: "07:00 AM" },
        { id: "EMP-006", name: "Joko Anwar", role: "Operator Dyeing", supervisor: "Bu Lilis", status: "Active", task: "Mixing Chemicals", output: "ON TARGET", checkIn: "06:50 AM" },
        { id: "EMP-007", name: "Dewi Lestari", role: "Packing Lead", supervisor: "Bu Lilis", status: "Active", task: "Supervising Final Pack", output: "Packing List #91", checkIn: "06:52 AM" },
        { id: "EMP-008", name: "Eko Saputra", role: "Machine Setter", supervisor: "Pak Hartono", status: "Offline", task: "-", output: "-", checkIn: "-" },
    ]

    return (
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        Live Staff Activity
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Real-time monitoring of floor operations and staff status.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            className="h-9 w-64 rounded-md border border-input pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring border-black shadow-sm"
                            placeholder="Search employee or role..."
                        />
                    </div>
                    <Button variant="outline" size="icon" className="h-9 w-9 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900 border-b border-black/10">
                        <TableRow className="border-b border-black/5 hover:bg-transparent">
                            <TableHead className="font-bold text-black dark:text-white w-[80px]">ID</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Employee</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Supervisor</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Current Status</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Active Task</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Daily Output</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Check-In</TableHead>
                            <TableHead className="text-right font-bold text-black dark:text-white">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staff.map((employee) => (
                            <TableRow key={employee.id} className="hover:bg-muted/50 transition-colors border-b border-black/5 last:border-0">
                                <TableCell className="font-medium text-xs text-muted-foreground">{employee.id}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-black/10">
                                            <AvatarFallback className="text-xs font-bold bg-zinc-100">{employee.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-bold text-sm">{employee.name}</div>
                                            <div className="text-xs text-muted-foreground">{employee.role}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 border-zinc-200">
                                        {employee.supervisor}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`
                                        ${employee.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            employee.status === 'Busy' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                employee.status === 'Break' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-zinc-100 text-zinc-500 border-zinc-200'}
                                    `}>
                                        {employee.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                    {employee.task !== '-' ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${employee.status === 'Active' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                            {employee.task}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {employee.output !== '-' ? (
                                        <span className="font-mono text-sm font-bold text-foreground">
                                            {employee.output}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">
                                    {employee.checkIn}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <ActionDialog
                                            trigger={<Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100"><MessageSquare className="h-4 w-4 text-zinc-500" /></Button>}
                                            title="Message Employee"
                                            desc={`Send a direct message to ${employee.name}.`}
                                            actionLabel="Send Message"
                                        />
                                        <ActionDialog
                                            trigger={<Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100"><CornerUpRight className="h-4 w-4 text-zinc-500" /></Button>}
                                            title="Reassign Task"
                                            desc={`Assign a new priority task to ${employee.name}.`}
                                            actionLabel="Update Assignment"
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function ActionDialog({ trigger, title, desc, actionLabel }: { trigger: React.ReactNode, title: string, desc: string, actionLabel: string }) {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-black">
                <DialogHeader>
                    <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>{desc}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Reason / Message</Label>
                        <Textarea placeholder="Type your message or simplified task instruction here..." className="border-black focus-visible:ring-black" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} className="border-black hover:bg-zinc-100">Cancel</Button>
                    <Button onClick={() => setOpen(false)} className="bg-indigo-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-indigo-700 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                        {actionLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
