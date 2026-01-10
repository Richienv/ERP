"use client"

import { useState } from "react"
import { TaskCard, StaffTask, TaskStatus } from "@/components/staff/task-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Factory,
    ClipboardCheck,
    Truck,
    Wrench,
    Plus,
    Filter
} from "lucide-react"

// Mock Data
const MOCK_TASKS: StaffTask[] = [
    // Production (Operator)
    {
        id: "T-101",
        title: "WO-WEAV-1023: Tenun CVC 30s",
        description: "Jalankan mesin, target 1.200 meter. Warna: Navy. Laporkan jika ada putus benang > 5x.",
        priority: "high",
        status: "running",
        time: "08:00 - 16:00",
        location: "Loom L-12",
        type: "production"
    },
    {
        id: "T-102",
        title: "Setup Mesin Celup D-03",
        description: "Persiapan batch DY-2026-002. Cek suhu dan pH air sebelum mulai.",
        priority: "medium",
        status: "pending",
        time: "10:30 BST",
        location: "Dyeing Area",
        type: "production"
    },

    // Quality (QC)
    {
        id: "Q-201",
        title: "Inspeksi Inline: Loom L-12",
        description: "Cek visual cacat kain di meter ke-500. Ukur GSM dan lebar aktual.",
        priority: "high",
        status: "pending",
        time: "Due: 11:00",
        location: "Loom L-12",
        type: "quality"
    },
    {
        id: "Q-202",
        title: "Final QC: Order ZARA-2026",
        description: "Sampling AQL 2.5 untuk 25 roll siap kirim.",
        priority: "medium",
        status: "completed",
        time: "09:15 Done",
        location: "QC Station B",
        type: "quality"
    },

    // Warehouse
    {
        id: "W-301",
        title: "Picking Benang: 600kg 30s",
        description: "Ambil dari Rak A-03, kirim ke Area Weaving untuk WO-WEAV-1023.",
        priority: "high",
        status: "pending",
        time: "Urgent",
        location: "Gudang Material",
        type: "warehouse"
    },
    {
        id: "W-302",
        title: "Terima Barang Jadi: 10 Roll",
        description: "Scan barcode masuk dari Finishing Line 2. Simpan di Rak F-12.",
        priority: "low",
        status: "pending",
        time: "Shift 2",
        location: "Gudang FG",
        type: "warehouse"
    },

    // Maintenance
    {
        id: "M-401",
        title: "Perbaikan Sensor: Loom L-12",
        description: "Investigasi 'Warp Break False Alarm'. Ganti sensor jika perlu.",
        priority: "high",
        status: "issue",
        time: "Report: 09:23",
        location: "Loom L-12",
        type: "maintenance"
    }
]

export default function StaffPage() {
    const [tasks, setTasks] = useState<StaffTask[]>(MOCK_TASKS)
    const [activeTab, setActiveTab] = useState("all")

    const handleStart = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: "running" as TaskStatus } : t))
    }

    const handleComplete = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: "completed" as TaskStatus } : t))
    }

    const handleReport = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: "issue" as TaskStatus } : t))
    }

    const filterTasks = (type: string) => {
        if (type === "all") return tasks.filter(t => t.status !== "completed")
        return tasks.filter(t => t.type === type)
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Halo, Staf</h1>
                    <p className="text-muted-foreground">Shift Pagi • Kamis, 9 Jan 2026</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                    </Button>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Lapor Isu
                    </Button>
                </div>
            </div>

            {/* Mobile-Friendly Tabs for Role Simulation */}
            <Tabs defaultValue="production" className="w-full space-y-6" onValueChange={setActiveTab}>
                <div className="pb-2 overflow-x-auto">
                    <TabsList className="w-full justify-start h-12 p-1 bg-white/50 backdrop-blur dark:bg-zinc-900/50 border rounded-xl gap-1">
                        <TabsTrigger value="production" className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/40 dark:data-[state=active]:text-indigo-300 rounded-lg px-3 py-2">
                            <Factory className="w-4 h-4 mr-2" />
                            Produksi
                            <Badge className="ml-2 bg-indigo-600 hover:bg-indigo-600 h-5 px-1.5 text-[10px]">2</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="quality" className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-700 dark:data-[state=active]:bg-teal-900/40 dark:data-[state=active]:text-teal-300 rounded-lg px-3 py-2">
                            <ClipboardCheck className="w-4 h-4 mr-2" />
                            Kualitas
                            <Badge className="ml-2 bg-teal-600 hover:bg-teal-600 h-5 px-1.5 text-[10px]">1</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="warehouse" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/40 dark:data-[state=active]:text-amber-300 rounded-lg px-3 py-2">
                            <Truck className="w-4 h-4 mr-2" />
                            Gudang
                            <Badge className="ml-2 bg-amber-600 hover:bg-amber-600 h-5 px-1.5 text-[10px]">2</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="maintenance" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/40 dark:data-[state=active]:text-red-300 rounded-lg px-3 py-2">
                            <Wrench className="w-4 h-4 mr-2" />
                            Teknisi
                            <Badge className="ml-2 bg-red-600 hover:bg-red-600 h-5 px-1.5 text-[10px]">1</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab Contents */}
                {["production", "quality", "warehouse", "maintenance"].map((type) => (
                    <TabsContent key={type} value={type} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filterTasks(type).length > 0 ? (
                                filterTasks(type).map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onStart={handleStart}
                                        onComplete={handleComplete}
                                        onReport={handleReport}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                    <ClipboardCheck className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="font-medium">Tidak ada tugas aktif</p>
                                    <p className="text-sm">Semua pekerjaan telah selesai untuk giliran ini.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
