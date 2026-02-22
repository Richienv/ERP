"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const VENDOR_DATA = [
    { name: "PT. Supplier Utama", rating: "A", onTime: "98%", defects: "0.2%", leadTime: "3 hari", status: "Excelente" },
    { name: "CV. Material Jaya", rating: "B", onTime: "85%", defects: "1.5%", leadTime: "5 hari", status: "Good" },
    { name: "UD. Sumber Alam", rating: "C", onTime: "70%", defects: "4.2%", leadTime: "8 hari", status: "Risk" },
    { name: "Global Electronics", rating: "A", onTime: "95%", defects: "0.5%", leadTime: "14 hari", status: "Excelente" },
]

export function VendorPerformanceWidget() {
    return (
        <div className="relative">
            <Badge className="absolute -top-2 -right-2 z-10 bg-amber-100 text-amber-800 border border-amber-300 text-[8px] font-black uppercase tracking-widest rounded-none px-1.5 py-0.5">
                Data Demo
            </Badge>
        <Card className="col-span-1 md:col-span-3 lg:col-span-4 h-full">
            <CardHeader>
                <CardTitle>Performa Supplier (Top 5)</CardTitle>
                <CardDescription>KPI Kunci: Ketepatan waktu, Cacat, dan Skor Rating</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-center">Rating</TableHead>
                            <TableHead className="text-center">On-Time %</TableHead>
                            <TableHead className="text-center">Defect Rate</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {VENDOR_DATA.map((vendor) => (
                            <TableRow key={vendor.name}>
                                <TableCell className="font-medium">{vendor.name}</TableCell>
                                <TableCell className="text-center">
                                    <span className={`
                                    inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold
                                    ${vendor.rating === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                            vendor.rating === 'B' ? 'bg-blue-100 text-blue-700' :
                                                'bg-orange-100 text-orange-700'}
                                `}>
                                        {vendor.rating}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">{vendor.onTime}</TableCell>
                                <TableCell className="text-center text-muted-foreground">{vendor.defects}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`
                                    ${vendor.status === 'Excelente' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                            vendor.status === 'Risk' ? 'border-red-200 text-red-700 bg-red-50' :
                                                'border-blue-200 text-blue-700 bg-blue-50'}
                                `}>
                                        {vendor.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        </div>
    )
}
