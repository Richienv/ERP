"use client";

import { Users, CalendarDays, Award, Check, X, FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const leaveRequests = [
    { id: 1, name: "Siti Rahma", role: "Operator Jahit", date: "12 Okt - 14 Okt", type: "Cuti Sakit", reason: "Demam tinggi dan flu berat, butuh istirahat total.", avatar: "SR", color: "bg-pink-500" },
    { id: 2, name: "Budi Santoso", role: "Teknisi Mesin", date: "20 Okt", type: "Izin", reason: "Mengurus perpanjangan STNK kendaraan bermotor.", avatar: "BS", color: "bg-blue-500" },
    { id: 3, name: "Ahmad Rizki", role: "Staff Gudang", date: "15 Nov - 18 Nov", type: "Cuti Tahunan", reason: "Acara keluarga di kampung halaman.", avatar: "AR", color: "bg-emerald-500" },
];

export function HumanResources() {
    return (
        <div className="relative bg-card border border-border/50 rounded-3xl flex flex-col overflow-hidden group hover:shadow-lg transition-all duration-300 md:col-span-3 min-h-[500px]">
            {/* Subtle Spotlight */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/5 blur-[60px] opacity-20 pointer-events-none" />

            {/* Grain Overlay */}
            <div
                className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            <div className="relative z-10 flex items-center justify-between p-6 border-b border-border/50">
                <div>
                    <h3 className="font-medium text-lg text-foreground">Manajemen SDM</h3>
                    <p className="text-xs text-muted-foreground mt-1">Kehadiran, Shift & Perizinan</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                    <Users className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
            </div>

            <div className="p-6 space-y-6 flex-1 flex flex-col">
                {/* Attendance Gauge/Stat */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                    <div className="relative h-16 w-16 flex items-center justify-center flex-shrink-0">
                        <svg className="absolute inset-0 h-full w-full -rotate-90 text-border">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" />
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-indigo-500" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - 0.946)} strokeLinecap="round" />
                        </svg>
                        <span className="text-sm font-bold text-foreground">95%</span>
                    </div>
                    <div>
                        <h4 className="font-medium text-foreground">Kehadiran Hari Ini</h4>
                        <p className="text-xs text-muted-foreground">142 / 150 Staf Hadir (8 Absen)</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600">Tepat Waktu: 135</Badge>
                            <Badge variant="secondary" className="text-[10px] h-5 bg-orange-500/10 text-orange-600">Terlambat: 7</Badge>
                        </div>
                    </div>
                </div>

                {/* Active Shift */}
                <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50">
                    <div className="flex  items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-medium text-foreground">Shift 1 (Pagi)</span>
                        </div>
                        <Badge className="bg-indigo-500 text-white hover:bg-indigo-600">Aktif</Badge>
                    </div>
                    <div className="flex -space-x-3 overflow-hidden pl-2">
                        <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback className="bg-pink-500 text-white text-[10px]">AD</AvatarFallback></Avatar>
                        <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback className="bg-blue-500 text-white text-[10px]">TS</AvatarFallback></Avatar>
                        <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback className="bg-emerald-500 text-white text-[10px]">RK</AvatarFallback></Avatar>
                        <div className="h-8 w-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">+45</div>
                    </div>
                </div>

                {/* Leave Requests Section - Enhanced */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Permintaan Izin / Cuti
                        </h4>
                        <Badge variant="outline" className="text-[10px]">3 Pending</Badge>
                    </div>

                    <ScrollArea className="flex-1 pr-3 -mr-3">
                        <div className="space-y-3">
                            {leaveRequests.map((req) => (
                                <Dialog key={req.id}>
                                    <DialogTrigger asChild>
                                        <div className="p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors border border-border/50 cursor-pointer group/item">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <Avatar className="h-9 w-9 border border-border">
                                                        <AvatarFallback className={`text-[10px] text-white ${req.color}`}>{req.avatar}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground group-hover/item:text-indigo-500 transition-colors">{req.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{req.role}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="outline" className="text-[10px] h-5 bg-background">{req.type}</Badge>
                                                            <span className="text-[10px] font-medium text-muted-foreground">{req.date}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Detail Permintaan Izin</DialogTitle>
                                            <DialogDescription>
                                                Tinjau permintaan izin dari karyawan.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-2">
                                            <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                                                <Avatar className="h-12 w-12 text-lg">
                                                    <AvatarFallback className={`text-white ${req.color}`}>{req.avatar}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="font-semibold">{req.name}</h4>
                                                    <p className="text-sm text-muted-foreground">{req.role}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-muted-foreground">Tipe Izin</label>
                                                    <p className="text-sm font-medium">{req.type}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
                                                    <p className="text-sm font-medium">{req.date}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Alasan</label>
                                                <p className="text-sm text-foreground bg-secondary/30 p-3 rounded-md border border-border/50">
                                                    "{req.reason}"
                                                </p>
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                                    <Check className="mr-2 h-4 w-4" /> Setujui
                                                </Button>
                                                <Button variant="outline" className="flex-1 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/30">
                                                    <X className="mr-2 h-4 w-4" /> Tolak
                                                </Button>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Training Summary Footer */}
                <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">Pelatihan: <span className="font-medium text-foreground">5 Jatuh Tempo</span></span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] hover:bg-secondary cursor-pointer">Lihat Semua</Badge>
                </div>

            </div>
        </div>
    );
}
