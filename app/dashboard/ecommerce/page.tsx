"use client";

import { ShoppingBag, Globe, BarChart3, RefreshCw, Box, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EcommercePage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">E-commerce</h2>
                    <p className="text-muted-foreground">Manajemen Toko Online & Integrasi Marketplace</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Globe className="mr-2 h-4 w-4" /> Lihat Toko
                    </Button>
                    <Button>
                        <RefreshCw className="mr-2 h-4 w-4" /> Sinkronisasi Katalog
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pesanan Online</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">128</div>
                        <p className="text-xs text-muted-foreground flex items-center text-emerald-500">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +15% dari bulan lalu
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendapatan Online</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 45.2Jt</div>
                        <p className="text-xs text-muted-foreground flex items-center text-emerald-500">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +8.2% dari bulan lalu
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pengunjung Website</CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">2,450</div>
                        <p className="text-xs text-muted-foreground flex items-center text-rose-500">
                            <ArrowDownRight className="h-3 w-3 mr-1" /> -3% dari bulan lalu
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status Sinkronisasi</CardTitle>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">Aktif</div>
                        <p className="text-xs text-muted-foreground">Terakhir sinkron: 5 menit lalu</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Orders */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Pesanan Terbaru</CardTitle>
                        <CardDescription>Pesanan dari website dan marketplace</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { id: "WEB-1024", customer: "Rina S.", item: "Cotton Combed 30s (10kg)", total: "Rp 1.250.000", status: "Perlu Dikirim", source: "Website" },
                                { id: "TOK-8821", customer: "Budi J.", item: "Polo Shirt Premium (2pcs)", total: "Rp 170.000", status: "Selesai", source: "Tokopedia" },
                                { id: "SP-3321", customer: "Siti A.", item: "Benang Jahit (5 set)", total: "Rp 225.000", status: "Diproses", source: "Shopee" },
                                { id: "WEB-1023", customer: "Andi P.", item: "Rayon Viscose (50kg)", total: "Rp 4.750.000", status: "Menunggu Pembayaran", source: "Website" },
                            ].map((order) => (
                                <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                                            <ShoppingBag className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">{order.id} • {order.customer}</p>
                                                <Badge variant="outline" className="text-[10px]">{order.source}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{order.item}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">{order.total}</p>
                                        <Badge variant={
                                            order.status === "Selesai" ? "default" :
                                                order.status === "Perlu Dikirim" ? "destructive" :
                                                    "secondary"
                                        } className="text-[10px] mt-1">
                                            {order.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Integration Settings */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Pengaturan Integrasi</CardTitle>
                        <CardDescription>Kelola koneksi marketplace</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-xs">TOK</div>
                                <div>
                                    <p className="font-medium">Tokopedia</p>
                                    <p className="text-xs text-muted-foreground">Connected as TextileOfficial</p>
                                </div>
                            </div>
                            <Switch checked={true} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 font-bold text-xs">SHP</div>
                                <div>
                                    <p className="font-medium">Shopee</p>
                                    <p className="text-xs text-muted-foreground">Connected as TextileStore</p>
                                </div>
                            </div>
                            <Switch checked={true} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xs">LZD</div>
                                <div>
                                    <p className="font-medium">Lazada</p>
                                    <p className="text-xs text-muted-foreground">Not Connected</p>
                                </div>
                            </div>
                            <Switch checked={false} />
                        </div>

                        <div className="pt-4">
                            <Button variant="outline" className="w-full">
                                Kelola API Keys
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
