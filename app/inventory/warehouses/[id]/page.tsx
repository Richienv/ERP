
import { getWarehouseDetails } from "@/app/actions/inventory"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Box, LayoutGrid, MapPin, Package } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export default async function WarehouseDetailPage(props: PageProps) {
    const params = await props.params
    const warehouse = await getWarehouseDetails(params.id)

    if (!warehouse) {
        notFound()
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/inventory/warehouses"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{warehouse.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <MapPin className="h-3 w-3" />
                        <span>{warehouse.address || 'No Address Set'}</span>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">{warehouse.code}</Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Sidebar: Detailed Stats */}
                <Card className="lg:col-span-1 h-fit border-blue-200 bg-blue-50/30">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Box className="h-5 w-5 text-blue-600" />
                            Warehouse Stats
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Valuation</p>
                            <p className="text-xl font-bold text-slate-900">{formatCurrency(warehouse.categories.reduce((a, b) => a + b.value, 0))}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Categories</p>
                            <p className="text-xl font-bold text-slate-900">{warehouse.categories.length}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Utilization</p>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mt-1">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                            </div>
                            <p className="text-xs text-right mt-1 text-slate-500">45% Capacity</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content: Categories Grid */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5" />
                            Storage Categories (Zones)
                        </h2>
                        <Button size="sm">Add Category</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {warehouse.categories.map((cat) => (
                            <Card key={cat.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                            <Package className="h-5 w-5 text-slate-600" />
                                        </div>
                                        <Badge variant="outline">{cat.itemCount} SKUs</Badge>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-900">{cat.name}</h3>
                                        <p className="text-xs text-muted-foreground">Contains {cat.stockCount.toLocaleString()} units</p>
                                    </div>

                                    <div className="pt-2 border-t flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Value</span>
                                        <span className="font-semibold text-emerald-700">{formatCurrency(cat.value)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {warehouse.categories.length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg text-slate-400">
                                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                <p>No categories assigned to this warehouse yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
