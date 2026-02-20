"use client"

import React, { useState, useEffect, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    Users,
    UserPlus,
    Search,
    RefreshCw,
    Trash2,
    Pencil,
    BarChart3,
    FileText,
    CheckSquare,
    Square,
    MinusSquare,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import {
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    bulkDeactivateEmployees,
    getEmployees,
    getDistinctDepartments,
    getDistinctPositions,
} from "@/app/actions/hcm"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"

// ==============================================================================
// Types
// ==============================================================================

interface EmployeeRow {
    id: string
    employeeCode: string
    name: string
    firstName: string
    lastName?: string | null
    email?: string | null
    phone?: string | null
    department: string
    position: string
    status: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED"
    joinDate: string
    baseSalary: number
}

type TabKey = "list" | "analytics" | "reports"

const TAB_CONFIG = [
    { key: "list" as TabKey, label: "Daftar Karyawan", icon: Users, color: "bg-emerald-100 text-emerald-900 border-emerald-400" },
    { key: "analytics" as TabKey, label: "Analitik SDM", icon: BarChart3, color: "bg-blue-100 text-blue-900 border-blue-400" },
    { key: "reports" as TabKey, label: "Laporan", icon: FileText, color: "bg-amber-100 text-amber-900 border-amber-400" },
]

const EMPTY_FORM = {
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    joinDate: "",
    status: "ACTIVE" as EmployeeRow["status"],
    baseSalary: "",
}

const STATUS_BADGE: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-300",
    ON_LEAVE: "bg-amber-100 text-amber-700 border-amber-300",
    INACTIVE: "bg-zinc-100 text-zinc-600 border-zinc-300",
    TERMINATED: "bg-red-100 text-red-700 border-red-300",
}

const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "Aktif",
    ON_LEAVE: "Cuti",
    INACTIVE: "Non-Aktif",
    TERMINATED: "Terminasi",
}

const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

// ==============================================================================
// Component
// ==============================================================================

interface Props {
    initialEmployees: EmployeeRow[]
}

