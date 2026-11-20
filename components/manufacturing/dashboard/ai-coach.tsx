"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, MessageSquare, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AICoachWidget() {

    return (
        <Card className="h-full flex flex-col border border-border shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border border-dashed">
                    <div className="p-1.5 bg-slate-900 rounded-md text-white shadow-sm border border-border">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-black dark:text-white">Production Coach</h3>
                </div>

                {/* Chat Bubble Interface */}
                <div className="space-y-3 flex-1 overflow-auto">
                    <div className="flex gap-2">
                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg rounded-tl-none border border-border shadow-sm text-xs">
                            <p className="mb-2"><strong>Wawasan Baru:</strong> Tingkat cacat (defects) naik +15% di Shift Malam, khususnya pada Mesin #04.</p>
                            <p className="text-muted-foreground">Penyebab potensial: Setelan suhu dyeing terlalu fluktuatif (di luar range ISO).</p>
                            <Button size="sm" className="w-full mt-2 h-7 text-xs bg-slate-900 hover:bg-zinc-800 text-white border border-border shadow-sm active:shadow-none transition-all">
                                Lihat Mesin #04
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border border-dashed">
                    <input
                        className="flex-1 text-xs border border-border rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-900 focus:outline-none focus:shadow-sm transition-all"
                        placeholder="Tanya AI tentang produksi..."
                    />
                    <Button aria-label="Berikutnya" size="icon" className="h-7 w-7 rounded-lg border border-border bg-white hover:bg-zinc-100 shadow-sm active:shadow-none transition-all">
                        <ChevronRight className="h-4 w-4 text-black" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
