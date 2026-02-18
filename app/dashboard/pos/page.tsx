"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function PosPage() {
    const router = useRouter()

    return (
        <div className="mf-page flex items-center justify-center min-h-[60vh]">
            <div className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white p-10 max-w-md text-center space-y-5">
                <div className="h-16 w-16 bg-zinc-100 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mx-auto">
                    <Lock className="h-8 w-8 text-zinc-400" />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight">
                    Point of Sale (POS)
                </h1>
                <p className="text-sm text-zinc-500 font-medium">
                    Modul ini sedang dalam pengembangan dan belum tersedia untuk digunakan.
                </p>
                <div className="inline-block px-3 py-1 bg-amber-50 border-2 border-amber-300 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                    Segera Hadir
                </div>
                <div className="pt-2">
                    <Button
                        onClick={() => router.push("/dashboard")}
                        className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider"
                    >
                        Kembali ke Dasbor
                    </Button>
                </div>
            </div>
        </div>
    )
}
