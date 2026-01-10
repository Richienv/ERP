"use client";

import {
    Plus,
    Search,
    Filter,
    Settings,
    Activity,
    AlertCircle,
    Power,
    Clock,
    BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Mock Data for Work Centers
const MACHINES = [
    { id: "MC-001", name: "Cutting Machine CNC", type: "Cutting", status: "Running", load: 85, efficiency: 92, operator: "Budi S.", nextMaint: "20/01" },
    { id: "MC-002", name: "Sewing Station A1", type: "Sewing", status: "Idle", load: 0, efficiency: 88, operator: "-", nextMaint: "22/01" },
    { id: "MC-003", name: "Sewing Station A2", type: "Sewing", status: "Running", load: 95, efficiency: 78, operator: "Siti A.", nextMaint: "22/01" },
    { id: "MC-004", name: "Industrial Washer", type: "Washing", status: "Down", load: 0, efficiency: 0, operator: "-", nextMaint: "OVERDUE", issue: "Motor Failure" },
    { id: "MC-005", name: "Dyeing Vat #4", type: "Dyeing", status: "Running", load: 100, efficiency: 98, operator: "Joko", nextMaint: "30/01" },
    { id: "MC-006", name: "Ironing Press", type: "Finishing", status: "Running", load: 60, efficiency: 85, operator: "Rina", nextMaint: "05/02" },
];

export default function WorkCentersPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Pusat Kerja & Routing</h2>
                    <p className="text-muted-foreground">Monitor status mesin dan kapasitas produksi.</p>
                </div>
                <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                    <Plus className="mr-2 h-4 w-4" /> Tambah Mesin
                </Button>
            </div>

            {/* Overall Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatusCard label="Total Machines" value="24" icon={Settings} />
                <StatusCard label="Active" value="18" icon={Activity} color="text-emerald-600" />
                <StatusCard label="Down / Maint" value="2" icon={AlertCircle} color="text-red-600" />
                <StatusCard label="Avg Efficiency" value="87%" icon={BarChart3} color="text-blue-600" />
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 py-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search machines..." className="pl-9 border-black/20" />
                </div>
                <div className="flex gap-2">
                    {['All', 'Cutting', 'Sewing', 'Washing', 'Finishing'].map((filter) => (
                        <Button key={filter} variant="outline" size="sm" className="border-black hover:bg-black hover:text-white transition-colors">{filter}</Button>
                    ))}
                </div>
            </div>

            {/* Machine Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MACHINES.map((mc) => (
                    <Card key={mc.id} className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <CardHeader className="pb-2 border-b border-black/5 bg-zinc-50/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg font-black uppercase text-zinc-900">{mc.name}</CardTitle>
                                    <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                                        <span>{mc.id}</span>
                                        <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                                        <span>{mc.type}</span>
                                    </div>
                                </div>
                                <StatusBadge status={mc.status} />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {/* Load Meter */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                                    <span>Current Load</span>
                                    <span>{mc.load}%</span>
                                </div>
                                <Progress value={mc.load} className="h-3 border border-black/10 bg-zinc-100" indicatorClassName={mc.status === 'Down' ? 'bg-zinc-300' : mc.load > 90 ? 'bg-red-500' : 'bg-black'} />
                            </div>

                            {/* Efficiency & Operator */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="border border-black/10 rounded p-2 bg-white">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Efficiency</span>
                                    <span className="font-bold text-lg">{mc.efficiency}%</span>
                                </div>
                                <div className="border border-black/10 rounded p-2 bg-white">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Operator</span>
                                    <span className="font-bold text-lg truncate">{mc.operator}</span>
                                </div>
                            </div>

                            {mc.status === 'Down' && (
                                <div className="bg-red-50 border border-red-200 p-2 rounded text-xs text-red-700 font-bold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    ISSUE: {mc.issue}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="pt-2 pb-4 flex justify-between items-center text-xs text-muted-foreground border-t border-black/5 bg-zinc-50/50">
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Next Maint: <span className={mc.nextMaint === 'OVERDUE' ? 'text-red-600 font-bold underline' : 'font-bold'}>{mc.nextMaint}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold hover:bg-black hover:text-white transition-colors">Details <Settings className="ml-1 h-3 w-3" /></Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function StatusCard({ label, value, icon: Icon, color = "text-black" }: any) {
    return (
        <Card className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                </div>
                <Icon className={`h-8 w-8 opacity-20 ${color}`} />
            </CardContent>
        </Card>
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'Running') {
        return <Badge className="bg-emerald-100 text-emerald-800 border-black hover:bg-emerald-200">RUNNING</Badge>
    }
    if (status === 'Down') {
        return <Badge variant="destructive" className="border-black shadow-sm animate-pulse">DOWN</Badge>
    }
    return <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-black">IDLE</Badge>
}
