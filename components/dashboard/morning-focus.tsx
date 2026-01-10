"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAI } from "@/components/ai/ai-context";

export function MorningFocus() {
    const { toggle } = useAI();

    return (
        <div className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 text-card-foreground shadow-sm col-span-1 md:col-span-2 row-span-2 min-h-[300px] flex flex-col justify-between group transition-colors">
            {/* Background Decor - Subtle now */}


            {/* Content */}
            <div className="relative z-10 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium border border-border/50 text-muted-foreground">
                    <Sun className="h-3 w-3 text-amber-500" />
                    <span>Fokus Pagi</span>
                </div>

                <h1 className="text-5xl font-medium leading-tight font-serif tracking-tight text-foreground">
                    Selamat Pagi, <br />
                    <span className="text-muted-foreground">Richie.</span>
                </h1>

                <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
                    Anda memiliki <span className="text-foreground font-medium">3 penawaran mendesak</span> menunggu tinjauan dan peringatan <span className="text-foreground font-medium">Level Stok</span> untuk kategori Elektronik.
                </p>
            </div>


        </div>
    );
}
