"use client";

import {
    Plus,
    Search,
    Filter,
    ClipboardCheck,
    AlertOctagon,
    CheckCircle,
    XCircle,
    Microscope,
    Camera
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const INSPECTIONS = [
    { id: "QC-2026-880", batch: "Batch #102 - Blue Jeans", stage: "Final", result: "Pass", defects: 0, inspector: "Dewi P.", date: "Today" },
    { id: "QC-2026-881", batch: "Batch #103 - White Shirts", stage: "Sewing", result: "Fail", defects: 12, inspector: "Siti A.", date: "Today" },
    { id: "QC-2026-879", batch: "Batch #099 - Socks", stage: "Material", result: "Pass", defects: 0, inspector: "Budi S.", date: "Yesterday" },
    { id: "QC-2026-878", batch: "Batch #100 - Jackets", stage: "Final", result: "Pass", defects: 2, inspector: "Dewi P.", date: "Yesterday" },
    { id: "QC-2026-875", batch: "Batch #101 - Hats", stage: "Sewing", result: "Fail", defects: 5, inspector: "Rina N.", date: "12/01" },
];

export default function QualityControlPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Kontrol Kualitas (QC)</h2>
                    <p className="text-muted-foreground">Inspeksi standar mutu dan identifikasi cacat.</p>
                </div>
                <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                    <Plus className="mr-2 h-4 w-4" /> New Inspection
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metrics */}
                <Card className="bg-emerald-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="uppercase text-xs font-bold text-emerald-800">Pass Rate (Today)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-900">92.5%</div>
                        <p className="text-xs text-emerald-700 mt-1 font-bold">+1.2% from average</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="uppercase text-xs font-bold text-red-800">Defect Count</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-red-900">14 <span className="text-sm font-medium">Items</span></div>
                        <p className="text-xs text-red-700 mt-1 font-bold">Main Issue: Stiching on Line 2</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="uppercase text-xs font-bold text-blue-800">Pending Inspection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-900">8 <span className="text-sm font-medium">Batches</span></div>
                        <p className="text-xs text-blue-700 mt-1 font-bold">Need priority on Batch #105</p>
                    </CardContent>
                </Card>
            </div>

            {/* Inspection Table */}
            <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden mt-6">
                <CardHeader className="bg-zinc-50 border-b border-black/10">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5" /> Inspection Log
                            </CardTitle>
                            <CardDescription>Recent QA/QC activities</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative w-[200px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="Search Batch..." className="h-8 pl-8 border-black text-xs" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <div className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[120px] font-bold text-black uppercase text-xs">ID</TableHead>
                                <TableHead className="font-bold text-black uppercase text-xs">Batch Info</TableHead>
                                <TableHead className="font-bold text-black uppercase text-xs">Stage</TableHead>
                                <TableHead className="font-bold text-black uppercase text-xs">Inspector</TableHead>
                                <TableHead className="font-bold text-black uppercase text-xs">Defects</TableHead>
                                <TableHead className="font-bold text-black uppercase text-xs">Result</TableHead>
                                <TableHead className="text-right font-bold text-black uppercase text-xs">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {INSPECTIONS.map((qc) => (
                                <TableRow key={qc.id} className="cursor-pointer hover:bg-zinc-50">
                                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">{qc.id}</TableCell>
                                    <TableCell className="font-bold">{qc.batch}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] uppercase border-black/20 text-muted-foreground">{qc.stage}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-medium">{qc.inspector}</TableCell>
                                    <TableCell>
                                        {qc.defects > 0 ? (
                                            <span className="font-bold text-red-600 flex items-center gap-1"><AlertOctagon className="h-3 w-3" /> {qc.defects}</span>
                                        ) : (
                                            <span className="text-emerald-600 text-xs font-bold">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={qc.result === 'Pass' ? 'default' : 'destructive'} className={`text-[10px] uppercase font-bold border-black shadow-sm w-16 justify-center ${qc.result === 'Pass' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                            {qc.result}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" className="h-7 text-[10px] uppercase font-bold border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]">Details</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
