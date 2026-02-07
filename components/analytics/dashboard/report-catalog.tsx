"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Book, FileText, BarChart2, Users, Factory, ChevronRight, Star, ArrowUpRight } from "lucide-react"

const reports = {
    favorit: [
        { title: "Analisis Keterlambatan Pengiriman", category: "Produksi" },
        { title: "Laporan Umur Stok (Aging)", category: "Persediaan" },
    ],
    produksi: [
        { title: "Laporan Kinerja Mesin (OEE)", desc: "Efisiensi per mesin & shift" },
        { title: "Downtime & Scrap Log", desc: "Catatan masalah produksi" },
        { title: "Analisis Keterlambatan", desc: "Root cause delivery delay" },
    ],
    keuangan: [
        { title: "Profit & Loss per Produk", desc: "Margin analisis detail" },
        { title: "Cash Flow Statement", desc: "Arus kas masuk & keluar" },
        { title: "Customer Profitability", desc: "Keuntungan per klien" },
    ],
    persediaan: [
        { title: "Valuasi Stok", desc: "Nilai aset saat ini" },
        { title: "Pergerakan Stok Fast/Slow", desc: "Analisis perputaran" },
    ],
    sdm: [
        { title: "Lembur & Absensi", desc: "Cost impact tenaga kerja" },
        { title: "Produktivitas Operator", desc: "Output per orang" },
    ]
}

export function ReportCatalog() {
    return (
        <Card className="bg-zinc-50/50 dark:bg-zinc-900 border-dashed">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Book className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-bold">Pustaka Laporan (Report Library)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Column 1: Favorites & Production */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> Favorit Richie
                            </h4>
                            <div className="space-y-2">
                                {reports.favorit.map((item, i) => (
                                    <Button key={i} variant="secondary" className="w-full justify-between h-auto py-2 px-3 text-sm font-medium bg-white dark:bg-black border shadow-sm hover:border-indigo-300 transition-all group">
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-indigo-500" />
                                            {item.title}
                                        </span>
                                        <ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                <Factory className="h-3 w-3" /> Produksi
                            </h4>
                            <div className="space-y-2">
                                {reports.produksi.map((item, i) => (
                                    <div key={i} className="group p-3 rounded-lg bg-white dark:bg-black border hover:border-indigo-400 cursor-pointer transition-all shadow-sm flex justify-between items-center">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</div>
                                            <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Finance */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                            <BarChart2 className="h-3 w-3" /> Keuangan
                        </h4>
                        <div className="space-y-2">
                            {reports.keuangan.map((item, i) => (
                                <div key={i} className="group p-3 rounded-lg bg-white dark:bg-black border hover:border-emerald-400 cursor-pointer transition-all shadow-sm flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</div>
                                        <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Inventory & SDM */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                <BarChart2 className="h-3 w-3" /> Persediaan
                            </h4>
                            <div className="space-y-2">
                                {reports.persediaan.map((item, i) => (
                                    <div key={i} className="group p-3 rounded-lg bg-white dark:bg-black border hover:border-orange-400 cursor-pointer transition-all shadow-sm flex justify-between items-center">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</div>
                                            <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                                <Users className="h-3 w-3" /> SDM & Ops
                            </h4>
                            <div className="space-y-2">
                                {reports.sdm.map((item, i) => (
                                    <div key={i} className="group p-3 rounded-lg bg-white dark:bg-black border hover:border-blue-400 cursor-pointer transition-all shadow-sm flex justify-between items-center">
                                        <div>
                                            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</div>
                                            <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Column 4: Self-Service Info */}
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 border-dashed flex flex-col items-center text-center justify-center">
                        <div className="p-3 bg-white dark:bg-black rounded-full shadow-sm mb-3">
                            <Book className="h-6 w-6 text-indigo-600" />
                        </div>
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2">Butuh Laporan Baru?</h4>
                        <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mb-4">
                            Tanya AI Assistant untuk membuatkan laporan kustom atau hubungi tim IT untuk template baru.
                        </p>
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">Request Report</Button>
                    </div>

                </div>
            </CardContent>
        </Card>
    )
}
