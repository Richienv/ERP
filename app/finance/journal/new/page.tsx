"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Plus, Trash2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Mock Accounts
const accounts = [
    { id: "ACC-1101", code: "1-1101", name: "Kas Kecil" },
    { id: "ACC-1102", code: "1-1102", name: "Bank BCA" },
    { id: "ACC-1105", code: "1-1105", name: "Persediaan Barang Dagang" },
    { id: "ACC-2101", code: "2-1101", name: "Hutang Usaha" },
    { id: "ACC-4101", code: "4-1101", name: "Penjualan Barang" },
    { id: "ACC-5101", code: "5-1101", name: "Harga Pokok Penjualan" },
    { id: "ACC-6101", code: "6-1101", name: "Beban Sewa" },
    { id: "ACC-6105", code: "6-1105", name: "Beban Perlengkapan Kantor" },
];

type JournalLine = {
    id: number;
    accountId: string;
    description: string;
    debit: number;
    credit: number;
};

export default function NewJournalEntryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [lines, setLines] = useState<JournalLine[]>([
        { id: 1, accountId: "", description: "", debit: 0, credit: 0 },
        { id: 2, accountId: "", description: "", debit: 0, credit: 0 },
    ]);

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const isBalanced = totalDebit === totalCredit && totalDebit > 0;

    const addLine = () => {
        setLines([
            ...lines,
            { id: Date.now(), accountId: "", description: "", debit: 0, credit: 0 },
        ]);
    };

    const removeLine = (id: number) => {
        if (lines.length > 2) {
            setLines(lines.filter((line) => line.id !== id));
        }
    };

    const updateLine = (id: number, field: keyof JournalLine, value: any) => {
        setLines(
            lines.map((line) =>
                line.id === id ? { ...line, [field]: value } : line
            )
        );
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) return;

        setIsLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        router.push("/finance/journal");
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/finance/journal">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Entri Jurnal Baru</h2>
                        <p className="text-muted-foreground">
                            Buat jurnal manual untuk penyesuaian atau transaksi lain
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
                {/* Header Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Transaksi</CardTitle>
                        <CardDescription>Detail umum jurnal</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Tanggal Transaksi</Label>
                                <Input id="date" type="date" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ref">No. Referensi</Label>
                                <Input id="ref" placeholder="Contoh: ADJ-2024-001" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Deskripsi</Label>
                                <Input id="desc" placeholder="Keterangan jurnal..." required />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Journal Lines */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Detail Jurnal</CardTitle>
                            <CardDescription>Daftar akun debit dan kredit</CardDescription>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addLine}>
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Baris
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Akun</TableHead>
                                    <TableHead>Keterangan (Opsional)</TableHead>
                                    <TableHead className="w-[200px]">Debit</TableHead>
                                    <TableHead className="w-[200px]">Kredit</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <Select
                                                value={line.accountId}
                                                onValueChange={(val) => updateLine(line.id, "accountId", val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih Akun" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map((acc) => (
                                                        <SelectItem key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={line.description}
                                                onChange={(e) => updateLine(line.id, "description", e.target.value)}
                                                placeholder="Keterangan baris..."
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={line.debit || ""}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    updateLine(line.id, "debit", val);
                                                    if (val > 0) updateLine(line.id, "credit", 0);
                                                }}
                                                placeholder="0"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={line.credit || ""}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    updateLine(line.id, "credit", val);
                                                    if (val > 0) updateLine(line.id, "debit", 0);
                                                }}
                                                placeholder="0"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLine(line.id)}
                                                disabled={lines.length <= 2}
                                                className="text-muted-foreground hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Totals */}
                        <div className="mt-6 flex justify-end">
                            <div className="w-[400px] space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Debit:</span>
                                    <span className="font-medium">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalDebit)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Kredit:</span>
                                    <span className="font-medium">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalCredit)}
                                    </span>
                                </div>
                                <div className={`flex justify-between text-sm font-bold pt-2 border-t ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                                    <span>Balance:</span>
                                    <span>
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(totalDebit - totalCredit)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {!isBalanced && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Jurnal Tidak Seimbang</AlertTitle>
                                <AlertDescription>
                                    Total debit dan kredit harus sama sebelum jurnal dapat disimpan.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end space-x-4">
                    <Button variant="outline" asChild>
                        <Link href="/finance/journal">
                            Batal
                        </Link>
                    </Button>
                    <Button type="submit" disabled={isLoading || !isBalanced}>
                        {isLoading ? (
                            <>Menyimpan...</>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Simpan Jurnal
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
