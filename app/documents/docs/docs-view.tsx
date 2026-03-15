"use client"

import { useState, useMemo, useTransition } from "react"
import {
    Search,
    Plus,
    Pencil,
    Layers,
    ShieldCheck,
    Download,
    Clock,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import {
    createDocumentSystemRole,
    updateDocumentSystemRole,
    updateRolePermissionsFromDocuments,
} from "@/app/actions/documents-system"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SystemRoleItem = {
    id: string
    code: string
    name: string
    description: string
    isSystem: boolean
    permissions: string[]
    updatedAt: string | Date
}

type PermissionOption = { key: string; label: string; group: string }

type AuditEvent = {
    id: string
    roleId: string
    roleCode: string
    roleName: string | null
    eventType: string
    actorLabel: string | null
    beforePermissions: string[]
    afterPermissions: string[]
    changedPermissions: string[]
    createdAt: string | Date
}

type ModuleCatalogItem = {
    key: string
    name: string
    model: string
    action: string
    roleRequired: string
    description: string
}

interface DocsViewProps {
    roles: SystemRoleItem[]
    roleAuditEvents: AuditEvent[]
    permissionOptions: PermissionOption[]
    moduleCatalog: ModuleCatalogItem[]
    currentUserRole: string
    currentSystemRoleCode: string | null
    canManage: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(raw: string | Date): string {
    try {
        const d = typeof raw === "string" ? new Date(raw) : raw
        if (isNaN(d.getTime())) return "-"
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
        return "-"
    }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [headers.map(escape).join(",")]
    for (const row of rows) {
        lines.push(row.map(escape).join(","))
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DocsView({
    roles,
    roleAuditEvents,
    permissionOptions,
    moduleCatalog: _moduleCatalog,
    currentUserRole,
    currentSystemRoleCode,
    canManage,
}: DocsViewProps) {
    const queryClient = useQueryClient()
    const { refreshFromServer } = useWorkflowConfig()

    // ---- Section A state ----
    const [roleSearch, setRoleSearch] = useState("")
    const [roleDialogOpen, setRoleDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<SystemRoleItem | null>(null)
    const [permDialogOpen, setPermDialogOpen] = useState(false)
    const [permRole, setPermRole] = useState<SystemRoleItem | null>(null)

    // Role form
    const [roleForm, setRoleForm] = useState({ code: "", name: "", description: "", permissions: [] as string[] })
    const [savingRole, startSavingRole] = useTransition()

    // Perm form
    const [permSelections, setPermSelections] = useState<string[]>([])
    const [savingPerm, startSavingPerm] = useTransition()

    // ---- Section B state ----
    const [auditSearch, setAuditSearch] = useState("")
    const [auditRoleFilter, setAuditRoleFilter] = useState("__all__")
    const [auditEventFilter, setAuditEventFilter] = useState("__all__")
    const [auditActorFilter, setAuditActorFilter] = useState("__all__")
    const [auditDateFrom, setAuditDateFrom] = useState("")
    const [auditDateTo, setAuditDateTo] = useState("")
    const [auditPage, setAuditPage] = useState(1)
    const [auditPageSize, setAuditPageSize] = useState(15)

    // ---- KPI data ----
    const totalRoles = roles.length
    const customRoles = roles.filter((r) => !r.isSystem).length
    const totalAuditEvents = roleAuditEvents.length

    // ---- Section A: filtered roles ----
    const filteredRoles = useMemo(() => {
        const q = roleSearch.trim().toLowerCase()
        if (!q) return roles
        return roles.filter(
            (r) =>
                r.code.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q)
        )
    }, [roles, roleSearch])

    // ---- Section B: filtered audit ----
    const auditRoleCodes = useMemo(() => Array.from(new Set(roleAuditEvents.map((e) => e.roleCode))).sort(), [roleAuditEvents])
    const auditEventTypes = useMemo(() => Array.from(new Set(roleAuditEvents.map((e) => e.eventType))).sort(), [roleAuditEvents])
    const auditActors = useMemo(() => Array.from(new Set(roleAuditEvents.map((e) => e.actorLabel || "-"))).sort(), [roleAuditEvents])

    const filteredAudit = useMemo(() => {
        let items = [...roleAuditEvents]

        const q = auditSearch.trim().toLowerCase()
        if (q) {
            items = items.filter(
                (e) =>
                    e.roleCode.toLowerCase().includes(q) ||
                    (e.roleName || "").toLowerCase().includes(q) ||
                    (e.actorLabel || "").toLowerCase().includes(q) ||
                    e.eventType.toLowerCase().includes(q) ||
                    e.changedPermissions.some((p) => p.toLowerCase().includes(q))
            )
        }

        if (auditRoleFilter !== "__all__") {
            items = items.filter((e) => e.roleCode === auditRoleFilter)
        }
        if (auditEventFilter !== "__all__") {
            items = items.filter((e) => e.eventType === auditEventFilter)
        }
        if (auditActorFilter !== "__all__") {
            items = items.filter((e) => (e.actorLabel || "-") === auditActorFilter)
        }
        if (auditDateFrom) {
            const from = new Date(auditDateFrom + "T00:00:00")
            if (!isNaN(from.getTime())) {
                items = items.filter((e) => new Date(e.createdAt) >= from)
            }
        }
        if (auditDateTo) {
            const to = new Date(auditDateTo + "T23:59:59.999")
            if (!isNaN(to.getTime())) {
                items = items.filter((e) => new Date(e.createdAt) <= to)
            }
        }

        return items
    }, [roleAuditEvents, auditSearch, auditRoleFilter, auditEventFilter, auditActorFilter, auditDateFrom, auditDateTo])

    const auditTotalPages = Math.max(1, Math.ceil(filteredAudit.length / auditPageSize))
    const clampedAuditPage = Math.min(auditPage, auditTotalPages)
    const auditSlice = filteredAudit.slice((clampedAuditPage - 1) * auditPageSize, clampedAuditPage * auditPageSize)
    const auditStartIdx = (clampedAuditPage - 1) * auditPageSize + 1
    const auditEndIdx = Math.min(clampedAuditPage * auditPageSize, filteredAudit.length)

    // ---- Permission groups ----
    const permissionGroups = useMemo(() => {
        const map = new Map<string, PermissionOption[]>()
        for (const opt of permissionOptions) {
            const group = opt.group || "LAINNYA"
            if (!map.has(group)) map.set(group, [])
            map.get(group)!.push(opt)
        }
        return Array.from(map.entries())
    }, [permissionOptions])

    // ---- Handlers ----

    function openCreateRole() {
        setEditingRole(null)
        setRoleForm({ code: "", name: "", description: "", permissions: [] })
        setRoleDialogOpen(true)
    }

    function openEditRole(role: SystemRoleItem) {
        setEditingRole(role)
        setRoleForm({
            code: role.code,
            name: role.name,
            description: role.description,
            permissions: [...role.permissions],
        })
        setRoleDialogOpen(true)
    }

    function openPermManager(role: SystemRoleItem) {
        setPermRole(role)
        setPermSelections([...role.permissions])
        setPermDialogOpen(true)
    }

    function togglePermInForm(key: string) {
        setRoleForm((prev) => {
            const has = prev.permissions.includes(key)
            return {
                ...prev,
                permissions: has ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key],
            }
        })
    }

    function togglePermSelection(key: string) {
        setPermSelections((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
    }

    async function invalidateAndRefresh(roleCode?: string) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
        if (roleCode && currentSystemRoleCode && roleCode === currentSystemRoleCode) {
            await refreshFromServer()
        }
    }

    function handleSaveRole() {
        if (!roleForm.code.trim() || !roleForm.name.trim()) {
            toast.error("Kode dan nama role wajib diisi")
            return
        }

        startSavingRole(async () => {
            try {
                if (editingRole) {
                    const result = await updateDocumentSystemRole(editingRole.id, {
                        code: roleForm.code.trim(),
                        name: roleForm.name.trim(),
                        description: roleForm.description.trim() || undefined,
                        permissions: roleForm.permissions,
                    })
                    if (!result.success) {
                        toast.error(result.error || "Gagal memperbarui role")
                        return
                    }
                    toast.success("Role berhasil diperbarui")
                    await invalidateAndRefresh(roleForm.code.trim().toUpperCase())
                } else {
                    const result = await createDocumentSystemRole({
                        code: roleForm.code.trim(),
                        name: roleForm.name.trim(),
                        description: roleForm.description.trim() || undefined,
                        permissions: roleForm.permissions,
                    })
                    if (!result.success) {
                        toast.error(result.error || "Gagal membuat role")
                        return
                    }
                    toast.success("Role baru berhasil dibuat")
                    await invalidateAndRefresh()
                }
                setRoleDialogOpen(false)
            } catch (err: any) {
                toast.error(err?.message || "Terjadi kesalahan")
            }
        })
    }

    function handleSavePerm() {
        if (!permRole) return

        startSavingPerm(async () => {
            try {
                const result = await updateRolePermissionsFromDocuments(permRole.id, {
                    permissions: permSelections,
                })
                if (!result.success) {
                    toast.error(result.error || "Gagal menyimpan permissions")
                    return
                }
                toast.success("Permissions berhasil diperbarui")
                await invalidateAndRefresh(permRole.code)
                setPermDialogOpen(false)
            } catch (err: any) {
                toast.error(err?.message || "Terjadi kesalahan")
            }
        })
    }

    function handleExportCsv() {
        const headers = ["Waktu", "Role Code", "Role Name", "Event", "Aktor", "Perubahan"]
        const rows = filteredAudit.map((e) => [
            formatDateTime(e.createdAt),
            e.roleCode,
            e.roleName || "-",
            e.eventType,
            e.actorLabel || "-",
            e.changedPermissions.join("; "),
        ])
        downloadCsv(`audit-trail-roles-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
        toast.success("CSV berhasil diunduh")
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="mf-page">
            {/* =========================================================== */}
            {/* COMMAND HEADER                                               */}
            {/* =========================================================== */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-amber-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Dokumentasi Sistem
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelola role, hak akses modul, dan audit trail
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest border-2 rounded-sm ${
                                canManage
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                    : "border-zinc-300 bg-zinc-100 text-zinc-500"
                            }`}
                        >
                            {canManage ? "Mode Kelola" : "View Only"}
                        </span>
                        <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-zinc-300 rounded-sm bg-white text-zinc-600">
                            {currentUserRole}
                        </span>
                    </div>
                </div>
            </div>

            {/* =========================================================== */}
            {/* KPI PULSE STRIP                                              */}
            {/* =========================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {/* Total Role */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4 border-l-[5px] border-l-amber-400">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Role</p>
                            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{totalRoles}</p>
                        </div>
                        <div className="h-10 w-10 border-2 border-amber-300 bg-amber-50 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-amber-500" />
                        </div>
                    </div>
                </div>

                {/* Custom Role */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4 border-l-[5px] border-l-blue-400">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Custom Role</p>
                            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{customRoles}</p>
                        </div>
                        <div className="h-10 w-10 border-2 border-blue-300 bg-blue-50 flex items-center justify-center">
                            <Layers className="h-5 w-5 text-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Event Audit */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4 border-l-[5px] border-l-indigo-400">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Event Audit</p>
                            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{totalAuditEvents}</p>
                        </div>
                        <div className="h-10 w-10 border-2 border-indigo-300 bg-indigo-50 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-indigo-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================== */}
            {/* SECTION A: ROLE SISTEM & MODUL                               */}
            {/* =========================================================== */}
            <div className="mt-6">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Section heading */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b-2 border-black flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                            Role Sistem & Modul
                        </span>
                    </div>

                    {/* Search + add button */}
                    <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                placeholder="Cari role berdasarkan kode, nama, deskripsi..."
                                className="pl-9 border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-9 font-medium text-sm placeholder:italic placeholder:text-zinc-400 focus:border-black dark:focus:border-white"
                            />
                        </div>
                        {canManage && (
                            <Button
                                onClick={openCreateRole}
                                className="bg-black text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:shadow-none transition-all font-black uppercase text-[10px] tracking-widest rounded-none h-9 px-4"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                Tambah Role
                            </Button>
                        )}
                    </div>

                    {/* Roles table */}
                    {filteredRoles.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <ShieldCheck className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-zinc-400">Tidak ada role ditemukan</p>
                            <p className="text-xs text-zinc-400 mt-1">Coba ubah kata kunci pencarian</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black">
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                            Code
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                            Nama Role
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left hidden md:table-cell">
                                            Deskripsi
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                            Permissions
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                            Tipe
                                        </th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRoles.map((role) => (
                                        <tr
                                            key={role.id}
                                            className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            <td className="px-3 py-2 font-mono font-bold text-xs text-zinc-700 dark:text-zinc-300">
                                                {role.code}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-zinc-900 dark:text-white">
                                                {role.name}
                                            </td>
                                            <td className="px-3 py-2 text-zinc-500 text-xs hidden md:table-cell max-w-[200px] truncate">
                                                {role.description || "-"}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {role.permissions.slice(0, 3).map((p) => (
                                                        <span
                                                            key={p}
                                                            className="font-mono text-[9px] px-1.5 py-0.5 border rounded-sm bg-zinc-100 text-zinc-600 border-zinc-300"
                                                        >
                                                            {p}
                                                        </span>
                                                    ))}
                                                    {role.permissions.length > 3 && (
                                                        <span className="font-mono text-[9px] px-1.5 py-0.5 border rounded-sm bg-zinc-100 text-zinc-500 border-zinc-300">
                                                            +{role.permissions.length - 3}
                                                        </span>
                                                    )}
                                                    {role.permissions.length === 0 && (
                                                        <span className="text-[10px] text-zinc-400 italic">Tidak ada</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {role.isSystem ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded-sm bg-zinc-100 text-zinc-600 border-zinc-300">
                                                        System
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded-sm bg-blue-50 text-blue-700 border-blue-300">
                                                        Custom
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {canManage && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openPermManager(role)}
                                                            className="border-2 border-black rounded-none h-7 px-2 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                        >
                                                            <Layers className="h-3 w-3 mr-1" />
                                                            Permissions
                                                        </Button>
                                                    )}
                                                    {canManage && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditRole(role)}
                                                            disabled={role.isSystem}
                                                            className="border-2 border-black rounded-none h-7 px-2 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
                                                        >
                                                            <Pencil className="h-3 w-3 mr-1" />
                                                            Edit
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================== */}
            {/* SECTION B: RIWAYAT PERUBAHAN HAK AKSES (AUDIT TRAIL)         */}
            {/* =========================================================== */}
            <div className="mt-6">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Section heading */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b-2 border-black flex items-center gap-2">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                            Riwayat Perubahan Hak Akses
                        </span>
                    </div>

                    {/* Filter bar */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 space-y-2">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    value={auditSearch}
                                    onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1) }}
                                    placeholder="Cari audit..."
                                    className="pl-9 border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 font-medium text-xs placeholder:italic placeholder:text-zinc-400 focus:border-black dark:focus:border-white"
                                />
                            </div>

                            {/* Role filter */}
                            <select
                                value={auditRoleFilter}
                                onChange={(e) => { setAuditRoleFilter(e.target.value); setAuditPage(1) }}
                                className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 px-2 text-xs font-medium bg-white dark:bg-zinc-800 focus:border-black dark:focus:border-white"
                            >
                                <option value="__all__">Semua Role</option>
                                {auditRoleCodes.map((code) => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>

                            {/* Event type filter */}
                            <select
                                value={auditEventFilter}
                                onChange={(e) => { setAuditEventFilter(e.target.value); setAuditPage(1) }}
                                className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 px-2 text-xs font-medium bg-white dark:bg-zinc-800 focus:border-black dark:focus:border-white"
                            >
                                <option value="__all__">Semua Event</option>
                                {auditEventTypes.map((et) => (
                                    <option key={et} value={et}>{et}</option>
                                ))}
                            </select>

                            {/* Actor filter */}
                            <select
                                value={auditActorFilter}
                                onChange={(e) => { setAuditActorFilter(e.target.value); setAuditPage(1) }}
                                className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 px-2 text-xs font-medium bg-white dark:bg-zinc-800 focus:border-black dark:focus:border-white"
                            >
                                <option value="__all__">Semua Aktor</option>
                                {auditActors.map((a) => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>

                            {/* Date from */}
                            <Input
                                type="date"
                                value={auditDateFrom}
                                onChange={(e) => { setAuditDateFrom(e.target.value); setAuditPage(1) }}
                                className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 text-xs font-medium w-[140px] focus:border-black dark:focus:border-white"
                            />

                            {/* Date to */}
                            <Input
                                type="date"
                                value={auditDateTo}
                                onChange={(e) => { setAuditDateTo(e.target.value); setAuditPage(1) }}
                                className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-8 text-xs font-medium w-[140px] focus:border-black dark:focus:border-white"
                            />

                            {/* CSV export */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportCsv}
                                className="border-2 border-black rounded-none h-8 px-3 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all whitespace-nowrap"
                            >
                                <Download className="h-3 w-3 mr-1" />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    {/* Audit table */}
                    {filteredAudit.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <Clock className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-zinc-400">Tidak ada event audit ditemukan</p>
                            <p className="text-xs text-zinc-400 mt-1">Belum ada perubahan hak akses yang tercatat</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black">
                                            <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                                Waktu
                                            </th>
                                            <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                                Role
                                            </th>
                                            <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                                Event
                                            </th>
                                            <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left hidden md:table-cell">
                                                Aktor
                                            </th>
                                            <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                                Perubahan
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditSlice.map((event) => (
                                            <tr
                                                key={event.id}
                                                className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                                            >
                                                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                                                    {formatDateTime(event.createdAt)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                                        {event.roleCode}
                                                    </span>
                                                    {event.roleName && (
                                                        <span className="text-[10px] text-zinc-400 ml-1">
                                                            ({event.roleName})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded-sm bg-indigo-50 text-indigo-700 border-indigo-300">
                                                        {event.eventType}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-zinc-500 hidden md:table-cell max-w-[180px] truncate">
                                                    {event.actorLabel || "-"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {event.changedPermissions.slice(0, 4).map((p) => (
                                                            <span
                                                                key={p}
                                                                className="font-mono text-[9px] px-1.5 py-0.5 border rounded-sm bg-amber-50 text-amber-700 border-amber-300"
                                                            >
                                                                {p}
                                                            </span>
                                                        ))}
                                                        {event.changedPermissions.length > 4 && (
                                                            <span className="font-mono text-[9px] px-1.5 py-0.5 border rounded-sm bg-zinc-100 text-zinc-500 border-zinc-300">
                                                                +{event.changedPermissions.length - 4}
                                                            </span>
                                                        )}
                                                        {event.changedPermissions.length === 0 && (
                                                            <span className="text-[10px] text-zinc-400 italic">Tidak ada perubahan</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination footer */}
                            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                    Menampilkan {auditStartIdx}-{auditEndIdx} dari {filteredAudit.length} event
                                </p>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={auditPageSize}
                                        onChange={(e) => { setAuditPageSize(Number(e.target.value)); setAuditPage(1) }}
                                        className="border-2 border-zinc-300 dark:border-zinc-600 rounded-none h-7 px-1.5 text-[10px] font-bold bg-white dark:bg-zinc-800"
                                    >
                                        {[10, 15, 25, 50].map((size) => (
                                            <option key={size} value={size}>{size} / halaman</option>
                                        ))}
                                    </select>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={clampedAuditPage <= 1}
                                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                                        className="border-2 border-black rounded-none h-7 px-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:shadow-none"
                                    >
                                        Prev
                                    </Button>
                                    <span className="text-[10px] font-bold text-zinc-500">
                                        {clampedAuditPage} / {auditTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={clampedAuditPage >= auditTotalPages}
                                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                                        className="border-2 border-black rounded-none h-7 px-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:shadow-none"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* =========================================================== */}
            {/* DIALOG: Role Create / Edit                                   */}
            {/* =========================================================== */}
            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
                <DialogContent className="max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    <DialogHeader className="bg-black text-white px-6 py-4">
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5" />
                            {editingRole ? "Edit Role" : "Tambah Role Baru"}
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                            {editingRole
                                ? `Perbarui data role ${editingRole.code}`
                                : "Buat role custom baru dengan permissions"}
                        </p>
                    </DialogHeader>

                    <ScrollArea className="max-h-[72vh]">
                        <div className="p-6 space-y-5">
                            {/* Code */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Kode Role <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={roleForm.code}
                                    onChange={(e) => setRoleForm((f) => ({ ...f, code: e.target.value }))}
                                    disabled={!!editingRole}
                                    placeholder="Contoh: ROLE_CUSTOM_MANAGER"
                                    className="border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50 font-mono font-bold h-10 rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 transition-colors disabled:opacity-60"
                                />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Nama Role <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={roleForm.name}
                                    onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Contoh: Manajer Produksi"
                                    className="border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50 font-bold h-10 rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Deskripsi
                                </label>
                                <Input
                                    value={roleForm.description}
                                    onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Opsional: jelaskan fungsi role ini"
                                    className="border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50 font-medium h-10 rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                                />
                            </div>

                            {/* Permissions (grouped checkboxes) */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2 block">
                                    Permissions
                                </label>
                                <div className="border-2 border-black rounded-none overflow-hidden">
                                    {permissionGroups.map(([group, options]) => (
                                        <div key={group}>
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    {group}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-2 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                                {options.map((opt) => (
                                                    <label
                                                        key={opt.key}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={roleForm.permissions.includes(opt.key)}
                                                            onCheckedChange={() => togglePermInForm(opt.key)}
                                                        />
                                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                                            {opt.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="border-t-2 border-black px-6 py-3 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-800/50">
                        <Button
                            variant="outline"
                            onClick={() => setRoleDialogOpen(false)}
                            className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider px-6 h-9 rounded-none bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSaveRole}
                            disabled={savingRole}
                            className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none disabled:opacity-60"
                        >
                            {savingRole && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingRole ? "Simpan Perubahan" : "Buat Role"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* =========================================================== */}
            {/* DIALOG: Permission Manager                                   */}
            {/* =========================================================== */}
            <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
                <DialogContent className="max-w-2xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    <DialogHeader className="bg-black text-white px-6 py-4">
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Layers className="h-5 w-5" />
                            Kelola Permissions
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                            {permRole ? `Kelola Permissions -- ${permRole.name}` : ""}
                        </p>
                    </DialogHeader>

                    <ScrollArea className="max-h-[72vh]">
                        <div className="p-6">
                            {permRole && (
                                <div className="border-2 border-black rounded-none overflow-hidden">
                                    {permissionGroups.map(([group, options]) => (
                                        <div key={group}>
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    {group}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-2 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                                {options.map((opt) => (
                                                    <label
                                                        key={opt.key}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={permSelections.includes(opt.key)}
                                                            onCheckedChange={() => togglePermSelection(opt.key)}
                                                        />
                                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                                            {opt.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selection summary */}
                            {permRole && (
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Terpilih:
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                                        {permSelections.length} permission{permSelections.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="border-t-2 border-black px-6 py-3 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-800/50">
                        <Button
                            variant="outline"
                            onClick={() => setPermDialogOpen(false)}
                            className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider px-6 h-9 rounded-none bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSavePerm}
                            disabled={savingPerm}
                            className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none disabled:opacity-60"
                        >
                            {savingPerm && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Simpan Permissions
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
