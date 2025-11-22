"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";

export default function NewLeadPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        router.push("/sales/leads");
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/sales/leads">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Tambah Prospek Baru</h2>
                        <p className="text-muted-foreground">
                            Buat data prospek baru untuk pipeline penjualan
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Prospek</CardTitle>
                        <CardDescription>Detail utama prospek potensial</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Judul Prospek</Label>
                                <Input id="title" placeholder="Contoh: Pengadaan Laptop Kantor" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company">Perusahaan</Label>
                                <Input id="company" placeholder="Nama Perusahaan" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact">Nama Kontak</Label>
                                <Input id="contact" placeholder="Nama Lengkap" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="email@contoh.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="value">Nilai Estimasi (IDR)</Label>
                                <Input id="value" type="number" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="probability">Probabilitas (%)</Label>
                                <Input id="probability" type="number" min="0" max="100" placeholder="50" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end space-x-4">
                    <Button variant="outline" asChild>
                        <Link href="/sales/leads">Batal</Link>
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <>Menyimpan...</>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Simpan Prospek
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
