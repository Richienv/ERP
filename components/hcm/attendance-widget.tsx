import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Clock, MapPin, XCircle } from "lucide-react"

export function AttendanceWidget() {
    const attendanceStats = {
        present: 142,
        total: 156,
        late: 8,
        onLeave: 4,
        absent: 2
    }

    const widthPresent = (attendanceStats.present / attendanceStats.total) * 100
    const widthLate = (attendanceStats.late / attendanceStats.total) * 100
    const widthLeave = (attendanceStats.onLeave / attendanceStats.total) * 100

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        Kehadiran Hari Ini
                    </CardTitle>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                        09:41 WIB
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Main Stats Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">{attendanceStats.present} Hadir</span>
                        <span className="text-muted-foreground">dari {attendanceStats.total} Karyawan</span>
                    </div>
                    <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${widthPresent}%` }} />
                        <div className="h-full bg-yellow-500" style={{ width: `${widthLate}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${widthLeave}%` }} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" /> On Time
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-yellow-500" /> Telat ({attendanceStats.late})
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-blue-400" /> Cuti ({attendanceStats.onLeave})
                        </div>
                    </div>
                </div>

                {/* Late List */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Terlambat Hari Ini (Late)</h4>
                    <div className="space-y-2">
                        {[
                            { name: "Budi Santoso", time: "08:15", dept: "Produksi", avatar: "/avatars/01.png" },
                            { name: "Siti Rahma", time: "08:32", dept: "Sales", avatar: "/avatars/02.png" },
                            { name: "Doni Pratama", time: "08:45", dept: "Gudang", avatar: "/avatars/03.png" },
                        ].map((emp, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={emp.avatar} alt={emp.name} />
                                        <AvatarFallback>{emp.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">{emp.dept}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-red-600">+{emp.time.split(':')[1]}m</span>
                                    <span className="text-[10px] text-muted-foreground">{emp.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
