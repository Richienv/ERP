"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, CheckCircle2, Globe, Database, MapPin, ArrowRight } from "lucide-react"

export function MasterDataHealth() {
    return (
        <div className="space-y-6">
            {/* Top Level Health Score */}
            <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-zinc-900 border-indigo-200 dark:border-indigo-800">
                <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                            <Database className="h-6 w-6 text-indigo-600" />
                            Master Data Health Dashboard
                        </h2>
                        <p className="text-muted-foreground mt-1 max-w-xl">
                            Skor kesehatan data real-time. Sistem memantau duplikasi, kelengkapan atribut, dan konsistensi data di seluruh modul ERP.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-white dark:bg-black p-4 rounded-xl shadow-sm border">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-emerald-600">94%</div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Overall Health</div>
                        </div>
                        <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800" />
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" /> System Optimal
                            </div>
                            <div className="text-xs text-muted-foreground">Last scan: 2 mins ago</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Category & Unit */}
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Database className="h-4 w-4 text-emerald-600" /> Kategori & Unit
                            </CardTitle>
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">97% Excellent</Badge>
                        </div>
                        <CardDescription>2,458 Records</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                                <span>Data Completeness</span>
                                <span className="text-emerald-600">97%</span>
                            </div>
                            <Progress value={97} className="h-1.5 bg-emerald-100 [&>div]:bg-emerald-500" />
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Attention Needed</p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300/80">
                                        3 duplikasi kategori terdeteksi menunggu penggabungan (merge).
                                    </p>
                                    <Button variant="link" className="h-auto p-0 text-yellow-800 text-xs underline decoration-yellow-800/50">Fix Issues Now</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Location & Warehouse */}
                <Card className="border-l-4 border-l-yellow-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-yellow-600" /> Lokasi & Gudang
                            </CardTitle>
                            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">89% Good</Badge>
                        </div>
                        <CardDescription>18 Warehouses</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                                <span>Data Completeness</span>
                                <span className="text-yellow-600">89%</span>
                            </div>
                            <Progress value={89} className="h-1.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm py-1 border-b">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3 text-red-500" /> Gudang C
                                </span>
                                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded">Missing GPS</span>
                            </div>
                            <div className="flex items-center justify-between text-sm py-1 border-b">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3 text-orange-500" /> 5 Locations
                                </span>
                                <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Not Synced</span>
                            </div>
                        </div>
                        <div className="text-center pt-2">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8">View Audit Log</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Currency & Tax */}
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Globe className="h-4 w-4 text-blue-600" /> Mata Uang & Pajak
                            </CardTitle>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">100% Perfect</Badge>
                        </div>
                        <CardDescription>45 Currencies</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg flex items-center gap-3">
                            <CheckCircle2 className="h-8 w-8 text-blue-500" />
                            <div>
                                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">All Systems Go</p>
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Rate kurs tersinkronisasi 15 menit yang lalu. Pajak tervalidasi.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Terakhir update:</span>
                                <span>Otomatis (API)</span>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full text-xs h-8 justify-between hover:text-blue-600">
                                View Exchange Rates <ArrowRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
