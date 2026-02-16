"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Filter, AlertTriangle, Clock, CheckCircle, Ban, Calendar, User, FileText, ArrowRight } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { createTask } from "@/lib/actions/tasks"
import type { ManagerTaskDTO, ManagerTasksData, AssignableEmployee, AssignableOrder } from "@/lib/actions/tasks"
import Link from "next/link"

// ==============================================================================
// Constants
// ==============================================================================

const PRIORITY_LABELS: Record<string, string> = {
    LOW: "Rendah", MEDIUM: "Sedang", HIGH: "Tinggi", URGENT: "Mendesak",
}
const PRIORITY_COLORS: Record<string, string> = {
    LOW: "bg-zinc-100 text-zinc-600 border-zinc-300",
    MEDIUM: "bg-orange-100 text-orange-700 border-orange-300",
    HIGH: "bg-red-100 text-red-700 border-red-300",
    URGENT: "bg-red-500 text-white border-red-600 animate-pulse",
}

const TYPE_LABELS: Record<string, string> = {
    PRODUCTION: "Produksi", QUALITY_CHECK: "Kualitas", LOGISTICS: "Gudang",
    SALES: "Penjualan", PO_REVIEW: "Review PO", PURCHASE_REQUEST: "Permintaan Beli",
    OTHER: "Lainnya", ADMIN: "Admin",
}

const COLUMN_CONFIG = [
    { key: "pending", label: "Menunggu", icon: Clock, color: "border-t-zinc-400" },
    { key: "inProgress", label: "Berjalan", icon: ArrowRight, color: "border-t-blue-500" },
    { key: "blocked", label: "Kendala", icon: AlertTriangle, color: "border-t-red-500" },
    { key: "completed", label: "Selesai", icon: CheckCircle, color: "border-t-emerald-500" },
] as const

// ==============================================================================
// Main Component
// ==============================================================================

interface ManagerTaskBoardProps {
    tasks: ManagerTasksData
    employees: AssignableEmployee[]
    orders: AssignableOrder[]
}

