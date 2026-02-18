"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getGLAccounts } from "@/lib/actions/finance"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Layers } from "lucide-react"

interface GLAccount {
    id: string
    code: string
    name: string
    type: string
    isSystem: boolean
    balance: string // Decimal string from Prisma
}

export default function ChartOfAccountsPage() {
    const [search, setSearch] = useState("")

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: queryKeys.glAccounts.list(),
        queryFn: async () => {
            const res = await getGLAccounts()
            return (res.success ? res.data : []) as GLAccount[]
        },
    })

    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        acc.code.includes(search)
    )

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'ASSET': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
            case 'LIABILITY': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
            case 'EQUITY': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
            case 'REVENUE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'EXPENSE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const formatCurrency = (val: string) => {
        const num = Number(val)
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num)
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 pb-24 font-sans">
            <div>
                <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Katalog Akun (COA)</h1>
                <p className="text-muted-foreground mt-1">Daftar akun standar akuntansi Indonesia.</p>
            </div>

            <Card className="border-black shadow-sm">
                <CardHeader className="bg-zinc-50/50 border-b flex flex-row items-center justify-between pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-base">Daftar Akun</CardTitle>
                        <CardDescription>{accounts.length} Akun Terdaftar</CardDescription>
                    </div>
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari akun..."
                            className="pl-9 bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Kode</TableHead>
                                <TableHead>Nama Akun</TableHead>
                                <TableHead className="w-[150px]">Kategori</TableHead>
                                <TableHead className="w-[100px] text-center">System</TableHead>
                                <TableHead className="text-right">Saldo Saat Ini</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Memuat data...</TableCell>
                                </TableRow>
                            ) : filteredAccounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada akun ditemukan.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAccounts.map((acc) => (
                                    <TableRow key={acc.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                        <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                                        <TableCell>
                                            <span className="font-medium group-hover:underline decoration-dotted underline-offset-4">{acc.name}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${getTypeColor(acc.type)} border-transparent shadow-sm`}>
                                                {acc.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {acc.isSystem && (
                                                <Layers className="h-4 w-4 mx-auto text-muted-foreground" />
                                            )}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${Number(acc.balance) < 0 ? 'text-red-600' : ''}`}>
                                            {formatCurrency(acc.balance)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
