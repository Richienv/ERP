"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, Calendar, ArrowRight, AlertCircle, MessageSquare } from "lucide-react"
import { toast } from "sonner"

export function InvoiceAging() {
    return (
        <Card className="shadow-sm h-full flex flex-col">
            <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="font-serif text-lg tracking-tight">📧 Asisten Penagihan</CardTitle>
                        <p className="text-sm text-muted-foreground">Fokus: CV GARMEN SEJAHTERA (Rp 340jt Tertunggak)</p>
                    </div>
                    <Badge variant="destructive" className="animate-pulse">Perlu Tindakan</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5">Data Demo</span>
                </div>
                {/* Invoice Table Mock */}
                <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-4 py-3 text-left">Faktur</th>
                                <th className="px-4 py-3 text-left">Tanggal</th>
                                <th className="px-4 py-3 text-right">Jumlah</th>
                                <th className="px-4 py-3 text-left">Umur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            <tr className="bg-red-50/50 dark:bg-red-900/10">
                                <td className="px-4 py-3 font-medium">INV-2543</td>
                                <td className="px-4 py-3 text-muted-foreground">Sep 18, 2025</td>
                                <td className="px-4 py-3 text-right">Rp 140jt</td>
                                <td className="px-4 py-3 text-red-600 font-bold">112 Hari 🔴</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium">INV-2687</td>
                                <td className="px-4 py-3 text-muted-foreground">Oct 25, 2025</td>
                                <td className="px-4 py-3 text-right">Rp 95jt</td>
                                <td className="px-4 py-3 text-red-500 font-medium">75 Hari 🔴</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium">INV-2801</td>
                                <td className="px-4 py-3 text-muted-foreground">Nov 30, 2025</td>
                                <td className="px-4 py-3 text-right">Rp 105jt</td>
                                <td className="px-4 py-3 text-amber-500 font-medium">40 Hari 🟡</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* AI Suggestions */}
                <div className="rounded-xl border border-indigo-200/50 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                        <MessageSquare className="h-4 w-4" />
                        Strategi Penagihan AI
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                        Pelanggan biasanya membayar setelah peringatan ke-3 + telepon. Tingkat keberhasilan: <span className="font-bold text-emerald-600">78%</span>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="outline" size="sm" className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs hover:bg-indigo-50" onClick={() => toast.info("Fitur belum tersedia")}>
                            🔥 MENDESAK: Somasi Hukum
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs hover:bg-indigo-50" onClick={() => toast.info("Fitur belum tersedia")}>
                            💰 Tawarkan Diskon 5%
                        </Button>
                    </div>
                </div>

                {/* Draft Email */}
                <div className="border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" /> Pratinjau Draf Email
                        </span>
                        <span className="font-mono">Kepada: finance@cvgarmen.com</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="text-sm text-foreground/80 leading-relaxed font-serif">
                            <p className="mb-2">Yth. Pak Budi,</p>
                            <p className="mb-2">
                                Faktur <span className="font-medium text-foreground">INV-2543</span> kini <span className="font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1 rounded">terlambat 112 hari</span>.
                            </p>
                            <p>
                                Sebagai itikad baik, kami menawarkan <span className="font-medium text-emerald-600">diskon 5%</span> (hemat Rp 17jt) jika pelunasan dilakukan sebelum 12 Jan.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="outline" className="w-full" onClick={() => toast.info("Fitur belum tersedia")}>
                                <Calendar className="h-4 w-4 mr-2" />
                                Jadwalkan
                            </Button>
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => toast.info("Fitur belum tersedia")}>
                                <Mail className="h-4 w-4 mr-2" />
                                Kirim Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
