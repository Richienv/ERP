"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Sparkles, Send, Save, BookOpen } from "lucide-react"

const savedQuestions = [
    "Kenapa margin turun bulan ini?",
    "Batch produksi mana yang paling banyak scrap?",
    "Pelanggan mana yang bertumbuh vs menyusut?",
    "Simulasi kenaikan harga bahan baku 10%",
]

export function OperationsCockpit() {
    return (
        <Card className="bg-zinc-50 dark:bg-zinc-900 border-2 border-indigo-100 dark:border-indigo-900 overflow-hidden">
            <CardHeader className="bg-white dark:bg-black border-b flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Operations Cockpit</CardTitle>
                        <CardDescription className="text-xs">AI-Powered Analytics Assistant</CardDescription>
                    </div>
                </div>
                <Button variant="ghost" size="sm">
                    <Save className="h-4 w-4 mr-2" /> Simpan Jawaban
                </Button>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-3 h-[400px]">
                {/* Left: Saved Questions */}
                <div className="border-r bg-muted/30 p-4 flex flex-col">
                    <h4 className="flex items-center gap-2 font-medium text-sm mb-4 text-muted-foreground">
                        <BookOpen className="h-4 w-4" /> Saved Templates
                    </h4>
                    <div className="space-y-2 flex-1">
                        {savedQuestions.map((q, i) => (
                            <button key={i} className="w-full text-left p-3 rounded-lg text-sm bg-white dark:bg-zinc-800 border hover:border-indigo-500 hover:shadow-sm transition-all text-zinc-700 dark:text-zinc-300">
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Chat & Visualization Area */}
                <div className="md:col-span-2 flex flex-col relative">
                    <ScrollArea className="flex-1 p-4 space-y-4">
                        {/* User Query Mock */}
                        <div className="flex justify-end mb-4">
                            <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm max-w-[80%]">
                                Kenapa margin turun bulan ini?
                            </div>
                        </div>

                        {/* AI Response Mock */}
                        <div className="flex justify-start items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="bg-white dark:bg-zinc-800 border p-4 rounded-2xl rounded-tl-none text-sm max-w-[90%] space-y-3 shadow-sm">
                                <p className="font-medium text-indigo-700 dark:text-indigo-400">Analisis Penurunan Margin (-4%):</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li><strong>55%</strong> akibat kenaikan biaya pewarna (Dyeing Cost) pada produk Navy.</li>
                                    <li><strong>30%</strong> dari lembur (Overtime) di lini produksi 2 minggu terakhir.</li>
                                    <li><strong>15%</strong> diskon volume ke pelanggan <em>PT. Mitra Abadi</em>.</li>
                                </ul>
                                <div className="p-3 bg-zinc-50 dark:bg-black rounded border mt-2">
                                    <p className="text-xs font-bold mb-2">Rekomendasi Tindakan:</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="h-7 text-xs">Cek Laporan Lembur</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs">Review Diskon Sales</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-white dark:bg-black mt-auto">
                        <div className="relative">
                            <Input placeholder="Tanya tentang data produksi, keuangan, atau pelanggan..." className="pr-12" />
                            <Button size="icon" className="absolute right-1 top-1 h-8 w-8 bg-indigo-600 hover:bg-indigo-700">
                                <Send className="h-4 w-4 text-white" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
