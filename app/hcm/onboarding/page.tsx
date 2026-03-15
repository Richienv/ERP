"use client"

export const dynamic = "force-dynamic"

import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
    ClipboardCheck,
    Plus,
    RefreshCcw,
    UserPlus,
    Trash2,
    ListChecks,
    Users,
    Loader2,
} from "lucide-react"

import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"
import { useOnboarding } from "@/hooks/use-onboarding"
import { getEmployees } from "@/app/actions/hcm"
import {
    createOnboardingTemplate,
    startOnboarding,
    getEmployeeOnboarding,
    toggleOnboardingTask,
    type OnboardingTask,
    type EmployeeOnboardingStatus,
} from "@/lib/actions/hcm-onboarding"
import { OnboardingChecklist } from "@/components/hcm/onboarding-checklist"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

/* ─── Animation ─── */
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}

/* ═══════════════════════════════════════════════════
   Create Template Dialog
   ═══════════════════════════════════════════════════ */
function CreateTemplateDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
}) {
    const queryClient = useQueryClient()
    const [name, setName] = useState("")
    const [tasks, setTasks] = useState<OnboardingTask[]>([
        { key: "", title: "", description: "", department: "" },
    ])
    const [submitting, setSubmitting] = useState(false)

    const reset = () => {
        setName("")
        setTasks([{ key: "", title: "", description: "", department: "" }])
    }

    const addTask = () =>
        setTasks([...tasks, { key: "", title: "", description: "", department: "" }])

    const removeTask = (idx: number) =>
        setTasks(tasks.filter((_, i) => i !== idx))

    const updateTask = (idx: number, field: keyof OnboardingTask, value: string) => {
        const next = [...tasks]
        next[idx] = { ...next[idx], [field]: value }
        setTasks(next)
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Nama template wajib diisi")
            return
        }
        const validTasks = tasks.filter(
            (t) => t.key.trim() && t.title.trim() && t.department.trim()
        )
        if (validTasks.length === 0) {
            toast.error("Minimal 1 tugas lengkap diperlukan (key, judul, departemen)")
            return
        }
        setSubmitting(true)
        const result = await createOnboardingTemplate({
            name: name.trim(),
            tasks: validTasks,
        })
        setSubmitting(false)

        if (result.success) {
            toast.success("Template berhasil dibuat")
            queryClient.invalidateQueries({ queryKey: queryKeys.hcmOnboarding.all })
            reset()
            onOpenChange(false)
        } else {
            toast.error(result.error || "Gagal membuat template")
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) reset()
                onOpenChange(v)
            }}
        >
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <div className="h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 -mx-6 -mt-4 mb-3" />
                    <DialogTitle className={NB.title}>
                        <ClipboardCheck className="h-5 w-5" /> Buat Template Onboarding
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        Buat template baru dengan daftar tugas onboarding
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">
                        {/* Template Name */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <ClipboardCheck className="h-3.5 w-3.5 text-zinc-500" />
                                <span className={NB.sectionTitle}>Info Template</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <label className={NB.label}>
                                    Nama Template <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input
                                    className={NB.input}
                                    placeholder="e.g. Onboarding Staff Produksi"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Tasks */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <ListChecks className="h-3.5 w-3.5 text-zinc-500" />
                                <span className={NB.sectionTitle}>Daftar Tugas</span>
                                <span className={NB.sectionHint}>{tasks.length} tugas</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="space-y-3">
                                    {tasks.map((task, index) => (
                                        <div
                                            key={`task-${index}-${task.key}`}
                                            className="border-2 border-zinc-200 dark:border-zinc-700 p-3 space-y-2 relative"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                    Tugas #{index + 1}
                                                </span>
                                                {tasks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTask(index)}
                                                        className="text-red-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className={NB.label}>
                                                        Key <span className={NB.labelRequired}>*</span>
                                                    </label>
                                                    <Input
                                                        className={NB.inputSm}
                                                        placeholder="e.g. safety-training"
                                                        value={task.key}
                                                        onChange={(e) =>
                                                            updateTask(index, "key", e.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div>
                                                    <label className={NB.label}>
                                                        Departemen <span className={NB.labelRequired}>*</span>
                                                    </label>
                                                    <Input
                                                        className={NB.inputSm}
                                                        placeholder="e.g. HRD"
                                                        value={task.department}
                                                        onChange={(e) =>
                                                            updateTask(index, "department", e.target.value)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={NB.label}>
                                                    Judul <span className={NB.labelRequired}>*</span>
                                                </label>
                                                <Input
                                                    className={NB.inputSm}
                                                    placeholder="e.g. Pelatihan Keselamatan Kerja"
                                                    value={task.title}
                                                    onChange={(e) =>
                                                        updateTask(index, "title", e.target.value)
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Deskripsi</label>
                                                <Input
                                                    className={NB.inputSm}
                                                    placeholder="Opsional"
                                                    value={task.description}
                                                    onChange={(e) =>
                                                        updateTask(index, "description", e.target.value)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-dashed border-2 text-[10px] font-bold uppercase w-full hover:bg-teal-50 hover:border-teal-300 rounded-none mt-3"
                                    onClick={addTask}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Tambah Tugas
                                </Button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <Button
                                variant="outline"
                                className={NB.cancelBtn}
                                onClick={() => {
                                    reset()
                                    onOpenChange(false)
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                                        Menyimpan...
                                    </>
                                ) : (
                                    "Simpan Template"
                                )}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

/* ═══════════════════════════════════════════════════
   Start Onboarding Dialog
   ═══════════════════════════════════════════════════ */
function StartOnboardingDialog({
    open,
    onOpenChange,
    employees,
    templates,
    onSuccess,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    employees: { id: string; name: string; department: string | null }[]
    templates: { id: string; name: string; taskCount: number }[]
    onSuccess: (empId: string) => void
}) {
    const [selectedEmployee, setSelectedEmployee] = useState("")
    const [selectedTemplate, setSelectedTemplate] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const reset = () => {
        setSelectedEmployee("")
        setSelectedTemplate("")
    }

    const handleStart = async () => {
        if (!selectedEmployee || !selectedTemplate) {
            toast.error("Pilih karyawan dan template")
            return
        }
        setSubmitting(true)
        try {
            const result = await startOnboarding(selectedEmployee, selectedTemplate)
            if (result.success) {
                toast.success("Onboarding dimulai!")
                onSuccess(selectedEmployee)
                reset()
                onOpenChange(false)
            } else {
                toast.error(result.error || "Gagal memulai onboarding")
            }
        } catch (error) {
            console.error("[startOnboarding] Error:", error)
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) reset()
                onOpenChange(v)
            }}
        >
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <div className="h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 -mx-6 -mt-4 mb-3" />
                    <DialogTitle className={NB.title}>
                        <UserPlus className="h-5 w-5" /> Mulai Onboarding
                    </DialogTitle>
                    <p className={NB.subtitle}>Pilih karyawan dan template onboarding</p>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    <div>
                        <label className={NB.label}>
                            Karyawan <span className={NB.labelRequired}>*</span>
                        </label>
                        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger className={NB.select}>
                                <SelectValue placeholder="Pilih karyawan" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.name}
                                        {e.department && (
                                            <span className="text-zinc-400 ml-1">
                                                — {e.department}
                                            </span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className={NB.label}>
                            Template <span className={NB.labelRequired}>*</span>
                        </label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                            <SelectTrigger className={NB.select}>
                                <SelectValue placeholder="Pilih template" />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name} ({t.taskCount} tugas)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className={NB.footer}>
                        <Button
                            variant="outline"
                            className={NB.cancelBtn}
                            onClick={() => {
                                reset()
                                onOpenChange(false)
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            className={NB.submitBtnGreen}
                            onClick={handleStart}
                            disabled={submitting || !selectedEmployee || !selectedTemplate}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memulai...
                                </>
                            ) : (
                                "Mulai Onboarding"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */
export default function OnboardingPage() {
    const queryClient = useQueryClient()
    const { data, isLoading } = useOnboarding()

    const [activeTab, setActiveTab] = useState<"template" | "karyawan">("template")
    const [createOpen, setCreateOpen] = useState(false)
    const [startOpen, setStartOpen] = useState(false)

    // Employee tab state
    const [employees, setEmployees] = useState<
        { id: string; name: string; department: string | null }[]
    >([])
    const [employeesLoaded, setEmployeesLoaded] = useState(false)
    const [employeesLoading, setEmployeesLoading] = useState(false)

    const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
    const [employeeOnboarding, setEmployeeOnboarding] = useState<
        EmployeeOnboardingStatus[]
    >([])
    const [onboardingLoading, setOnboardingLoading] = useState(false)

    // Load employees when tab is selected
    const loadEmployees = useCallback(async () => {
        if (employeesLoaded || employeesLoading) return
        setEmployeesLoading(true)
        try {
            const result = await getEmployees()
            setEmployees(
                (result || []).map(
                    (e: { id: string; name: string; department?: string | null }) => ({
                        id: e.id,
                        name: e.name,
                        department: e.department ?? null,
                    })
                )
            )
            setEmployeesLoaded(true)
        } catch (error) {
            console.error("[loadEmployees] Error:", error)
            toast.error("Gagal memuat daftar karyawan")
        } finally {
            setEmployeesLoading(false)
        }
    }, [employeesLoaded, employeesLoading])

    // Fetch onboarding for selected employee
    const fetchEmployeeOnboarding = useCallback(async (empId: string) => {
        if (!empId) {
            setEmployeeOnboarding([])
            return
        }
        setOnboardingLoading(true)
        try {
            const result = await getEmployeeOnboarding(empId)
            setEmployeeOnboarding(result)
        } catch (error) {
            console.error("[fetchEmployeeOnboarding] Error:", error)
            toast.error("Gagal memuat data onboarding")
            setEmployeeOnboarding([])
        } finally {
            setOnboardingLoading(false)
        }
    }, []) // no external deps — only uses args + setState

    const handleSelectEmployee = (empId: string) => {
        setSelectedEmployeeId(empId)
        fetchEmployeeOnboarding(empId)
    }

    const handleToggleTask = async (
        employeeId: string,
        templateId: string,
        taskKey: string,
        completed: boolean
    ) => {
        const result = await toggleOnboardingTask(
            employeeId,
            templateId,
            taskKey,
            completed
        )
        if (result.success) {
            fetchEmployeeOnboarding(employeeId)
        }
        return result
    }

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-teal-400" />
    }

    const { templates } = data
    const totalTasks = templates.reduce(
        (sum: number, t: { taskCount: number }) => sum + t.taskCount,
        0
    )

    return (
        <motion.div
            className="mf-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* ─── Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Title + Actions */}
                <div
                    className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-500 flex items-center justify-center">
                            <ClipboardCheck className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Onboarding Karyawan
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola template dan progress onboarding
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            variant="outline"
                            onClick={() =>
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.hcmOnboarding.all,
                                })
                            }
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className={NB.toolbarBtnPrimary}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Template
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-teal-500" />
                            <span className={NB.kpiLabel}>Template</span>
                        </div>
                        <span className={NB.kpiCount}>{templates.length}</span>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-zinc-400" />
                            <span className={NB.kpiLabel}>Total Tugas</span>
                        </div>
                        <span className={NB.kpiCount}>{totalTasks}</span>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-emerald-500" />
                            <span className={NB.kpiLabel}>Karyawan Aktif</span>
                        </div>
                        <span className={NB.kpiCount}>{employeeOnboarding.length}</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-5 py-2.5 flex items-center gap-1 bg-zinc-50/80 dark:bg-zinc-800/30">
                    {(
                        [
                            { key: "template", label: "Template", icon: ListChecks },
                            { key: "karyawan", label: "Karyawan Aktif", icon: Users },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setActiveTab(tab.key)
                                if (tab.key === "karyawan") loadEmployees()
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-none transition-all ${
                                activeTab === tab.key
                                    ? "bg-black text-white dark:bg-white dark:text-black"
                                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* ─── Tab Content ─── */}
            <AnimatePresence mode="wait">
                {activeTab === "template" ? (
                    <motion.div
                        key="template"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
                    >
                        {templates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                                <div className="w-16 h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center mb-4">
                                    <ClipboardCheck className="h-7 w-7 text-zinc-300" />
                                </div>
                                <span className="text-sm font-bold">
                                    Belum ada template onboarding
                                </span>
                                <span className="text-xs text-zinc-400 mt-1">
                                    Buat template pertama untuk memulai
                                </span>
                                <Button
                                    onClick={() => setCreateOpen(true)}
                                    className="mt-4 bg-teal-500 text-white border border-teal-600 hover:bg-teal-600 font-bold uppercase text-[10px] tracking-wider px-4 h-9 rounded-none"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Template
                                </Button>
                            </div>
                        ) : (
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map(
                                    (t: {
                                        id: string
                                        name: string
                                        taskCount: number
                                        createdAt: string
                                    }) => (
                                        <motion.div
                                            key={t.id}
                                            whileHover={{ y: -2 }}
                                            className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                                        >
                                            <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-black">
                                                        {t.name}
                                                    </span>
                                                    <span className="text-[9px] font-black px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700">
                                                        {t.taskCount} tugas
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-zinc-400 font-bold">
                                                    Dibuat:{" "}
                                                    {new Date(t.createdAt).toLocaleDateString(
                                                        "id-ID",
                                                        {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </span>
                                            </div>
                                        </motion.div>
                                    )
                                )}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="karyawan"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
                    >
                        <div className="p-5 space-y-4">
                            {/* Employee selector + Start button */}
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <label className={NB.label}>Pilih Karyawan</label>
                                    {employeesLoading ? (
                                        <div className="h-10 border-2 border-zinc-200 bg-zinc-100 animate-pulse" />
                                    ) : (
                                        <Select
                                            value={selectedEmployeeId}
                                            onValueChange={handleSelectEmployee}
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih karyawan untuk melihat progress" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map((e) => (
                                                    <SelectItem key={e.id} value={e.id}>
                                                        {e.name}
                                                        {e.department && (
                                                            <span className="text-zinc-400 ml-1">
                                                                — {e.department}
                                                            </span>
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <Button
                                    onClick={() => {
                                        if (templates.length === 0) {
                                            toast.error(
                                                "Buat template terlebih dahulu"
                                            )
                                            return
                                        }
                                        if (employees.length === 0) {
                                            toast.error("Tidak ada karyawan aktif")
                                            return
                                        }
                                        setStartOpen(true)
                                    }}
                                    className="bg-teal-500 text-white border border-teal-600 hover:bg-teal-600 font-bold uppercase text-[10px] tracking-wider px-4 h-10 rounded-none"
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Mulai
                                    Onboarding
                                </Button>
                            </div>

                            {/* Onboarding progress */}
                            {onboardingLoading ? (
                                <div className="flex items-center justify-center py-12 text-zinc-400">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    <span className="text-xs font-bold uppercase tracking-widest">
                                        Memuat progress...
                                    </span>
                                </div>
                            ) : selectedEmployeeId && employeeOnboarding.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                    <Users className="h-8 w-8 text-zinc-300 mb-2" />
                                    <span className="text-sm font-bold">
                                        Belum ada onboarding aktif
                                    </span>
                                    <span className="text-xs mt-1">
                                        Klik &quot;Mulai Onboarding&quot; untuk memulai
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {employeeOnboarding.map((ob) => (
                                        <OnboardingChecklist
                                            key={`${ob.employeeId}-${ob.templateId}`}
                                            data={ob}
                                            onToggleTask={handleToggleTask}
                                        />
                                    ))}
                                </div>
                            )}

                            {!selectedEmployeeId && !onboardingLoading && (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                    <Users className="h-8 w-8 text-zinc-300 mb-2" />
                                    <span className="text-sm font-bold">
                                        Pilih karyawan di atas
                                    </span>
                                    <span className="text-xs mt-1">
                                        Untuk melihat progress onboarding
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dialogs */}
            <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
            <StartOnboardingDialog
                open={startOpen}
                onOpenChange={setStartOpen}
                employees={employees}
                templates={templates}
                onSuccess={(empId) => {
                    setSelectedEmployeeId(empId)
                    fetchEmployeeOnboarding(empId)
                }}
            />
        </motion.div>
    )
}
