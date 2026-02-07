"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, Play, Calendar, User, FileText, History, ArrowRight, Wrench, Package, ShieldAlert, Zap, MapPin, Camera } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

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
    const [isReportOpen, setIsReportOpen] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const getStatusLabel = (status: TaskStatus) => {
        switch (status) {
            case "running": return "BERJALAN"
            case "completed": return "SELESAI"
            case "issue": return "KENDALA"
            default: return "MENUNGGU"
        }
    }

    const getStatusColor = (status: TaskStatus) => {
        switch (status) {
            case "running": return "bg-blue-100 text-blue-800 border-black dark:bg-blue-900/30 dark:text-blue-300"
            case "completed": return "bg-emerald-100 text-emerald-800 border-black dark:bg-emerald-900/30 dark:text-emerald-300"
            case "issue": return "bg-red-100 text-red-800 border-black dark:bg-red-900/30 dark:text-red-300"
            default: return "bg-zinc-100 text-zinc-800 border-black dark:bg-zinc-800 dark:text-zinc-300"
        }
    }

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "high": return <Badge variant="destructive" className="h-5 text-[10px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">TINGGI</Badge>
            case "medium": return <Badge variant="secondary" className="h-5 text-[10px] bg-orange-100 text-orange-800 border-black border font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">SEDANG</Badge>
            default: return null
        }
    }

    // Mock Detail Data (Localized)
    const mockDetails = {
        supervisor: "Bpk. Heru Santoso",
        created: "Hari ini, 07:30 WIB",
        department: task.type === 'production' ? 'Produksi' :
            task.type === 'quality' ? 'Quality Control' :
                task.type === 'warehouse' ? 'Gudang' : 'Maintenance',
        history: [
            { time: "07:30", action: "Tugas dibuat oleh Sistem" },
            { time: "07:45", action: "Ditugaskan ke Shift A" },
            ...(task.status === 'running' ? [{ time: "08:15", action: "Dimulai oleh Operator" }] : []),
            ...(task.status === 'completed' ? [{ time: "16:00", action: "Ditandai Selesai" }] : []),
        ]
    }

    return (
        <>
            <Card
                className={`group cursor-pointer border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${task.status === 'running' ? 'border-l-[6px] border-l-blue-500' : ''}`}
                onClick={() => setIsDetailOpen(true)}
            >
                <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`h-5 text-[10px] uppercase font-bold border rounded-sm ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                            </Badge>
                            {getPriorityBadge(task.priority)}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono font-bold">{task.time}</span>
                    </div>
                    <CardTitle className="text-sm font-black uppercase leading-tight tracking-wide">{task.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 py-2">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 font-medium">
                        {task.description}
                    </p>
                    {task.location && (
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 w-fit px-2 py-1 rounded border border-black/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            {task.location}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-4 pt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {task.status === "pending" && (
                        <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 text-xs font-bold uppercase tracking-wide border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all" onClick={(e) => { e.stopPropagation(); onStart(task.id); }}>
                            <Play className="w-3.5 h-3.5 mr-1.5" />
                            Mulai Tugas
                        </Button>
                    )}

                    {task.status === "running" && (
                        <div className="flex gap-2 w-full">
                            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs font-bold uppercase border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all bg-white text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setIsReportOpen(true); }}>
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                Lapor Isu
                            </Button>
                            <Button size="sm" className="flex-1 h-9 text-xs font-bold uppercase border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all bg-emerald-600 hover:bg-emerald-700 text-white" onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                Selesai
                            </Button>
                        </div>
                    )}

                    {task.status === "completed" && (
                        <Button size="sm" variant="ghost" className="w-full h-9 text-xs text-emerald-600 font-bold uppercase cursor-default hover:bg-transparent border border-transparent">
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            Terverifikasi
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* MAIN TASK DETAIL DIALOG */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-black p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={`h-5 text-[10px] uppercase font-bold border-black ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-wide leading-tight">{task.title}</DialogTitle>
                        <DialogDescription className="text-zinc-500 font-medium mt-1">
                            Detail instruksi operasional dan log audit sistem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 p-6">
                        {/* Meta Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" /> Pemberi Tugas</span>
                                <p className="text-sm font-bold border border-black/10 bg-zinc-50 p-2 rounded-md">{mockDetails.supervisor}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Dibuat Pada</span>
                                <p className="text-sm font-bold border border-black/10 bg-zinc-50 p-2 rounded-md">{mockDetails.created}</p>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><FileText className="h-3 w-3" /> Instruksi Lengkap</span>
                            <div className="p-3 border border-black/20 rounded-lg bg-indigo-50/50 text-sm leading-relaxed text-zinc-700">
                                {task.description}
                                <div className="mt-2 flex gap-2">
                                    {task.type === 'production' && <Badge variant="secondary" className="bg-white border text-[10px]">Target: 1200m</Badge>}
                                    {task.type === 'quality' && <Badge variant="secondary" className="bg-white border text-[10px]">AQL 2.5</Badge>}
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><History className="h-3 w-3" /> Riwayat Aktivitas</span>
                            <div className="relative border-l-2 border-zinc-200 ml-1.5 space-y-4 pl-4 py-1">
                                {mockDetails.history.map((h, i) => (
                                    <div key={i} className="relative">
                                        <div className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-white ${i === mockDetails.history.length - 1 ? "bg-indigo-600 ring-2 ring-indigo-100" : "bg-zinc-300"
                                            }`} />
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-medium">{h.action}</p>
                                            <span className="text-[10px] text-muted-foreground font-mono">{h.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-zinc-50 border-t border-black flex justify-end">
                        <Button size="sm" variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all">
                            Lihat Dokumen Lengkap <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* REPORT ISSUE DIALOG */}
            <ReportIssueTrigger
                open={isReportOpen}
                onOpenChange={setIsReportOpen}
                task={task}
                onSubmit={() => {
                    setIsReportOpen(false);
                    onReport(task.id);
                }}
            />
        </>
    )
}

