"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, GitMerge, FileX, ArrowRight } from "lucide-react"

export function DuplicateDetector() {
    return (
        <Card className="border-orange-200 dark:border-orange-900 bg-white dark:bg-black">
            <CardHeader className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base text-orange-950 dark:text-orange-100">Deteksi Duplikasi Cerdas (AI)</CardTitle>
                            <CardDescription className="text-orange-800/70 dark:text-orange-200/60">
                                Sistem mendeteksi entri yang mirip secara otomatis
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-white border-orange-200 text-orange-700">
                        1 Pending Review
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-6">
                    <div className="flex flex-col lg:flex-row gap-8 items-stretch">

                        {/* Item A */}
                        <div className="flex-1 space-y-3 p-4 border rounded-xl bg-muted/20 relative">
                            <Badge className="absolute -top-3 left-4 bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                                Existing Record
                            </Badge>
                            <div className="font-mono text-xs text-muted-foreground uppercase">ID: MAT-1023</div>
                            <div className="font-bold text-lg">Aluminum Sheet 2mm</div>
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Category</span>
                                    <span>Raw Material</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Price</span>
                                    <span>Rp 45,000 / m2</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">Stock</span>
                                    <span>247 units</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Used In</span>
                                    <Badge variant="secondary">12 BOMs</Badge>
                                </div>
                            </div>
                        </div>

                        {/* Comparison Arrow */}
                        <div className="hidden lg:flex flex-col items-center justify-center text-orange-500 font-bold text-xs gap-2">
                            <div className="bg-orange-100 px-3 py-1 rounded-full">95% Match</div>
                            <ArrowRight className="h-6 w-6" />
                        </div>

                        {/* Item B */}
                        <div className="flex-1 space-y-3 p-4 border border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 rounded-xl relative">
                            <Badge className="absolute -top-3 left-4 bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">
                                Potential Duplicate
                            </Badge>
                            <div className="font-mono text-xs text-muted-foreground uppercase">ID: MAT-1087</div>
                            <div className="font-bold text-lg text-orange-700 dark:text-orange-400">Aluminium Sheet 2mm</div>
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between border-b border-orange-200/50 pb-1">
                                    <span className="text-muted-foreground">Category</span>
                                    <span>Raw Material</span>
                                </div>
                                <div className="flex justify-between border-b border-orange-200/50 pb-1">
                                    <span className="text-muted-foreground">Price</span>
                                    <span>Rp 45,000 / m2</span>
                                </div>
                                <div className="flex justify-between border-b border-orange-200/50 pb-1">
                                    <span className="text-muted-foreground">Stock</span>
                                    <span>0 units</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Used In</span>
                                    <Badge variant="outline" className="bg-white/50">0 BOMs</Badge>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* AI Insight */}
                    <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4">
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-2 flex items-center gap-2">
                            🤖 AI Recommendation: Merge into MAT-1023
                        </h4>
                        <ul className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1 list-disc list-inside">
                            <li>MAT-1023 memiliki history transaksi yang lebih lengkap (digunakan di 12 BOM).</li>
                            <li>MAT-1087 tampaknya duplikat typo ("Aluminium" vs "Aluminum").</li>
                            <li>Sistem akan otomatis memindahkan 3 Active PO dari MAT-1087 ke MAT-1023.</li>
                        </ul>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-zinc-50 dark:bg-black border-t p-4 flex justify-end gap-3 rounded-b-xl">
                <Button variant="outline" disabled>
                    Ignore
                </Button>
                <Button variant="outline" className="text-red-600 hover:bg-red-50 border-red-200">
                    <FileX className="mr-2 h-4 w-4" /> Delete Duplicate
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <GitMerge className="mr-2 h-4 w-4" /> Merge Automatically
                </Button>
            </CardFooter>
        </Card>
    )
}
