"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function QualityControlPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
            <h2 className="text-2xl font-bold">Kontrol Kualitas (QC)</h2>
            <p className="text-muted-foreground">Inspeksi bahan baku, WIP, dan barang jadi.</p>
            <Button>
                <Plus className="mr-2 h-4 w-4" />
                Buat Inspeksi Baru
            </Button>
        </div>
    );
}
