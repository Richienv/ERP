"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Users, Search, Shield, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast, Toaster } from "sonner"
import { NB } from "@/lib/dialog-styles"
import { listUsers, setUserRole } from "@/app/actions/users"

type ListedUser = Extract<Awaited<ReturnType<typeof listUsers>>, { success: true }>["data"][number]

const ASSIGNABLE_ROLES = [
    "ADMIN",
    "ROLE_ACCOUNTANT",
    "ROLE_MANAGER",
    "ROLE_STAFF",
    "ROLE_PURCHASING",
    "ROLE_CEO",
    "ROLE_DIRECTOR",
] as const

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    ROLE_ACCOUNTANT: "Akuntan",
    ROLE_MANAGER: "Manajer",
    ROLE_STAFF: "Staf",
    ROLE_PURCHASING: "Pembelian",
    ROLE_CEO: "CEO",
    ROLE_DIRECTOR: "Direktur",
}

function roleLabel(role: string) {
    return ROLE_LABELS[role] ?? role
}

function getInitials(name: string | null, email: string) {
    const source = (name || email || "?").trim()
    return source
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

function formatUpdatedAt(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<ListedUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [savingId, setSavingId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const result = await listUsers()
            if (cancelled) return
            if (!result.success) {
                setError(result.error)
                setUsers([])
            } else {
                setError(null)
                setUsers(result.data)
            }
            setLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return users
        return users.filter((user) => {
            const name = (user.name ?? "").toLowerCase()
            return name.includes(q) || user.email.toLowerCase().includes(q)
        })
    }, [users, search])

    const adminCount = users.filter((user) => {
        const normalized = user.role.replace(/^ROLE_/, "").toUpperCase()
        return normalized === "ADMIN"
    }).length

    async function handleRoleChange(userId: string, role: string) {
        const previous = users.find((user) => user.id === userId)?.role
        if (previous === role) return

        setSavingId(userId)
        setUsers((current) =>
            current.map((user) => (user.id === userId ? { ...user, role } : user)),
        )

        const result = await setUserRole(userId, role)
        setSavingId(null)

        if (!result.success) {
            setUsers((current) =>
                current.map((user) =>
                    user.id === userId ? { ...user, role: previous ?? user.role } : user,
                ),
            )
            toast.error(result.error)
            return
        }

        toast.success("Peran pengguna diperbarui.")
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <Toaster position="top-center" />

            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />
                <div className={`px-5 py-4 ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center bg-orange-500 text-white">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Manajemen Pengguna</h2>
                            <p className="text-xs text-muted-foreground">
                                Ubah peran akun. Perubahan disimpan ke data pengguna, bukan metadata login.
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    <div className={NB.kpiCell}>
                        <span className={NB.kpiLabel}>Semua</span>
                        <span className={NB.kpiCount}>{loading ? "—" : users.length}</span>
                    </div>
                    <div className={NB.kpiCell}>
                        <span className={NB.kpiLabel}>Admin</span>
                        <span className={NB.kpiCount}>{loading ? "—" : adminCount}</span>
                    </div>
                </div>
                <div className={NB.filterBar}>
                    <div className="relative w-full max-w-sm">
                        <Search
                            className={`absolute left-2 top-2.5 h-4 w-4 ${search ? NB.inputIconActive : NB.inputIconEmpty}`}
                        />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari nama atau email..."
                            className={`${NB.filterInput} ${search ? NB.inputActive : NB.inputEmpty}`}
                        />
                        {search ? (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
                                aria-label="Hapus pencarian"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {filteredUsers.length} pengguna
                    </span>
                </div>
            </div>

            <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                        <Shield className="h-4 w-4" />
                        Daftar Pengguna
                    </CardTitle>
                    <CardDescription>Pilih peran baru untuk langsung menyimpan ke sistem.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="py-8 text-center text-sm font-bold uppercase tracking-wider text-zinc-500">
                            Memuat pengguna...
                        </p>
                    ) : error ? (
                        <p className="py-8 text-center text-sm font-bold text-red-600">{error}</p>
                    ) : filteredUsers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Tidak ada pengguna yang cocok.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pengguna</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Peran</TableHead>
                                    <TableHead>Diperbarui</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => {
                                    const currentAllowed = (ASSIGNABLE_ROLES as readonly string[]).includes(user.role)
                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar>
                                                        <AvatarFallback className="bg-orange-500 text-white">
                                                            {getInitials(user.name, user.email)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium">{user.name || "Tanpa nama"}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.email}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={currentAllowed ? user.role : undefined}
                                                    onValueChange={(role) => handleRoleChange(user.id, role)}
                                                    disabled={savingId === user.id}
                                                >
                                                    <SelectTrigger className={`${NB.select} w-[200px] ${NB.inputActive}`}>
                                                        <SelectValue placeholder={roleLabel(user.role)} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {!currentAllowed && (
                                                            <SelectItem value={user.role} disabled>
                                                                {roleLabel(user.role)} (tidak dikenali)
                                                            </SelectItem>
                                                        )}
                                                        {ASSIGNABLE_ROLES.map((role) => (
                                                            <SelectItem key={role} value={role}>
                                                                {roleLabel(role)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatUpdatedAt(user.updatedAt)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
