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
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import type { StaffTaskDTO } from "@/lib/actions/tasks"

export type TaskStatus = "pending" | "running" | "completed" | "issue"

interface TaskCardProps {
    task: StaffTaskDTO
    onStart: (id: string) => void
    onComplete: (id: string) => void
    onReport: (id: string, issueData?: { category: string; location: string; description: string }) => void
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
            case "running": return "bg-blue-100 text-blue-800 border-border"
            case "completed": return "bg-emerald-100 text-emerald-800 border-border"
            case "issue": return "bg-red-100 text-red-800 border-border"
            default: return "bg-zinc-100 text-zinc-800 border-border"
        }
    }

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "urgent": return <Badge variant="destructive" className="h-5 text-xs border-border shadow-sm animate-pulse">MENDESAK</Badge>
            case "high": return <Badge variant="destructive" className="h-5 text-xs border-border shadow-sm">TINGGI</Badge>
            case "medium": return <Badge variant="secondary" className="h-5 text-xs bg-blue-100 text-blue-800 border-border border font-bold shadow-sm">SEDANG</Badge>
            default: return null
        }
    }

    // Build linked order info
    const linkedOrder = task.workOrderNumber
        ? { label: `WO: ${task.workOrderNumber}`, href: `/manufacturing/orders` }
        : task.purchaseOrderNumber
            ? { label: `PO: ${task.purchaseOrderNumber}`, href: `/procurement/orders` }
            : task.salesOrderNumber
                ? { label: `SO: ${task.salesOrderNumber}`, href: `/sales/orders` }
                : null

    const typeLabel = {
        production: "Produksi",
        quality: "Quality Control",
        warehouse: "Gudang",
        maintenance: "Teknisi",
    }[task.type] || task.type

    return (
        <>
            <Card
                className={`group cursor-pointer border border-border shadow-sm overflow-hidden bg-white transition-all   hover:shadow-sm ${task.status === 'running' ? 'border-l-[6px] border-l-blue-500' : ''}`}
                onClick={() => setIsDetailOpen(true)}
            >
                <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`h-5 text-xs font-bold border ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                            </Badge>
                            {getPriorityBadge(task.priority)}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono font-bold">{task.time}</span>
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight">{task.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 py-2">
                    {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 font-medium">
                            {task.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        {linkedOrder && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 w-fit px-2 py-1 border border-blue-200">
                                <FileText className="h-3 w-3" />
                                {linkedOrder.label}
                            </div>
                        )}
                        {task.location && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 bg-zinc-100 w-fit px-2 py-1 border border-zinc-200">
                                <MapPin className="h-3 w-3" />
                                {task.location}
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {task.status === "pending" && (
                        <Button size="sm" className="w-full bg-slate-900 text-white h-9 text-xs font-semibold border border-border shadow-sm active:shadow-none transition-all" onClick={(e) => { e.stopPropagation(); onStart(task.id); }}>
                            <Play className="w-3.5 h-3.5 mr-1.5" />
                            Mulai Tugas
                        </Button>
                    )}

                    {task.status === "running" && (
                        <div className="flex gap-2 w-full">
                            <Button size="sm" variant="outline" className="flex-1 h-9 text-xs font-semibold border border-border shadow-sm active:shadow-none transition-all bg-white text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setIsReportOpen(true); }}>
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                Lapor Isu
                            </Button>
                            <Button size="sm" className="flex-1 h-9 text-xs font-semibold border border-border shadow-sm active:shadow-none transition-all bg-emerald-600 hover:bg-emerald-700 text-white" onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                Selesai
                            </Button>
                        </div>
                    )}

                    {task.status === "completed" && (
                        <div className="w-full text-center">
                            <span className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Terverifikasi
                            </span>
                        </div>
                    )}

                    {task.status === "issue" && (
                        <div className="w-full text-center">
                            <span className="text-xs font-semibold text-red-600 flex items-center justify-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Menunggu Penanganan
                            </span>
                        </div>
                    )}
                </CardFooter>
            </Card>

            {/* TASK DETAIL DIALOG */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[500px] border border-border shadow-sm bg-white p-0 gap-0 overflow-hidden rounded-md">
                    <DialogHeader className="p-6 border-b border-border bg-slate-900 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={`h-5 text-xs font-bold border ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                            </Badge>
                            {getPriorityBadge(task.priority)}
                        </div>
                        <DialogTitle className="text-lg font-semibold text-white leading-tight">{task.title}</DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs font-bold mt-0.5">
                            {typeLabel} — {task.time}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 p-6">
                        {/* Linked Order */}
                        {linkedOrder && (
                            <div className="bg-blue-50 border border-blue-300 p-3 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold text-blue-500">Dokumen Terkait</span>
                                    <div className="text-sm font-semibold text-blue-800">{linkedOrder.label}</div>
                                </div>
                                <Link
                                    href={linkedOrder.href}
                                    className="text-xs font-semibold px-3 py-1.5 border border-border bg-white hover:bg-zinc-50 flex items-center gap-1"
                                >
                                    Buka <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        )}

                        {/* Meta Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" /> Dibuat
                                </span>
                                <p className="text-xs font-bold border border-border bg-zinc-50 p-2">
                                    {new Date(task.createdAt).toLocaleDateString("id-ID", {
                                        day: "numeric", month: "short", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                    })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                                    <User className="h-3 w-3" /> Kategori
                                </span>
                                <p className="text-xs font-bold border border-border bg-zinc-50 p-2">
                                    {typeLabel}
                                </p>
                            </div>
                        </div>

                        {/* Description */}
                        {task.description && (
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" /> Instruksi
                                </span>
                                <div className="p-3 border border-border bg-zinc-50 text-sm leading-relaxed text-zinc-700 font-medium">
                                    {task.description.split("\n").map((line, i) => (
                                        <p key={i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-zinc-50 border-t border-border flex justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsDetailOpen(false)}
                            className="border border-border shadow-sm bg-white font-semibold text-xs"
                        >
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* REPORT ISSUE DIALOG */}
            <ReportIssueDialog
                open={isReportOpen}
                onOpenChange={setIsReportOpen}
                task={task}
                onSubmit={(issueData) => {
                    setIsReportOpen(false)
                    onReport(task.id, issueData)
                }}
            />
        </>
    )
}

function ReportIssueDialog({
    open,
    onOpenChange,
    task,
    onSubmit,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    task: StaffTaskDTO
    onSubmit: (data: { category: string; location: string; description: string }) => void
}) {
    const [issueType, setIssueType] = useState("machine")
    const [location, setLocation] = useState(task.location || "")
    const [description, setDescription] = useState("")

    const handleSubmit = () => {
        onSubmit({ category: issueType, location, description })
        setDescription("")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border border-border shadow-sm bg-white p-0 gap-0 overflow-hidden rounded-md">
                <DialogHeader className="p-6 border-b border-border bg-red-600 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-xs font-semibold  ">Pusat Kendala</span>
                    </div>
                    <DialogTitle className="text-lg font-semibold text-white">
                        Lapor Masalah Operasional
                    </DialogTitle>
                    <DialogDescription className="text-red-100 text-xs font-bold mt-0.5">
                        Laporan ini akan dikirim ke Supervisor dan Tim terkait.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Category */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold text-zinc-500">Kategori Masalah</Label>
                        <RadioGroup defaultValue="machine" onValueChange={setIssueType} className="grid grid-cols-2 gap-3">
                            {[
                                { value: "machine", icon: Wrench, label: "Kerusakan Mesin", activeClass: "bg-red-50 border-red-500 text-red-700" },
                                { value: "material", icon: Package, label: "Kekurangan Bahan", activeClass: "bg-amber-50 border-amber-500 text-amber-700" },
                                { value: "quality", icon: ShieldAlert, label: "Cacat Kualitas", activeClass: "bg-purple-50 border-purple-500 text-purple-700" },
                                { value: "safety", icon: Zap, label: "Kecelakaan / Safety", activeClass: "bg-blue-50 border-blue-500 text-blue-700" },
                            ].map((opt) => (
                                <Label
                                    key={opt.value}
                                    htmlFor={`type-${opt.value}`}
                                    className={`border border-border p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 transition-all ${issueType === opt.value ? opt.activeClass : "bg-white"}`}
                                >
                                    <RadioGroupItem value={opt.value} id={`type-${opt.value}`} className="sr-only" />
                                    <opt.icon className="h-6 w-6" />
                                    <span className="text-xs font-semibold">{opt.label}</span>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-500">Lokasi Kejadian</Label>
                        <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="pl-9 border border-border font-bold rounded-md"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-500">Deskripsi Singkat</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Jelaskan detail kendala yang terjadi..."
                            className="border border-border min-h-[80px] rounded-md"
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-border bg-zinc-50 flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border border-border font-semibold text-xs rounded-md"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-red-600 text-white border border-border shadow-sm hover:bg-red-700 font-semibold text-xs rounded-md"
                    >
                        Kirim Laporan Isu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
