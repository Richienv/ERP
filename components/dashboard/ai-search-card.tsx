"use client";

import { useState } from "react";
import { Search, Sparkles, ArrowRight, Bot, BarChart3, TrendingUp, X, FileText, CheckCircle2, Send, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export function AiSearchCard() {
    const [query, setQuery] = useState("");
    const [followUpQuery, setFollowUpQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"thinking" | "result">("thinking");
    const [step, setStep] = useState<"initial" | "comparison">("initial");

    const handleSearch = (e?: React.FormEvent, overrideQuery?: string) => {
        e?.preventDefault();

        const effectiveQuery = overrideQuery || query || "Analisis Bisnis Umum";
        if (overrideQuery) setQuery(effectiveQuery); // Changed to effectiveQuery to update input if override is used

        setIsOpen(true);
        setStatus("thinking");
        setStep("initial");

        // Simulate AI Processing
        setTimeout(() => {
            setStatus("result");
        }, 2000);
    };

    const handleFollowUp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!followUpQuery.trim()) return;

        setStatus("thinking");

        // Simulate Comparison Processing
        setTimeout(() => {
            setStep("comparison");
            setStatus("result");
        }, 2000);
    };

    const reset = () => {
        setIsOpen(false);
        setQuery("");
        setFollowUpQuery("");
        setStep("initial");
        setStatus("thinking"); // Reset status to thinking for next open
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-6 md:p-8 flex flex-col h-full group shadow-sm hover:shadow-lg transition-all duration-300">
                {/* Ambient Background Glow */}
                <div className="absolute top-0 right-0 p-12 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-6 h-full">

                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-primary/5 text-primary border border-primary/10">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-medium text-foreground">
                                Tanya AI
                            </h3>
                            <p className="text-xs text-muted-foreground">Business Intelligence Assistant</p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-4">
                        <p className="text-muted-foreground ml-1">
                            Tanyakan insight tentang penjualan, stok, atau prediksi arus kas.
                        </p>
                        <form onSubmit={(e) => handleSearch(e)} className="relative group/input mt-2">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="h-6 w-6 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Contoh: Analisis tren penjualan..."
                                className="w-full h-16 pl-14 pr-20 rounded-2xl bg-secondary/30 border border-border/50 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary/50 transition-all text-base font-medium"
                            />
                            <button
                                type="submit"
                                className="absolute inset-y-2 right-2 aspect-square rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm w-12 h-12 cursor-pointer z-10"
                            >
                                <ArrowRight className="h-6 w-6" />
                            </button>
                        </form>
                        <div className="flex gap-2 flex-wrap mt-2 ml-1">
                            <Badge variant="outline" className="cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSearch(undefined, "Analisis Penjualan Q1")}>
                                📈 Analisis Penjualan
                            </Badge>
                            <Badge variant="outline" className="cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSearch(undefined, "Stok Bahan Baku Menipis")}>
                                ⚠️ Stok Menipis
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl bg-background border-none shadow-2xl p-0 overflow-hidden gap-0 rounded-3xl outline-none">
                    <div className="p-6 border-b border-border/50 bg-secondary/10">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-2xl font-serif font-normal">
                                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                                    <Bot className="h-5 w-5" />
                                </div>
                                <span>{step === "comparison" ? "Perbandingan Q1 vs Q2" : (query || "General Insight")}</span>
                            </DialogTitle>
                            <DialogDescription className="text-base mt-2">
                                {step === "comparison" ? "Analisis komparatif periode fiskal." : "Analisis mendalam menggunakan data perusahaan real-time."}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 min-h-[500px] flex flex-col">
                        <AnimatePresence mode="wait">
                            {status === "thinking" ? (
                                <motion.div
                                    key="thinking"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex-1 flex flex-col items-center justify-center space-y-6"
                                >
                                    <div className="relative h-24 w-24">
                                        <div className="absolute inset-0 rounded-full border-4 border-secondary animate-pulse" />
                                        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin duration-1000" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Sparkles className="h-8 w-8 text-primary animate-bounce" />
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h4 className="text-lg font-medium font-serif">Menganalisis Data...</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {step === "comparison" ? "Mengkompilasi data Q1 & Q2..." : "Memeriksa 1.450 transaksi & 320 item stok"}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="result"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6 flex-1 flex flex-col"
                                >
                                    {/* Insight Section */}
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Key Takeaway</h4>
                                                <p className="text-lg leading-relaxed font-medium">
                                                    {step === "comparison"
                                                        ? "Penjualan Q2 melonjak 35% dibandingkan Q1, didorong oleh ekspansi kategori 'Textile'. Profit margin meningkat 4.5%."
                                                        : (query.toLowerCase().includes('stok')
                                                            ? "Stok Kapas (Cotton) kritis (<15%). Produksi Line 1 berisiko terhenti dalam 72 jam jika tidak dilakukan restock."
                                                            : "Tren penjualan Q1 sangat positif (+12% vs Target). Kategori 'Pakaian Olahraga' menjadi pendorong utama pertumbuhan minggu ini.")}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Visualization Area */}
                                        <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
                                            {step === "comparison" ? (
                                                <div className="space-y-4">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                                <TableHead className="w-[180px] text-foreground font-bold">Metric</TableHead>
                                                                <TableHead className="text-right text-foreground font-bold">Q1 2024</TableHead>
                                                                <TableHead className="text-right text-foreground font-bold">Q2 2024</TableHead>
                                                                <TableHead className="text-right text-foreground font-bold">Growth</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                                <TableCell className="font-medium">Total Revenue</TableCell>
                                                                <TableCell className="text-right">Rp 4.2 M</TableCell>
                                                                <TableCell className="text-right">Rp 5.7 M</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1">
                                                                        <ArrowUpRight className="h-3 w-3" /> +35%
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                                <TableCell className="font-medium">Net Profit</TableCell>
                                                                <TableCell className="text-right">Rp 850 jt</TableCell>
                                                                <TableCell className="text-right">Rp 1.4 M</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1">
                                                                        <ArrowUpRight className="h-3 w-3" /> +64%
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                                <TableCell className="font-medium">Cust. Acquisition</TableCell>
                                                                <TableCell className="text-right">120</TableCell>
                                                                <TableCell className="text-right">145</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1">
                                                                        <ArrowUpRight className="h-3 w-3" /> +20%
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                            <TableRow className="border-border/50 hover:bg-transparent">
                                                                <TableCell className="font-medium">Avg Order Value</TableCell>
                                                                <TableCell className="text-right">Rp 35 jt</TableCell>
                                                                <TableCell className="text-right">Rp 39 jt</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1">
                                                                        <ArrowUpRight className="h-3 w-3" /> +11%
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            ) : (
                                                query.toLowerCase().includes('stok') ? (
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <div className="text-sm text-muted-foreground mb-1">Status Stok</div>
                                                                <div className="text-3xl font-serif">Kritis</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm text-muted-foreground mb-1">Safety Stock</div>
                                                                <div className="text-xl font-medium">20%</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-xs font-medium">
                                                                <span>Cotton Combed (15%)</span>
                                                                <span className="text-destructive">Restock Needed</span>
                                                            </div>
                                                            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                                                                <div className="h-full bg-destructive w-[15%]" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-64 pt-12 flex items-end gap-3 px-2 w-full">
                                                        {[40, 65, 55, 80, 70, 90, 100].map((h, i) => (
                                                            <div key={i} className="flex-1 h-full flex items-end group relative rounded-t-sm px-1">
                                                                <motion.div
                                                                    initial={{ height: 0 }}
                                                                    animate={{ height: `${h}%` }}
                                                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                                                    className="w-full bg-white border-2 border-black rounded-xl relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all"
                                                                >
                                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-sm font-bold py-1.5 px-3 rounded-xl shadow-sm whitespace-nowrap z-10">
                                                                        {h}%
                                                                    </div>
                                                                </motion.div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Follow-up Interaction Section */}
                                    <div className="mt-auto pt-6 border-t border-border/50">
                                        <div className="text-xs font-medium text-muted-foreground mb-3">Tindak Lanjut</div>
                                        <form onSubmit={handleFollowUp} className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    value={followUpQuery}
                                                    onChange={(e) => setFollowUpQuery(e.target.value)}
                                                    placeholder="Tanyakan detail lebih lanjut (contoh: bandingkan dengan Q2)..."
                                                    className="pr-10 rounded-xl bg-secondary/50 border-border/50 focus-visible:ring-primary/20"
                                                />
                                                <Button size="icon" type="submit" variant="ghost" className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-primary">
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <Button type="button" variant="outline" className="rounded-xl border-border/50 hover:bg-secondary/50" onClick={reset}>
                                                Selesai
                                            </Button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
