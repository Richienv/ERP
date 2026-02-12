"use client"

import { useEffect, useState } from "react"
import {
    Plus,
    Download,
    Save,
    Trash2,
    CheckCircle2,
    AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { getJournalEntries, postJournalEntry, getGLAccountsList, type JournalEntryItem } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

export default function GeneralLedgerPage() {
    const [entries, setEntries] = useState<JournalEntryItem[]>([])
    const [glAccounts, setGlAccounts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([])
    const [lines, setLines] = useState([
        { accountId: "", debit: 0, credit: 0 },
        { accountId: "", debit: 0, credit: 0 }
    ])
    const [desc, setDesc] = useState("")
    const [ref, setRef] = useState("")
    const [loading, setLoading] = useState(true)
    const [posting, setPosting] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const [jeData, accData] = await Promise.all([
            getJournalEntries(50),
            getGLAccountsList()
        ])
        setEntries(jeData)
        setGlAccounts(accData)
        setLoading(false)
    }

    const totalDebit = lines.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0)
    const totalCredit = lines.reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

    const handleAddLine = () => {
        setLines([...lines, { accountId: "", debit: 0, credit: 0 }])
    }

    const handleSave = async () => {
        if (!isBalanced || !desc.trim()) return

        setPosting(true)
        try {
            const validLines = lines.filter((line) => (Number(line.debit) > 0 || Number(line.credit) > 0))
            if (validLines.length < 2) {
                toast.error("Minimal dua baris akun dengan nominal")
                return
            }

            const hasInvalidLine = validLines.some((line) => {
                const debit = Number(line.debit) || 0
                const credit = Number(line.credit) || 0
                return !line.accountId || (debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)
            })
            if (hasInvalidLine) {
                toast.error("Setiap baris harus punya akun, dan hanya debit atau kredit yang bernilai")
                return
            }

            const entryLines = validLines.map(line => {
                const acc = glAccounts.find(a => a.id === line.accountId)
                if (!acc) throw new Error("Account mapping not found")
                return {
                    accountCode: acc.code,
                    debit: line.debit,
                    credit: line.credit,
                    description: desc.trim()
                }
            })

            const result = await postJournalEntry({
                date: new Date(),
                description: desc,
                reference: ref,
                lines: entryLines
            })

            if (result.success) {
                toast.success("Journal entry posted successfully")
                // Reset form
                setLines([{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }])
                setDesc("")
                setRef("")
                // Reload ledger
                const updatedEntries = await getJournalEntries(50)
                setEntries(updatedEntries)
            } else {
                toast.error(('error' in result ? result.error : "Failed to post entry") || "Failed to post entry")
            }
        } catch {
            toast.error("An error occurred during posting")
        } finally {
            setPosting(false)
        }
    }

    const handleExport = () => {
        const header = ["Date", "Entry ID", "Reference", "Description", "Account Code", "Account Name", "Debit", "Credit"]
        const rows: string[][] = []

        entries.forEach((entry) => {
            entry.lines.forEach((line) => {
                rows.push([
                    new Date(entry.date).toISOString(),
                    entry.id,
                    entry.reference || "",
                    entry.description || "",
                    line.account.code,
                    line.account.name,
                    String(line.debit || 0),
                    String(line.credit || 0),
                ])
            })
        })

        const csvContent = [header, ...rows]
            .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
            .join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Ledger export berhasil diunduh")
        setExportOpen(false)
    }

    return (
        <div className="flex-1 space-y-0 p-0 font-sans h-[calc(100vh-theme(spacing.16))] flex overflow-hidden">

            {/* LEFT: Journal Entry Form (The Desk) */}
            <div className="w-[500px] border-r border-black/20 bg-zinc-50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-[4px_0px_10px_0px_rgba(0,0,0,0.05)] z-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-black text-white p-2 rounded-lg">
                            <Plus className="h-5 w-5" />
                        </div>
                        <h2 className="text-2xl font-black font-serif tracking-tight">New Journal Entry</h2>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase ml-1">Record a transaction manually.</p>
                </div>

                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="bg-white border-b border-black pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description</label>
                                <Input
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    placeholder="e.g. Manual Adjustment"
                                    className="font-bold border-black bg-zinc-50 focus-visible:ring-black"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Reference</label>
                                <Input
                                    value={ref}
                                    onChange={(e) => setRef(e.target.value)}
                                    placeholder="e.g. REF-001"
                                    className="font-bold border-black bg-zinc-50 focus-visible:ring-black"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 bg-white">
                        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                            {lines.map((line, i) => (
                                <div key={i} className="flex gap-2 items-start group">
                                    <div className="flex-1 space-y-1">
                                        <Select value={line.accountId} onValueChange={(v) => {
                                            const newLines = [...lines]
                                            newLines[i].accountId = v
                                            setLines(newLines)
                                        }}>
                                            <SelectTrigger className="h-9 border-zinc-200 bg-white text-xs font-medium focus:ring-0">
                                                <SelectValue placeholder="Select Account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {glAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-28 space-y-1">
                                        <Input
                                            type="number"
                                            placeholder="Debit"
                                            className="h-9 border-zinc-200 bg-emerald-50/50 text-right text-xs font-mono"
                                            value={line.debit || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const newLines = [...lines]
                                                newLines[i].debit = val
                                                if (val > 0) newLines[i].credit = 0
                                                setLines(newLines)
                                            }}
                                        />
                                    </div>
                                    <div className="w-28 space-y-1">
                                        <Input
                                            type="number"
                                            placeholder="Credit"
                                            className="h-9 border-zinc-200 bg-red-50/50 text-right text-xs font-mono"
                                            value={line.credit || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                const newLines = [...lines]
                                                newLines[i].credit = val
                                                if (val > 0) newLines[i].debit = 0
                                                setLines(newLines)
                                            }}
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={() => {
                                        if (lines.length > 2) {
                                            const newLines = lines.filter((_, idx) => idx !== i)
                                            setLines(newLines)
                                        }
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 border-t border-dashed border-zinc-200">
                            <Button variant="ghost" size="sm" className="w-full text-xs font-bold uppercase text-muted-foreground hover:text-black border border-dashed border-zinc-300 hover:border-black hover:bg-zinc-50" onClick={handleAddLine}>
                                <Plus className="mr-2 h-3 w-3" /> Add Line Item
                            </Button>
                        </div>
                    </CardContent>

                    {/* Footer Totals */}
                    <div className="bg-zinc-100 p-4 border-t border-black space-y-4">
                        <div className="grid grid-cols-2 gap-8 text-xs font-bold uppercase">
                            <div className="flex justify-between items-center text-emerald-700">
                                <span>Total Debit</span>
                                <span className="font-mono text-sm">{formatIDR(totalDebit)}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-700">
                                <span>Total Credit</span>
                                <span className="font-mono text-sm">{formatIDR(totalCredit)}</span>
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className={`flex items-center justify-center p-2 rounded-lg text-xs font-black uppercase tracking-wider border ${isBalanced ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                            {isBalanced ? (
                                <><CheckCircle2 className="mr-2 h-4 w-4" /> Balanced</>
                            ) : (
                                <><AlertCircle className="mr-2 h-4 w-4" /> Unbalanced ({formatIDR(Math.abs(totalDebit - totalCredit))})</>
                            )}
                        </div>

                        <Button
                            className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-sm h-12 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!isBalanced || !desc || posting}
                            onClick={handleSave}
                        >
                            {posting ? "Posting..." : <><Save className="mr-2 h-4 w-4" /> Post Entry</>}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* RIGHT: Ledger Stream (The Archive) */}
            <div className="flex-1 bg-white p-8 overflow-y-auto flex flex-col gap-6">
                <div className="flex items-center justify-between pb-6 border-b border-black">
                    <div>
                        <h1 className="text-4xl font-black font-serif uppercase tracking-tight">General Ledger</h1>
                        <p className="text-muted-foreground font-bold text-sm mt-1">Chronological Record of All Transactions</p>
                    </div>
                    <div className="flex gap-2">
                        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none bg-white">
                                    <Download className="mr-2 h-4 w-4" /> Export
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export General Ledger</DialogTitle>
                                    <DialogDescription>Download semua baris jurnal yang sedang tampil sebagai CSV.</DialogDescription>
                                </DialogHeader>
                                <Button onClick={handleExport} className="w-full">
                                    Download CSV
                                </Button>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Ledger Cards Stream */}
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    {loading ? (
                        <div className="p-12 text-center text-zinc-400 font-black uppercase tracking-widest animate-pulse">Retrieving Ledger History...</div>
                    ) : entries.length === 0 ? (
                        <div className="p-12 text-center text-zinc-400 font-medium italic border-2 border-dashed border-zinc-200 rounded-2xl">No journal entries found</div>
                    ) : (
                        <AnimatePresence>
                            {entries.map((entry) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    layout
                                >
                                    <Card className="border-2 border-black/10 hover:border-black shadow-sm hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group bg-white">
                                        <div className="flex flex-col md:flex-row">
                                            {/* Date Strip */}
                                            <div className="w-full md:w-32 bg-zinc-100 p-4 border-b md:border-b-0 md:border-r border-black/10 flex flex-col justify-center items-center text-center group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                                                <span className="text-xs font-black uppercase tracking-widest opacity-50">
                                                    {new Date(entry.date).toLocaleString('default', { month: 'short' })}
                                                </span>
                                                <span className="text-3xl font-black font-serif">{new Date(entry.date).getDate()}</span>
                                                <span className="text-xs font-bold opacity-50">{new Date(entry.date).getFullYear()}</span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="border-black/20 text-muted-foreground font-mono text-[10px] h-5">JE-{entry.id.substring(0, 8)}</Badge>
                                                            {entry.reference && <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 shadow-none border-none font-mono text-[10px] h-5">{entry.reference}</Badge>}
                                                        </div>
                                                        <h3 className="text-xl font-bold uppercase tracking-tight">{entry.description}</h3>
                                                    </div>
                                                </div>

                                                {/* Line Items Table */}
                                                <div className="bg-zinc-50 rounded-lg p-2 border border-black/5">
                                                    <table className="w-full text-xs font-medium">
                                                        <thead>
                                                            <tr className="text-muted-foreground border-b border-black/5 text-left">
                                                                <th className="pb-2 w-1/2">Account</th>
                                                                <th className="pb-2 text-right">Debit</th>
                                                                <th className="pb-2 text-right">Credit</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-mono">
                                                            {entry.lines.map((item, idx) => (
                                                                <tr key={idx} className="group/row hover:bg-white transition-colors">
                                                                    <td className="py-1.5 pl-2 rounded-l font-sans text-zinc-700 font-bold">
                                                                        {item.account.code} - {item.account.name}
                                                                        {item.description && item.description !== entry.description && (
                                                                            <span className="block text-[10px] font-normal text-zinc-400 italic">{item.description}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-1.5 text-right text-emerald-700">{item.debit > 0 ? formatIDR(item.debit) : '-'}</td>
                                                                    <td className="py-1.5 pr-2 rounded-r text-right text-red-700">{item.credit > 0 ? formatIDR(item.credit) : '-'}</td>
                                                                </tr>
                                                            ))}
                                                            <tr className="border-t border-black/10 font-bold bg-zinc-100/30">
                                                                <td className="py-2 pl-2 rounded-bl">Total</td>
                                                                <td className="py-2 text-right text-emerald-700 font-black">{formatIDR(entry.totalDebit)}</td>
                                                                <td className="py-2 pr-2 text-right text-red-700 font-black rounded-br">{formatIDR(entry.totalCredit)}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    )
}
