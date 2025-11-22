"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function WorkOrdersPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
            <h2 className="text-2xl font-bold">Perintah Kerja (SPK)</h2>
            <p className="text-muted-foreground">Distribusi tugas ke operator dan pusat kerja.</p>
            <Button>
                <Plus className="mr-2 h-4 w-4" />
                Buat SPK Baru
            </Button>
        </div>
    );
}
