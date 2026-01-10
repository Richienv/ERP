import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X } from "lucide-react"

export function LeaveRequestWidget() {
    const requests = [
        { id: 1, name: "Anita Wulandari", type: "Cuti Tahunan", days: 2, dates: "20-21 Jan", avatar: "A" },
        { id: 2, name: "Rizky Ramadhan", type: "Izin Sakit", days: 1, dates: "14 Jan", avatar: "R" },
        { id: 3, name: "Dewi Putri", type: "Cuti Melahirkan", days: 90, dates: "Feb-Apr", avatar: "D" },
    ]

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                        Permintaan Cuti & Izin
                    </CardTitle>
                    <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">3 Pending</span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {requests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border">
                                    <AvatarFallback>{req.avatar}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium leading-none">{req.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className={`font-medium ${req.type === 'Izin Sakit' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {req.type}
                                        </span> • {req.dates} ({req.days} hari)
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700">
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    <Button variant="link" className="w-full h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                        Lihat Semua Permintaan
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
