"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Database,
    Scale,
    Warehouse
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { mockCategories, mockUnits, mockWarehouses } from "@/components/documents/master/data";

export default function DataMasterPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Data Master</h2>
                    <p className="text-muted-foreground">
                        Kelola data referensi utama untuk seluruh sistem ERP.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Data
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="categories" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="categories" className="flex items-center">
                        <Database className="mr-2 h-4 w-4" />
                        Kategori Produk
                    </TabsTrigger>
                    <TabsTrigger value="units" className="flex items-center">
                        <Scale className="mr-2 h-4 w-4" />
                        Satuan Unit (UOM)
                    </TabsTrigger>
                    <TabsTrigger value="warehouses" className="flex items-center">
                        <Warehouse className="mr-2 h-4 w-4" />
                        Gudang & Lokasi
                    </TabsTrigger>
                </TabsList>

                {/* Categories Tab */}
                <TabsContent value="categories" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Kategori Produk</CardTitle>
                                    <CardDescription>Pengelompokan produk dan barang inventaris.</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="relative w-[250px]">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Cari kategori..." className="pl-8 h-9" />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama Kategori</TableHead>
                                        <TableHead>Deskripsi</TableHead>
                                        <TableHead>Jumlah Item</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockCategories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-mono">{category.code}</TableCell>
                                            <TableCell className="font-medium">{category.name}</TableCell>
                                            <TableCell>{category.description}</TableCell>
                                            <TableCell>{category.itemCount}</TableCell>
                                            <TableCell>
                                                <Badge variant={category.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                    {category.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                        <DropdownMenuItem>Edit Kategori</DropdownMenuItem>
                                                        <DropdownMenuItem>Lihat Item</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600">Hapus</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Units Tab */}
                <TabsContent value="units" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Satuan Unit (UOM)</CardTitle>
                                    <CardDescription>Definisi satuan pengukuran untuk produk.</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="relative w-[250px]">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Cari satuan..." className="pl-8 h-9" />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Simbol</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockUnits.map((unit) => (
                                        <TableRow key={unit.id}>
                                            <TableCell className="font-medium">{unit.name}</TableCell>
                                            <TableCell className="font-mono">{unit.symbol}</TableCell>
                                            <TableCell>{unit.type}</TableCell>
                                            <TableCell>
                                                <Badge variant={unit.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                    {unit.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600">Hapus</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Warehouses Tab */}
                <TabsContent value="warehouses" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Gudang & Lokasi</CardTitle>
                                    <CardDescription>Daftar lokasi penyimpanan fisik.</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="relative w-[250px]">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Cari gudang..." className="pl-8 h-9" />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama Gudang</TableHead>
                                        <TableHead>Lokasi</TableHead>
                                        <TableHead>Kapasitas</TableHead>
                                        <TableHead>Manajer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockWarehouses.map((wh) => (
                                        <TableRow key={wh.id}>
                                            <TableCell className="font-mono">{wh.code}</TableCell>
                                            <TableCell className="font-medium">{wh.name}</TableCell>
                                            <TableCell>{wh.location}</TableCell>
                                            <TableCell>{wh.capacity.toLocaleString()}</TableCell>
                                            <TableCell>{wh.manager}</TableCell>
                                            <TableCell>
                                                <Badge variant={wh.status === 'ACTIVE' ? 'default' : 'outline'} className={wh.status === 'MAINTENANCE' ? 'text-yellow-600 border-yellow-600' : ''}>
                                                    {wh.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>Edit Detail</DropdownMenuItem>
                                                        <DropdownMenuItem>Lihat Stok</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600">Nonaktifkan</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
