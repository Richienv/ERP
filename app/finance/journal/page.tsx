"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    FileText,
    Calendar,
    Download,
    Save,
    Trash2,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// Mock Data
const initialEntries = [
    {
        id: "JE-2024-001", date: "2024-01-15", desc: "Payment from Batik Keris", ref: "PAY-001", items: [
            { account: "1-1200 Bank BCA", debit: 50000000, credit: 0 },
            { account: "1-1300 Accounts Receivable", debit: 0, credit: 50000000 }
        ]
    },
    {
        id: "JE-2024-002", date: "2024-01-16", desc: "Office Supplies Purchase", ref: "EXP-001", items: [
            { account: "6-1000 Office Expenses", debit: 2500000, credit: 0 },
            { account: "1-1100 Cash on Hand", debit: 0, credit: 2500000 }
        ]
    }
]

const accounts = [
    "1-1100 Cash on Hand",
    "1-1200 Bank BCA",
    "1-1300 Accounts Receivable",
    "2-1100 Accounts Payable",
    "4-1000 Sales Revenue",
    "6-1000 Office Expenses",
    "6-2000 Rent Expense"
]

export default function GeneralLedgerPage() {
    const [entries, setEntries] = useState(initialEntries)
    const [lines, setLines] = useState([
        { account: "", debit: 0, credit: 0 },
        { account: "", debit: 0, credit: 0 }
    ])
    const [desc, setDesc] = useState("")
    const [ref, setRef] = useState("")

    const totalDebit = lines.reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0)
    const totalCredit = lines.reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0)
    const isBalanced = totalDebit === totalCredit && totalDebit > 0

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
    }

    const handleAddLine = () => {
        setLines([...lines, { account: "", debit: 0, credit: 0 }])
    }

    const handleSave = () => {
        if (!isBalanced || !desc) return

        const newEntry = {
            id: `JE-2024-${String(entries.length + 1).padStart(3, '0')}`,
            date: new Date().toISOString().split('T')[0],
            desc,
            ref: ref || "-",
            items: lines
        }

        setEntries([newEntry, ...entries])
        // Reset form
        setLines([{ account: "", debit: 0, credit: 0 }, { account: "", debit: 0, credit: 0 }])
        setDesc("")
        setRef("")
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
                                    placeholder="e.g. Payment for Inv #102"
                                    className="font-bold border-black bg-zinc-50 focus-visible:ring-black"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Reference</label>
                                <Input
                                    value={ref}
                                    onChange={(e) => setRef(e.target.value)}
                                    placeholder="e.g. INV-001"
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
                                        <Select onValueChange={(v) => {
                                            const newLines = [...lines]
                                            newLines[i].account = v
                                            setLines(newLines)
                                        }}>
                                            <SelectTrigger className="h-9 border-zinc-200 bg-white text-xs font-medium focus:ring-0">
                                                <SelectValue placeholder="Select Account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(acc => <SelectItem key={acc} value={acc}>{acc}</SelectItem>)}
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
                                                const newLines = [...lines]
                                                newLines[i].debit = parseFloat(e.target.value)
                                                newLines[i].credit = 0 // Auto-clear credit if debit is entered
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
                                                const newLines = [...lines]
                                                newLines[i].credit = parseFloat(e.target.value)
                                                newLines[i].debit = 0 // Auto-clear debit if credit is entered
                                                setLines(newLines)
                                            }}
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={() => {
                                        const newLines = lines.filter((_, idx) => idx !== i)
                                        setLines(newLines)
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
                                <span className="font-mono text-sm">{formatCurrency(totalDebit)}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-700">
                                <span>Total Credit</span>
                                <span className="font-mono text-sm">{formatCurrency(totalCredit)}</span>
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className={`flex items-center justify-center p-2 rounded-lg text-xs font-black uppercase tracking-wider border ${isBalanced ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                            {isBalanced ? (
                                <><CheckCircle2 className="mr-2 h-4 w-4" /> Balanced</>
                            ) : (
                                <><AlertCircle className="mr-2 h-4 w-4" /> Unbalanced ({formatCurrency(Math.abs(totalDebit - totalCredit))})</>
                            )}
                        </div>

                        <Button
                            className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-sm h-12 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!isBalanced || !desc}
                            onClick={handleSave}
                        >
                            <Save className="mr-2 h-4 w-4" /> Post Entry
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
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search ledger..." className="pl-9 w-64 border-black bg-zinc-50 font-medium" />
                        </div>
                        <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none bg-white">
                            <Filter className="mr-2 h-4 w-4" /> Filter
                        </Button>
                        <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none bg-white">
                            <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                    </div>
                </div>

                {/* Ledger Cards Stream */}
                <div className="max-w-4xl mx-auto w-full space-y-6">
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
                                            <span className="text-xs font-black uppercase tracking-widest opacity-50">Jan</span>
                                            <span className="text-3xl font-black font-serif">{entry.date.split('-')[2]}</span>
                                            <span className="text-xs font-bold opacity-50">{entry.date.split('-')[0]}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="border-black/20 text-muted-foreground font-mono text-[10px] h-5">{entry.id}</Badge>
                                                        {entry.ref && <Badge className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 shadow-none border-none font-mono text-[10px] h-5">{entry.ref}</Badge>}
                                                    </div>
                                                    <h3 className="text-xl font-bold uppercase tracking-tight">{entry.desc}</h3>
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
                                                        {entry.items.map((item, idx) => (
                                                            <tr key={idx} className="group/row hover:bg-white">
                                                                <td className="py-1.5 pl-2 rounded-l font-sans text-zinc-700 font-bold">{item.account}</td>
                                                                <td className="py-1.5 text-right text-emerald-700">{item.debit ? formatCurrency(Number(item.debit)) : '-'}</td>
                                                                <td className="py-1.5 pr-2 rounded-r text-right text-red-700">{item.credit ? formatCurrency(Number(item.credit)) : '-'}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="border-t border-black/10 font-bold">
                                                            <td className="pt-2 pl-2">Total</td>
                                                            <td className="pt-2 text-right text-emerald-700">{formatCurrency(entry.items.reduce((a, c) => a + (Number(c.debit) || 0), 0))}</td>
                                                            <td className="pt-2 pr-2 text-right text-red-700">{formatCurrency(entry.items.reduce((a, c) => a + (Number(c.credit) || 0), 0))}</td>
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
                </div>
            </div>
        </div>
    )
}
