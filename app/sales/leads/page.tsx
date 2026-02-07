"use client";

import { LeadKanban } from "@/components/sales/leads/lead-kanban";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List as ListIcon, Flame } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function LeadsPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
                        Hunter's Funnel <Flame className="h-8 w-8 text-orange-500 fill-orange-500 animate-pulse" />
                    </h2>
                    <p className="text-muted-foreground font-medium">
                        Prioritize "Hot" leads with thermal scoring. Jangan biarkan deal dingin!
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" className="border-2 font-bold">
                        <ListIcon className="mr-2 h-4 w-4" />
                        Mode Cepat
                    </Button>
                    <Button className="font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all border-2 border-black">
                        <Plus className="mr-2 h-4 w-4" />
                        Prospek Baru
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Total Pipeline</div>
                    <div className="text-2xl font-black">Rp 1.5 M</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Hot Leads (&gt;80%)</div>
                    <div className="text-2xl font-black text-orange-600 flex items-center gap-2">
                        3 <Flame className="h-5 w-5 fill-orange-600" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] bg-card">
                <LeadKanban />
            </div>
        </div>
    );
}