function ReportIssueTrigger({ open, onOpenChange, task, onSubmit }: { open: boolean, onOpenChange: (v: boolean) => void, task: StaffTask, onSubmit: () => void }) {
    const [issueType, setIssueType] = useState("machine")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-black p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 border-b border-black bg-red-50 dark:bg-red-900/10">
                    <div className="flex items-center gap-2 text-red-600 mb-1">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-wide">Pusat Kendala</span>
                    </div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Lapor Masalah Operasional</DialogTitle>
                    <DialogDescription className="text-red-800/70 font-medium">
                        Laporan ini akan dikirim langsung ke Supervisor dan Tim Maintenance.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* 1. Kategori Masalah */}
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase text-muted-foreground">Kategori Masalah</Label>
                        <RadioGroup defaultValue="machine" onValueChange={setIssueType} className="grid grid-cols-2 gap-3">
                            <Label htmlFor="type-machine" className={`border-2 border-black/10 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 transition-all ${issueType === 'machine' ? 'bg-red-50 border-red-500 text-red-700' : ''}`}>
                                <RadioGroupItem value="machine" id="type-machine" className="sr-only" />
                                <Wrench className="h-6 w-6" />
                                <span className="text-xs font-bold">Kerusakan Mesin</span>
                            </Label>
                            <Label htmlFor="type-material" className={`border-2 border-black/10 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 transition-all ${issueType === 'material' ? 'bg-amber-50 border-amber-500 text-amber-700' : ''}`}>
                                <RadioGroupItem value="material" id="type-material" className="sr-only" />
                                <Package className="h-6 w-6" />
                                <span className="text-xs font-bold">Kekurangan Bahan</span>
                            </Label>
                            <Label htmlFor="type-quality" className={`border-2 border-black/10 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 transition-all ${issueType === 'quality' ? 'bg-purple-50 border-purple-500 text-purple-700' : ''}`}>
                                <RadioGroupItem value="quality" id="type-quality" className="sr-only" />
                                <ShieldAlert className="h-6 w-6" />
                                <span className="text-xs font-bold">Cacat Kualitas</span>
                            </Label>
                            <Label htmlFor="type-safety" className={`border-2 border-black/10 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 transition-all ${issueType === 'safety' ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}>
                                <RadioGroupItem value="safety" id="type-safety" className="sr-only" />
                                <Zap className="h-6 w-6" />
                                <span className="text-xs font-bold">Kecelakaan / Safety</span>
                            </Label>
                        </RadioGroup>
                    </div>

                    {/* 2. Lokasi & Bukti */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase text-muted-foreground">Lokasi Kejadian</Label>
                            <div className="relative">
                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input defaultValue={task.location} className="pl-9 border-black font-medium" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase text-muted-foreground">Foto Bukti (Opsional)</Label>
                            <Button variant="outline" type="button" className="w-full border-black border-dashed text-muted-foreground hover:bg-zinc-50">
                                <Camera className="h-4 w-4 mr-2" /> Ambil Foto
                            </Button>
                        </div>
                    </div>

                    {/* 3. Deskripsi */}
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground">Deskripsi Singkat</Label>
                        <Textarea placeholder="Jelaskan detail kendala yang terjadi..." className="border-black min-h-[80px]" />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-black bg-zinc-50">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-black hover:bg-zinc-100 font-bold">Batal</Button>
                    <Button onClick={onSubmit} className="bg-red-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold">
                        Kirim Laporan Isu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
