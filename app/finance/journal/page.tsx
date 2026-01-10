"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    FileText,
    Calendar,
    Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const entries = [
    {
        id: "JE-2024-001", date: "2024-01-15", desc: "Payment from Batik Keris", ref: "PAY-001", items: [
            { account: "1-1200 Bank BCA", debit: "Rp 50.000.000", credit: "-" },
            { account: "1-1300 Accounts Receivable", debit: "-", credit: "Rp 50.000.000" }
        ]
    },
    {
        id: "JE-2024-002", date: "2024-01-16", desc: "Office Supplies Purchase", ref: "EXP-001", items: [
            { account: "6-1000 Office Expenses", debit: "Rp 2.500.000", credit: "-" },
            { account: "1-1100 Cash on Hand", debit: "-", credit: "Rp 2.500.000" }
        ]
    }
]

export default function GeneralLedgerPage() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Jurnal Umum
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Log kronologis seluruh transaksi keuangan.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none bg-white">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                        <Plus className="mr-2 h-4 w-4" /> Manual Entry
                    </Button>
                </div>
            </div>

            {/* Ledger Log */}
            <div className="space-y-6">
                {entries.map((entry) => (
                    <Card key={entry.id} className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
                        <CardHeader className="bg-zinc-50 border-b border-black py-4 flex-row items-center justify-between space-y-0">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <Badge className="bg-black text-white font-mono font-bold">{entry.id}</Badge>
                                    <span className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> {entry.date}
                                    </span>
                                </div>
                                <CardTitle className="text-lg font-black uppercase">{entry.desc}</CardTitle>
                            </div>
                            <Badge variant="outline" className="border-black font-mono text-xs">{entry.ref}</Badge>
                        </CardHeader>
                        <div className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-white border-b border-black/10">
                                        <TableHead className="font-bold text-black uppercase text-xs pl-6">Account</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase text-xs w-[200px]">Debit</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase text-xs w-[200px] pr-6">Credit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entry.items.map((line, idx) => (
                                        <TableRow key={idx} className="border-b-0 hover:bg-zinc-50">
                                            <TableCell className="font-medium pl-6">{line.account}</TableCell>
                                            <TableCell className="text-right font-mono">{line.debit}</TableCell>
                                            <TableCell className="text-right font-mono pr-6">{line.credit}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                ))}
            </div>

        </div>
    )
}
