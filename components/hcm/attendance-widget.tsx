import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

interface AttendanceStats {
    present: number
    total: number
    late: number
    onLeave: number
    absent: number
    attendanceRate?: number
    timestamp?: string
}

interface AttendanceWidgetProps {
    stats?: AttendanceStats
}

export function AttendanceWidget({ stats }: AttendanceWidgetProps) {
    const attendanceStats: AttendanceStats = stats || {
        present: 0,
        total: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        attendanceRate: 0,
        timestamp: new Date().toISOString(),
    }

    const base = Math.max(1, attendanceStats.total)
    const widthPresent = (attendanceStats.present / base) * 100
    const widthLate = (attendanceStats.late / base) * 100
    const widthLeave = (attendanceStats.onLeave / base) * 100

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Clock className="h-4 w-4 text-blue-500" />
                        Kehadiran Hari Ini
                    </CardTitle>
                    <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                        {attendanceStats.timestamp
                            ? new Date(attendanceStats.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                            : "-"}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium">{attendanceStats.present} Hadir</span>
                        <span className="text-muted-foreground">dari {attendanceStats.total} Karyawan</span>
                    </div>
                    <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full bg-emerald-500" style={{ width: `${widthPresent}%` }} />
                        <div className="h-full bg-yellow-500" style={{ width: `${widthLate}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${widthLeave}%` }} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div className="rounded-md border bg-zinc-50 p-2">
                        <p className="text-muted-foreground">Telat</p>
                        <p className="text-sm font-semibold">{attendanceStats.late}</p>
                    </div>
                    <div className="rounded-md border bg-zinc-50 p-2">
                        <p className="text-muted-foreground">Cuti</p>
                        <p className="text-sm font-semibold">{attendanceStats.onLeave}</p>
                    </div>
                    <div className="rounded-md border bg-zinc-50 p-2">
                        <p className="text-muted-foreground">Tidak Hadir</p>
                        <p className="text-sm font-semibold">{attendanceStats.absent}</p>
                    </div>
                    <div className="rounded-md border bg-zinc-50 p-2">
                        <p className="text-muted-foreground">Rate</p>
                        <p className="text-sm font-semibold">{attendanceStats.attendanceRate || 0}%</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
