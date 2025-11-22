"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function PlanningPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
            <h2 className="text-2xl font-bold">Perencanaan Produksi (MPS)</h2>
            <p className="text-muted-foreground">Jadwal induk produksi dan perencanaan kebutuhan material.</p>
            <Button>
                <Calendar className="mr-2 h-4 w-4" />
                Lihat Jadwal
            </Button>
        </div>
    );
}