export function EmployeeMasterClient({ initialEmployees }: Props) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isPending, startTransition] = useTransition()

    // Data
    const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees)

    // Filters
    const [searchTerm, setSearchTerm] = useState("")
    const [departmentFilter, setDepartmentFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")

    // Tabs
    const [activeTab, setActiveTab] = useState<TabKey>("list")

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Dialog
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<EmployeeRow | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [submitting, setSubmitting] = useState(false)

    // Confirm delete dialog
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const [departmentOptions, setDepartmentOptions] = useState<ComboboxOption[]>([])
    const [positionOptions, setPositionOptions] = useState<ComboboxOption[]>([])

    useEffect(() => {
        getDistinctDepartments().then(deps => {
            setDepartmentOptions(deps.map(d => ({ value: d, label: d })))
        }).catch(() => {})
        getDistinctPositions().then(pos => {
            setPositionOptions(pos.map(p => ({ value: p, label: p })))
        }).catch(() => {})
    }, [])

    // Derived
    const departments = useMemo(
        () => [...new Set(employees.map((e) => e.department))].sort(),
        [employees]
    )

    const filteredEmployees = useMemo(() => {
        return employees.filter((e) => {
            const kw = searchTerm.toLowerCase()
            const matchSearch =
                e.name.toLowerCase().includes(kw) ||
                e.employeeCode.toLowerCase().includes(kw) ||
                (e.email || "").toLowerCase().includes(kw)
            const matchDept = departmentFilter === "all" || e.department === departmentFilter
            const matchStatus = statusFilter === "all" || e.status === statusFilter
            return matchSearch && matchDept && matchStatus
        })
    }, [employees, searchTerm, departmentFilter, statusFilter])

    // Selection helpers
    const allVisibleSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.id))
    const someVisibleSelected = filteredEmployees.some((e) => selectedIds.has(e.id))

    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredEmployees.map((e) => e.id)))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Reload
    const handleReload = () => {
        startTransition(async () => {
            try {
                const rows = await getEmployees({ includeInactive: true })
                setEmployees(rows as EmployeeRow[])
                setSelectedIds(new Set())
                toast.success("Data berhasil dimuat ulang")
            } catch {
                toast.error("Gagal memuat data karyawan")
            }
        })
    }

    // Create / Edit dialog
    const openCreateDialog = () => {
        setEditing(null)
        setForm({ ...EMPTY_FORM, joinDate: new Date().toISOString().slice(0, 10) })
        setDialogOpen(true)
    }

    const openEditDialog = (emp: EmployeeRow) => {
        setEditing(emp)
        setForm({
            employeeCode: emp.employeeCode,
            firstName: emp.firstName,
            lastName: emp.lastName || "",
            email: emp.email || "",
            phone: emp.phone || "",
            department: emp.department,
            position: emp.position,
            joinDate: emp.joinDate,
            status: emp.status,
            baseSalary: emp.baseSalary ? String(emp.baseSalary) : "",
        })
        setDialogOpen(true)
    }

    const handleSubmit = async () => {
        if (!form.firstName.trim() || !form.department.trim() || !form.position.trim() || !form.joinDate) {
            toast.error("Nama, departemen, posisi, dan tanggal masuk wajib diisi")
            return
        }
        setSubmitting(true)
        try {
            const payload = {
                employeeCode: editing ? undefined : form.employeeCode || undefined,
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                phone: form.phone,
                department: form.department,
                position: form.position,
                joinDate: form.joinDate,
                status: form.status,
                baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
            }
            const result = editing
                ? await updateEmployee(editing.id, payload)
                : await createEmployee(payload)

            if (!result.success) {
                toast.error("error" in result ? String(result.error) : "Gagal menyimpan karyawan")
                return
            }
            toast.success(editing ? "Data karyawan berhasil diperbarui" : "Karyawan berhasil ditambahkan")
            setDialogOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
            handleReload()
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan data")
        } finally {
            setSubmitting(false)
        }
    }

    // Single deactivate
    const handleDeactivate = async (emp: EmployeeRow) => {
        const result = await deactivateEmployee(emp.id)
        if (!result.success) {
            toast.error("error" in result ? String(result.error) : "Gagal menonaktifkan karyawan")
            return
        }
        toast.success(`${emp.name} berhasil dinonaktifkan`)
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
        handleReload()
    }

    // Bulk deactivate
    const handleBulkDeactivate = async () => {
        setBulkDeleting(true)
        try {
            const ids = Array.from(selectedIds)
            const result = await bulkDeactivateEmployees(ids)
            if (!result.success) {
                toast.error("error" in result ? String(result.error) : "Gagal menonaktifkan karyawan")
                return
            }
            const cnt = "count" in result ? result.count : ids.length
            toast.success(`${cnt} karyawan berhasil dinonaktifkan`)
            setSelectedIds(new Set())
            setConfirmOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
            handleReload()
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setBulkDeleting(false)
        }
    }

    // Analytics data
    const totalEmployees = employees.length
    const activeCount = employees.filter((e) => e.status === "ACTIVE").length
    const onLeaveCount = employees.filter((e) => e.status === "ON_LEAVE").length
    const inactiveCount = employees.filter((e) => e.status === "INACTIVE" || e.status === "TERMINATED").length

    // Selected employees that are deactivatable
    const deactivatableSelected = Array.from(selectedIds).filter((id) => {
        const emp = employees.find((e) => e.id === id)
        return emp && emp.status !== "INACTIVE" && emp.status !== "TERMINATED"
    })

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-wider">
                        Data Karyawan
                    </h1>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                        Kelola data master karyawan, informasi pribadi & kepegawaian
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReload}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-black font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                        Muat Ulang
                    </button>
                    <button
                        onClick={openCreateDialog}
                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Tambah Karyawan
                    </button>
                </div>
            </div>

            {/* ── NB Tab Bar ── */}
            <div className="flex flex-wrap gap-2">
                {TAB_CONFIG.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 border-2 border-black
                                text-[10px] font-black uppercase tracking-wider transition-all
                                ${isActive
                                    ? `${tab.color} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                                    : "bg-white text-zinc-500 hover:bg-zinc-50"
                                }
                            `}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                            {tab.key === "list" && (
                                <span className="ml-1 bg-black text-white text-[8px] px-1.5 py-0.5 font-mono">
                                    {employees.length}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab: Daftar Karyawan ── */}
            {activeTab === "list" && (
                <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                    Cari Karyawan
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                                    <Input
                                        placeholder="Nama, kode, email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 border-2 border-black font-bold h-9 rounded-none"
                                    />
                                </div>
                            </div>
                            <div className="min-w-[160px]">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                    Departemen
                                </label>
                                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                    <SelectTrigger className="border-2 border-black font-bold h-9 rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        {departments.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-[140px]">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                    Status
                                </label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="border-2 border-black font-bold h-9 rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        <SelectItem value="ACTIVE">Aktif</SelectItem>
                                        <SelectItem value="ON_LEAVE">Cuti</SelectItem>
                                        <SelectItem value="INACTIVE">Non-Aktif</SelectItem>
                                        <SelectItem value="TERMINATED">Terminasi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Bulk action bar */}
                    {selectedIds.size > 0 && (
                        <div className="bg-red-50 border-2 border-red-400 p-3 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(220,38,38,0.4)]">
                            <span className="text-xs font-black uppercase tracking-wider text-red-700">
                                {selectedIds.size} karyawan dipilih
                            </span>
                            <button
                                onClick={() => {
                                    if (deactivatableSelected.length === 0) {
                                        toast.error("Karyawan yang dipilih sudah non-aktif")
                                        return
                                    }
                                    setConfirmOpen(true)
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-red-600 bg-red-600 text-white font-black uppercase text-[10px] tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <Trash2 className="h-3 w-3" />
                                Nonaktifkan Terpilih
                            </button>
                        </div>
                    )}

                    {/* Employee table */}
                    <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Daftar Karyawan
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400 font-mono">
                                {filteredEmployees.length} dari {employees.length}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-zinc-100 border-b-2 border-black">
                                        <th className="text-left px-3 py-2 w-10">
                                            <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-black">
                                                {allVisibleSelected ? (
                                                    <CheckSquare className="h-4 w-4" />
                                                ) : someVisibleSelected ? (
                                                    <MinusSquare className="h-4 w-4" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Kode</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Nama</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Posisi</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Departemen</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Status</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Tgl Masuk</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right px-3 py-2">Gaji Pokok</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left px-3 py-2">Email</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center px-3 py-2">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-8 text-zinc-400 text-xs font-bold">
                                                Data karyawan tidak ditemukan
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map((emp) => {
                                            const isSelected = selectedIds.has(emp.id)
                                            return (
                                                <tr
                                                    key={emp.id}
                                                    className={`border-b border-zinc-200 last:border-b-0 transition-colors ${
                                                        isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                                                    }`}
                                                >
                                                    <td className="px-3 py-2">
                                                        <button
                                                            onClick={() => toggleSelect(emp.id)}
                                                            className="text-zinc-500 hover:text-black"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="h-4 w-4 text-blue-600" />
                                                            ) : (
                                                                <Square className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold">{emp.employeeCode}</td>
                                                    <td className="px-3 py-2 text-sm font-bold">{emp.name}</td>
                                                    <td className="px-3 py-2 text-xs text-zinc-600">{emp.position}</td>
                                                    <td className="px-3 py-2 text-xs text-zinc-600">{emp.department}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 border ${STATUS_BADGE[emp.status] || "bg-zinc-100 text-zinc-600 border-zinc-300"}`}>
                                                            {STATUS_LABEL[emp.status] || emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono text-zinc-600">
                                                        {new Date(emp.joinDate).toLocaleDateString("id-ID")}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                                        {formatIDR(emp.baseSalary || 0)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-zinc-500">{emp.email || "-"}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => openEditDialog(emp)}
                                                                className="p-1.5 border border-zinc-300 hover:border-black hover:bg-zinc-100 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            {emp.status !== "INACTIVE" && emp.status !== "TERMINATED" && (
                                                                <button
                                                                    onClick={() => handleDeactivate(emp)}
                                                                    className="p-1.5 border border-red-300 text-red-600 hover:border-red-600 hover:bg-red-50 transition-colors"
                                                                    title="Nonaktifkan"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab: Analitik SDM ── */}
            {activeTab === "analytics" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Total Karyawan", value: totalEmployees, color: "border-black" },
                            { label: "Karyawan Aktif", value: activeCount, color: "border-emerald-500" },
                            { label: "Sedang Cuti", value: onLeaveCount, color: "border-amber-500" },
                            { label: "Non-Aktif / Terminasi", value: inactiveCount, color: "border-zinc-400" },
                        ].map((kpi) => (
                            <div
                                key={kpi.label}
                                className={`bg-white border-2 ${kpi.color} p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
                            >
                                <div className="text-3xl font-black">{kpi.value}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                                    {kpi.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Department breakdown */}
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Distribusi Per Departemen
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-200">
                            {departments.map((dept) => {
                                const deptEmployees = employees.filter((e) => e.department === dept)
                                const deptActive = deptEmployees.filter((e) => e.status === "ACTIVE").length
                                return (
                                    <div key={dept} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-bold">{dept}</span>
                                            <span className="text-[9px] text-zinc-400 font-mono ml-2">
                                                {deptActive} aktif
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-32 bg-zinc-100 h-2 border border-zinc-300">
                                                <div
                                                    className="h-full bg-black"
                                                    style={{ width: `${totalEmployees > 0 ? (deptEmployees.length / totalEmployees) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-black font-mono w-8 text-right">
                                                {deptEmployees.length}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab: Laporan ── */}
            {activeTab === "reports" && (
                <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                        Laporan Kepegawaian
                    </div>
                    <p className="text-sm text-zinc-600 font-medium">
                        Data SDM kini bersumber dari database Employee, Attendance, dan LeaveRequest.
                    </p>
                    <p className="text-sm text-zinc-600 font-medium mt-2">
                        Gunakan filter daftar karyawan untuk mengekspor segmen data sesuai kebutuhan.
                    </p>
                </div>
            )}

            {/* ── Create/Edit Employee Dialog ── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <UserPlus className="h-5 w-5" />
                            {editing ? "Edit Karyawan" : "Tambah Karyawan"}
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Lengkapi informasi master karyawan
                        </p>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-6">
                            {/* Identity section */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Identitas</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    {!editing && (
                                        <div>
                                            <label className={NB.label}>Kode Karyawan</label>
                                            <Input
                                                className={NB.inputMono}
                                                value={form.employeeCode}
                                                onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))}
                                                placeholder="EMP-2026-001 (opsional)"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className={NB.label}>
                                            Nama Depan <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Input
                                            className={NB.input}
                                            value={form.firstName}
                                            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Nama Belakang</label>
                                        <Input
                                            className={NB.input}
                                            value={form.lastName}
                                            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Email</label>
                                        <Input
                                            type="email"
                                            className={NB.input}
                                            value={form.email}
                                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Telepon</label>
                                        <Input
                                            className={NB.input}
                                            value={form.phone}
                                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Employment section */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Data Kepegawaian</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    <div>
                                        <label className={NB.label}>
                                            Departemen <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <ComboboxWithCreate
                                            options={departmentOptions}
                                            value={form.department}
                                            onChange={(v) => setForm((p) => ({ ...p, department: v }))}
                                            placeholder="Pilih departemen..."
                                            searchPlaceholder="Cari departemen..."
                                            emptyMessage="Departemen tidak ditemukan."
                                            createLabel="+ Tambah Departemen"
                                            onCreate={async (name) => {
                                                setDepartmentOptions(prev => [...prev, { value: name, label: name }].sort((a, b) => a.label.localeCompare(b.label)))
                                                return name
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>
                                            Posisi <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <ComboboxWithCreate
                                            options={positionOptions}
                                            value={form.position}
                                            onChange={(v) => setForm((p) => ({ ...p, position: v }))}
                                            placeholder="Pilih posisi..."
                                            searchPlaceholder="Cari posisi..."
                                            emptyMessage="Posisi tidak ditemukan."
                                            createLabel="+ Tambah Posisi"
                                            onCreate={async (name) => {
                                                setPositionOptions(prev => [...prev, { value: name, label: name }].sort((a, b) => a.label.localeCompare(b.label)))
                                                return name
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>
                                            Tanggal Masuk <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Input
                                            type="date"
                                            className={NB.inputMono}
                                            value={form.joinDate}
                                            onChange={(e) => setForm((p) => ({ ...p, joinDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Status</label>
                                        <Select
                                            value={form.status}
                                            onValueChange={(v) => setForm((p) => ({ ...p, status: v as EmployeeRow["status"] }))}
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">Aktif</SelectItem>
                                                <SelectItem value="ON_LEAVE">Sedang Cuti</SelectItem>
                                                <SelectItem value="INACTIVE">Non-Aktif</SelectItem>
                                                <SelectItem value="TERMINATED">Terminasi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={NB.label}>Gaji Pokok (Rp)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            className={NB.inputMono}
                                            value={form.baseSalary}
                                            onChange={(e) => setForm((p) => ({ ...p, baseSalary: e.target.value }))}
                                            placeholder="7500000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                        <div className={NB.footer}>
                            <button
                                onClick={() => setDialogOpen(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className={NB.submitBtn}
                            >
                                {submitting
                                    ? "Menyimpan..."
                                    : editing
                                        ? "Simpan Perubahan"
                                        : "Tambah Karyawan"}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Bulk Delete Dialog ── */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className="bg-red-600 text-white px-6 py-4">
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Konfirmasi Nonaktifkan
                        </DialogTitle>
                        <p className="text-red-200 text-[11px] font-bold mt-0.5">
                            Tindakan ini akan menonaktifkan karyawan yang dipilih
                        </p>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <p className="text-sm font-bold">
                            Anda akan menonaktifkan <span className="text-red-600">{deactivatableSelected.length}</span> karyawan:
                        </p>
                        <div className="border-2 border-black max-h-40 overflow-y-auto">
                            {deactivatableSelected.map((id) => {
                                const emp = employees.find((e) => e.id === id)
                                if (!emp) return null
                                return (
                                    <div key={id} className="px-3 py-1.5 border-b border-zinc-200 last:border-b-0 flex items-center justify-between">
                                        <span className="text-xs font-bold">{emp.name}</span>
                                        <span className="text-[9px] font-mono text-zinc-400">{emp.employeeCode}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                        <div className={NB.footer}>
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBulkDeactivate}
                                disabled={bulkDeleting}
                                className="bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none"
                            >
                                {bulkDeleting ? "Memproses..." : "Ya, Nonaktifkan"}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
