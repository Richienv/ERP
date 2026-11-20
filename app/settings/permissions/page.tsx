"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Shield,
    Check,
    X,
    Save,
    Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast, Toaster } from "sonner"
import { MODULE_PERMISSIONS, type PermissionMatrixEntry } from "@/lib/settings-helpers"
import { usePermissionMatrix } from "@/hooks/use-permission-matrix"

export const dynamic = "force-dynamic"

export default function PermissionsPage() {
    const { data: initialRoles, isLoading: loading } = usePermissionMatrix()
    const [roles, setRoles] = useState<PermissionMatrixEntry[]>([])
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        if (initialRoles && initialRoles.length > 0 && roles.length === 0) {
            setRoles(initialRoles)
        }
    }, [initialRoles, roles.length])

    const togglePermission = (roleCode: string, moduleKey: string) => {
        setRoles(prev => prev.map(r => {
            if (r.roleCode !== roleCode) return r
            // Admin always has all permissions
            if (r.roleCode === "ROLE_ADMIN") return r
            const has = r.permissions.includes(moduleKey)
            return {
                ...r,
                permissions: has
                    ? r.permissions.filter(p => p !== moduleKey)
                    : [...r.permissions, moduleKey],
            }
        }))
        setDirty(true)
    }

    const handleSave = () => {
        toast.error("Matriks izin belum dapat disimpan. Fitur ini segera hadir.", {
            className: "font-bold border border-border",
        })
    }

    // Group modules
    const groups = Array.from(new Set(MODULE_PERMISSIONS.map(m => m.group)))

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-2">
                    <Shield className="h-8 w-8 animate-pulse mx-auto" />
                    <p className="text-sm font-bold text-zinc-500  ">Memuat Izin...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6" /> Matriks Izin
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Atur hak akses modul untuk setiap peran dalam sistem
                    </p>
                </div>
                <Button
                    className={cn(
                        "border border-border shadow-sm font-semibold text-xs",
                        "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                    )}
                    onClick={handleSave}
                    disabled
                    title="Penyimpanan matriks izin belum tersedia"
                >
                    <Save className="h-4 w-4 mr-1" /> Segera hadir
                </Button>
            </div>
            {dirty && (
                <p className="text-xs font-bold text-amber-600">
                    Perubahan di layar ini tidak tersimpan — penyimpanan segera hadir.
                </p>
            )}

            {/* Permission Matrix Table */}
            <div className="border border-border shadow-sm overflow-hidden bg-white">
                <ScrollArea className="max-h-[70vh]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-900 text-white">
                                <th className="text-left px-4 py-3 font-semibold text-xs border-r border-zinc-700 min-w-[200px]">
                                    Modul
                                </th>
                                {roles.map(role => (
                                    <th key={role.roleCode} className="px-3 py-3 text-center font-semibold text-xs border-r border-zinc-700 min-w-[100px]">
                                        <div>{role.roleName}</div>
                                        {role.isSystem && (
                                            <Badge variant="outline" className="mt-1 text-xs border-zinc-600 text-zinc-400">
                                                <Lock className="h-2 w-2 mr-0.5" /> Sistem
                                            </Badge>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map(group => (
                                <>
                                    <tr key={`group-${group}`} className="bg-zinc-100 border-t border-border">
                                        <td
                                            colSpan={roles.length + 1}
                                            className="px-4 py-2 font-semibold text-xs text-zinc-500"
                                        >
                                            {group}
                                        </td>
                                    </tr>
                                    {MODULE_PERMISSIONS.filter(m => m.group === group).map(mod => (
                                        <tr key={mod.key} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-2.5 font-bold border-r border-zinc-200">
                                                {mod.label}
                                            </td>
                                            {roles.map(role => {
                                                const hasPermission = role.permissions.includes(mod.key)
                                                const isAdmin = role.roleCode === "ROLE_ADMIN"
                                                return (
                                                    <td key={`${role.roleCode}-${mod.key}`} className="text-center border-r border-zinc-200">
                                                        <button
                                                            onClick={() => togglePermission(role.roleCode, mod.key)}
                                                            disabled={isAdmin}
                                                            className={cn(
                                                                "h-8 w-8 mx-auto flex items-center justify-center rounded transition-all",
                                                                hasPermission
                                                                    ? "bg-green-500 text-white shadow-sm"
                                                                    : "bg-zinc-200 text-zinc-400 hover:bg-zinc-300",
                                                                isAdmin && "cursor-not-allowed opacity-80"
                                                            )}
                                                        >
                                                            {hasPermission ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                        </button>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </ScrollArea>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-zinc-500 font-bold  ">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 bg-green-500 rounded flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>
                    Diizinkan
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 bg-zinc-200 rounded flex items-center justify-center"><X className="h-3 w-3 text-zinc-400" /></div>
                    Ditolak
                </div>
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Peran sistem tidak dapat dihapus
                </div>
            </div>
        </div>
    )
}
