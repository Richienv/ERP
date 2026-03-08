"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OpeningBalancesGL } from "@/components/finance/opening-balances-gl"
import { OpeningBalancesAPAR } from "@/components/finance/opening-balances-apar"
import { IconScale, IconFileInvoice } from "@tabler/icons-react"

export default function OpeningBalancesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "gl"
    const [activeTab, setActiveTab] = useState(initialTab)

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Saldo Awal</h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">
                        Input saldo awal GL, hutang vendor (AP), dan piutang pelanggan (AR) untuk migrasi data
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black bg-white h-10 p-1 gap-1">
                    <TabsTrigger
                        value="gl"
                        className="data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs uppercase tracking-wider px-4 rounded-none border border-transparent data-[state=active]:border-black"
                    >
                        <IconScale size={14} className="mr-1.5" />
                        Saldo GL
                    </TabsTrigger>
                    <TabsTrigger
                        value="apar"
                        className="data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs uppercase tracking-wider px-4 rounded-none border border-transparent data-[state=active]:border-black"
                    >
                        <IconFileInvoice size={14} className="mr-1.5" />
                        Saldo AP/AR
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="gl" className="mt-6">
                    <OpeningBalancesGL />
                </TabsContent>

                <TabsContent value="apar" className="mt-6">
                    <OpeningBalancesAPAR />
                </TabsContent>
            </Tabs>
        </div>
    )
}