export function ManagerTaskBoard({ tasks, employees, orders }: ManagerTaskBoardProps) {
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<ManagerTaskDTO | null>(null)
    const [filterEmployee, setFilterEmployee] = useState("")

    const filteredTasks = useMemo(() => {
        if (!filterEmployee) return tasks
        return {
            pending: tasks.pending.filter((t) => t.employeeId === filterEmployee),
            inProgress: tasks.inProgress.filter((t) => t.employeeId === filterEmployee),
            blocked: tasks.blocked.filter((t) => t.employeeId === filterEmployee),
            completed: tasks.completed.filter((t) => t.employeeId === filterEmployee),
        }
    }, [tasks, filterEmployee])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    Pusat Manajemen Tugas
                </h2>
                <div className="flex gap-2">
                    <select
                        className="border-2 border-black text-[10px] font-black uppercase tracking-wider px-3 h-8 bg-white"
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                    >
                        <option value="">Semua Staf</option>
                        {employees.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setIsNewTaskOpen(true)}
                        className="flex items-center gap-1.5 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wider px-4 h-8"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Tugas Baru
                    </button>
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {COLUMN_CONFIG.map((col) => {
                    const colTasks = filteredTasks[col.key as keyof ManagerTasksData]
                    const Icon = col.icon
                    return (
                        <div
                            key={col.key}
                            className={`bg-zinc-50 border-2 border-black border-t-4 ${col.color} p-3 flex flex-col gap-3 min-h-[300px]`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {col.label}
                                    </span>
                                </div>
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-white border-2 border-black">
                                    {colTasks.length}
                                </span>
                            </div>

                            {colTasks.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-zinc-400">Kosong</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[500px]">
                                    {colTasks.map((task) => (
                                        <KanbanCard
                                            key={task.id}
                                            task={task}
                                            onClick={() => setSelectedTask(task)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Create Task Dialog */}
            <NewTaskDialog
                open={isNewTaskOpen}
                onOpenChange={setIsNewTaskOpen}
                employees={employees}
                orders={orders}
            />

            {/* Task Detail Dialog */}
            {selectedTask && (
                <TaskDetailDialog
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                />
            )}
        </div>
    )
}

// ==============================================================================
// Kanban Card
// ==============================================================================

function KanbanCard({ task, onClick }: { task: ManagerTaskDTO; onClick: () => void }) {
    const linkedLabel = task.workOrderNumber
        ? `WO: ${task.workOrderNumber}`
        : task.purchaseOrderNumber
            ? `PO: ${task.purchaseOrderNumber}`
            : task.salesOrderNumber
                ? `SO: ${task.salesOrderNumber}`
                : null

    return (
        <div
            onClick={onClick}
            className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer p-3 space-y-2"
        >
            <div className="flex justify-between items-start gap-2">
                <span className={`text-[8px] font-black px-1.5 py-0.5 border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM}`}>
                    {PRIORITY_LABELS[task.priority] || task.priority}
                </span>
                {task.deadline && (
                    <span className="text-[9px] font-mono font-bold text-zinc-400">
                        {new Date(task.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                )}
            </div>
            <h3 className="text-xs font-black leading-tight">{task.title}</h3>
            {linkedLabel && (
                <div className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 border border-blue-200 w-fit">
                    {linkedLabel}
                </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 bg-zinc-200 border border-black flex items-center justify-center">
                        <span className="text-[8px] font-black">
                            {task.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-zinc-500">{task.employeeName}</span>
                </div>
                <span className="text-[8px] font-bold text-zinc-400">
                    {TYPE_LABELS[task.type] || task.type}
                </span>
            </div>
        </div>
    )
}

// ==============================================================================
// New Task Dialog
// ==============================================================================

function NewTaskDialog({
    open,
    onOpenChange,
    employees,
    orders,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    employees: AssignableEmployee[]
    orders: AssignableOrder[]
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState("")
    const [employeeId, setEmployeeId] = useState("")
    const [type, setType] = useState("PRODUCTION")
    const [priority, setPriority] = useState("MEDIUM")
    const [notes, setNotes] = useState("")
    const [deadline, setDeadline] = useState("")
    const [orderId, setOrderId] = useState("")

    const handleCreate = async () => {
        if (!title.trim()) { toast.error("Judul tugas wajib diisi"); return }
        if (!employeeId) { toast.error("Pilih karyawan"); return }

        setLoading(true)

        const selectedOrder = orders.find((o) => `${o.type}:${o.id}` === orderId)

        const result = await createTask({
            title: title.trim(),
            employeeId,
            type,
            priority,
            notes: notes.trim() || undefined,
            deadline: deadline || undefined,
            workOrderId: selectedOrder?.type === "WO" ? selectedOrder.id : undefined,
            purchaseOrderId: selectedOrder?.type === "PO" ? selectedOrder.id : undefined,
            salesOrderId: selectedOrder?.type === "SO" ? selectedOrder.id : undefined,
        })

        setLoading(false)

        if (result.success) {
            toast.success("Tugas berhasil dibuat")
            onOpenChange(false)
            setTitle("")
            setEmployeeId("")
            setNotes("")
            setDeadline("")
            setOrderId("")
            router.refresh()
        } else {
            toast.error(result.error || "Gagal membuat tugas")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Plus className="h-5 w-5" />
                        Buat Tugas Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Tugaskan pekerjaan ke anggota tim</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">
                        {/* Title */}
                        <div>
                            <label className={NB.label}>
                                Judul Tugas <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                className={NB.input}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Misal: Inspeksi kualitas batch DY-2026"
                            />
                        </div>

                        {/* Employee + Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>
                                    Ditugaskan Ke <span className={NB.labelRequired}>*</span>
                                </label>
                                <select
                                    className={NB.select}
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                >
                                    <option value="">Pilih karyawan...</option>
                                    {employees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} — {e.position}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={NB.label}>Tipe Tugas</label>
                                <select
                                    className={NB.select}
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="PRODUCTION">Produksi</option>
                                    <option value="QUALITY_CHECK">Kualitas</option>
                                    <option value="LOGISTICS">Gudang / Logistik</option>
                                    <option value="SALES">Penjualan</option>
                                    <option value="OTHER">Teknisi / Lainnya</option>
                                </select>
                            </div>
                        </div>

                        {/* Priority + Deadline */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>Prioritas</label>
                                <select
                                    className={NB.select}
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="LOW">Rendah</option>
                                    <option value="MEDIUM">Sedang</option>
                                    <option value="HIGH">Tinggi</option>
                                    <option value="URGENT">Mendesak</option>
                                </select>
                            </div>
                            <div>
                                <label className={NB.label}>Tenggat Waktu</label>
                                <Input
                                    type="datetime-local"
                                    className={NB.input}
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Link to Order */}
                        {orders.length > 0 && (
                            <div>
                                <label className={NB.label}>Hubungkan ke Order</label>
                                <select
                                    className={NB.select}
                                    value={orderId}
                                    onChange={(e) => setOrderId(e.target.value)}
                                >
                                    <option value="">— Tidak ada —</option>
                                    {orders.map((o) => (
                                        <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className={NB.label}>Instruksi / Catatan</label>
                            <Textarea
                                className={NB.textarea}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Detail instruksi, lokasi, target, dll..."
                            />
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? "Menyimpan..." : "Buat Tugas"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

// ==============================================================================
// Task Detail Dialog
// ==============================================================================

function TaskDetailDialog({ task, onClose }: { task: ManagerTaskDTO; onClose: () => void }) {
    const linkedOrder = task.workOrderNumber
        ? { label: `WO: ${task.workOrderNumber}`, href: `/manufacturing/orders` }
        : task.purchaseOrderNumber
            ? { label: `PO: ${task.purchaseOrderNumber}`, href: `/procurement/orders` }
            : task.salesOrderNumber
                ? { label: `SO: ${task.salesOrderNumber}`, href: `/sales/orders` }
                : null

    // Parse issue from notes if BLOCKED
    let issueInfo: { category?: string; description?: string; reportedAt?: string } | null = null
    if (task.notes?.includes("ISSUE::")) {
        try {
            const issueJson = task.notes.split("ISSUE::").pop()
            issueInfo = JSON.parse(issueJson || "{}")
        } catch { /* ignore */ }
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 border ${PRIORITY_COLORS[task.priority] || ""}`}>
                            {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">
                            {TYPE_LABELS[task.type] || task.type}
                        </span>
                    </div>
                    <DialogTitle className={NB.title}>{task.title}</DialogTitle>
                    <p className={NB.subtitle}>
                        Ditugaskan ke: {task.employeeName} — {task.employeeDepartment}
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {/* Status + Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">Status</span>
                            <span className={`text-[10px] font-black px-2 py-1 border inline-block ${
                                task.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                : task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700 border-blue-300"
                                : task.status === "BLOCKED" ? "bg-red-100 text-red-700 border-red-300"
                                : "bg-zinc-100 text-zinc-600 border-zinc-300"
                            }`}>
                                {task.status === "PENDING" ? "MENUNGGU"
                                    : task.status === "IN_PROGRESS" ? "BERJALAN"
                                    : task.status === "COMPLETED" ? "SELESAI"
                                    : task.status === "BLOCKED" ? "KENDALA"
                                    : task.status}
                            </span>
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">Dibuat</span>
                            <span className="text-xs font-bold">
                                {new Date(task.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">Tenggat</span>
                            <span className="text-xs font-bold">
                                {task.deadline
                                    ? new Date(task.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                                    : "—"}
                            </span>
                        </div>
                    </div>

                    {/* Linked Order */}
                    {linkedOrder && (
                        <div className="bg-blue-50 border-2 border-blue-300 p-3 flex items-center justify-between">
                            <div>
                                <span className="text-[9px] font-black uppercase text-blue-500">Dokumen Terkait</span>
                                <div className="text-sm font-black text-blue-800">{linkedOrder.label}</div>
                            </div>
                            <Link
                                href={linkedOrder.href}
                                className="text-[9px] font-black uppercase tracking-wider px-3 py-1.5 border-2 border-black bg-white hover:bg-zinc-50 flex items-center gap-1"
                            >
                                Buka <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    )}

                    {/* Issue Alert */}
                    {issueInfo && task.status === "BLOCKED" && (
                        <div className="bg-red-50 border-2 border-red-400 p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <span className="text-[10px] font-black uppercase text-red-700">Laporan Kendala</span>
                            </div>
                            {issueInfo.category && (
                                <div className="text-xs font-bold text-red-800 mb-1">Kategori: {issueInfo.category}</div>
                            )}
                            {issueInfo.description && (
                                <div className="text-xs text-red-700">{issueInfo.description}</div>
                            )}
                            {issueInfo.reportedAt && (
                                <div className="text-[9px] text-red-400 font-bold mt-1">
                                    Dilaporkan: {new Date(issueInfo.reportedAt).toLocaleString("id-ID")}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {task.notes && !task.notes.startsWith("ISSUE::") && (
                        <div>
                            <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">Catatan</span>
                            <div className="p-3 border-2 border-black bg-zinc-50 text-sm font-medium text-zinc-700 whitespace-pre-line">
                                {task.notes.split("\nISSUE::")[0]}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t-2 border-black bg-zinc-50 flex justify-end">
                    <button onClick={onClose} className={NB.cancelBtn}>Tutup</button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
