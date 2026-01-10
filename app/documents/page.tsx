"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download, Share2, Plus, Info } from "lucide-react"

import { MasterDataHealth } from "@/components/documents/master-data-health"
import { DuplicateDetector } from "@/components/documents/duplicate-detector"
import { ImpactAnalyzer } from "@/components/documents/impact-analyzer"
import { BomVersionControl } from "@/components/documents/bom-version-control"
import { EquipmentTracker } from "@/components/documents/equipment-tracker"
import { BatchTraceability } from "@/components/documents/batch-traceability"

export default function DocumentsPage() {
    return (
        <div className="min-h-screen w-full bg-zinc-50/50 dark:bg-black p-6 md:p-8 space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dokumen & Master Data</h1>
                    <p className="text-muted-foreground">Pusat kendali "Single Source of Truth" untuk data pabrik & kepatuhan.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Info className="mr-2 h-4 w-4" /> Help
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Upload Dokumen
                    </Button>
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="master-data" className="space-y-6">
                <TabsList className="bg-white dark:bg-zinc-900 border p-1 h-auto">
                    <TabsTrigger value="master-data" className="px-4 py-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-200 border border-transparent">
                        Intelligent Master Data
                    </TabsTrigger>
                    <TabsTrigger value="production-docs" className="px-4 py-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-200 border border-transparent">
                        Dokumentasi Produksi
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="px-4 py-2">
                        ISO & Compliance
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: MASTER DATA DASHBOARD */}
                <TabsContent value="master-data" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* 1. Health Scorecard */}
                    <section>
                        <MasterDataHealth />
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 2. Duplicate Detector */}
                        <section>
                            <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Data Hygiene Strategy</h3>
                            <DuplicateDetector />
                        </section>

                        {/* 3. Impact Analyzer */}
                        <section>
                            <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Risk Management</h3>
                            <ImpactAnalyzer />
                        </section>
                    </div>
                </TabsContent>

                {/* TAB 2: PRODUCTION DOCUMENTATION */}
                <TabsContent value="production-docs" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1. BOM Versions */}
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Engineering Change Mgmt</h3>
                            <BomVersionControl />
                        </div>

                        {/* 2. Equipment & Traceability side-by-side on large screens, stacked on small */}
                        <div className="lg:col-span-1 space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Equipment Mgmt</h3>
                                <EquipmentTracker />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Traceability</h3>
                                <BatchTraceability />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="compliance">
                    <div className="flex h-[400px] items-center justify-center border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">Modul Audit & ISO Compliance (Coming Soon)</p>
                    </div>
                </TabsContent>

            </Tabs>

        </div>
    )
}
