"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    ClipboardList,
    User,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

// Mock Data for Work Orders (SPK)
const SPK_DATA = [
    { id: "SPK-2026-001", task: "Cutting: Pola Jeans Size 32", assignee: "Budi Santoso", role: "Cutter", machine: "Cutter Manual #1", priority: "High", status: "In Progress", progress: 65, deadline: "Today, 14:00" },
    { id: "SPK-2026-002", task: "Sewing: Side Seams Batch A", assignee: "Siti Aminah", role: "Sewe", machine: "Juki DDL-8700", priority: "Normal", status: "Pending", progress: 0, deadline: "Tomorrow, 09:00" },
    { id: "SPK-2026-003", task: "Washing: Enzyme Wash Test", assignee: "Joko Anwar", role: "Operator", machine: "Industrial Washer 50kg", priority: "Critical", status: "In Progress", progress: 80, deadline: "Today, 16:00" },
    { id: "SPK-2026-004", task: "Finishing: Ironing & Folding", assignee: "Rina Nose", role: "Finisher", machine: "Steam Station A", priority: "Normal", status: "Completed", progress: 100, deadline: "Yesterday" },
    { id: "SPK-2026-005", task: "QC: Random Sampling Batch 001", assignee: "Dewi Persik", role: "QC Staff", machine: "Inspection Table 2", priority: "High", status: "Pending", progress: 0, deadline: "Today, 11:00" },
];

export default function WorkOrdersPage() {
    const [selectedSPK, setSelectedSPK] = useState<typeof SPK_DATA[0] | null>(null);

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Perintah Kerja (SPK)</h2>
                    <p className="text-muted-foreground">Distribusi tugas operasional harian.</p>
                </div>
                <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                    <Plus className="mr-2 h-4 w-4" /> Buat SPK Baru
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 bg-white p-2 rounded-xl border border-black shadow-sm">
                <div className="flex items-center flex-1 gap-2 max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari No. SPK, Operator..." className="pl-9 border-black/20 focus-visible:ring-black" />
                    </div>
                    <Button variant="outline" size="icon" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Status:</span>
                    <Badge variant="outline" className="cursor-pointer hover:bg-black hover:text-white transition-colors border-black">Active (3)</Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-black hover:text-white transition-colors border-black">Pending (2)</Badge>
                </div>
            </div>

            {/* SPK Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SPK_DATA.map((spk) => (
                    <Card
                        key={spk.id}
                        className="group cursor-pointer border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        onClick={() => setSelectedSPK(spk)}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className={`border-black ${spk.priority === 'Critical' ? 'bg-red-100 text-red-700 font-bold' :
                                        spk.priority === 'High' ? 'bg-orange-50 text-orange-700' :
                                            'bg-zinc-50'
                                    }`}>
                                    {spk.priority}
                                </Badge>
                                <span className="text-xs font-mono font-bold text-muted-foreground">{spk.id}</span>
                            </div>
                            <CardTitle className="text-lg font-bold leading-tight mt-2">{spk.task}</CardTitle>
                            <CardDescription className="flex items-center gap-2 text-xs font-medium">
                                <User className="h-3 w-3" /> {spk.assignee} ({spk.role})
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>Progress</span>
                                        <span>{spk.progress}%</span>
                                    </div>
                                    <Progress value={spk.progress} className="h-2 border border-black/10 bg-zinc-100" indicatorClassName="bg-black" />
                                </div>

                                <div className="pt-3 border-t border-black/10 flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 text-muted-foreground bg-zinc-50 px-2 py-1 rounded border border-black/5">
                                        <Clock className="h-3 w-3" />
                                        <span>{spk.deadline}</span>
                                    </div>
                                    <Badge variant={spk.status === 'In Progress' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                        {spk.status}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Detail Sheet */}
            <Sheet open={!!selectedSPK} onOpenChange={(open) => !open && setSelectedSPK(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto border-l border-black">
                    {selectedSPK && (
                        <>
                            <SheetHeader className="pb-6 border-b border-black/10 bg-zinc-50 -mx-6 px-6 pt-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-white border-black text-black">{selectedSPK.status}</Badge>
                                    <span className="font-mono text-xs text-muted-foreground">{selectedSPK.id}</span>
                                </div>
                                <SheetTitle className="text-2xl font-black uppercase text-black">{selectedSPK.task}</SheetTitle>
                                <SheetDescription className="font-medium">Assigned to {selectedSPK.assignee} on {selectedSPK.machine}</SheetDescription>
                            </SheetHeader>

                            <div className="py-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Target Output</div>
                                        <div className="text-xl font-black">500 <span className="text-sm font-normal text-muted-foreground">Pcs</span></div>
                                    </div>
                                    <div className="p-4 border border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Efficiency</div>
                                        <div className="text-xl font-black text-emerald-600">92%</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4" /> Instruksi Kerja
                                    </h3>
                                    <div className="text-sm text-muted-foreground space-y-2 border-l-2 border-black/20 pl-4 py-1">
                                        <p>1. Check material quantity before starting.</p>
                                        <p>2. Set machine tension to level 4.</p>
                                        <p>3. Report any defect immediately to supervisor.</p>
                                        <p>4. Clean work area after shift.</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" /> Issue Log
                                    </h3>
                                    <Card className="bg-amber-50 border border-amber-200 shadow-none">
                                        <CardContent className="p-3 text-xs text-amber-800 flex gap-2 items-start">
                                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold block">Needle Breakage</span>
                                                <span>Reported 2 hours ago. Maintenance called.</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Button className="w-full bg-black text-white hover:bg-zinc-800 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-lg h-12">
                                    Update Status
                                </Button>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
