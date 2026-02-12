"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { getGLAccountsList, postJournalEntry } from "@/lib/actions/finance";

type GLAccountOption = {
    id: string
    code: string
    name: string
    type: string
}

type JournalLine = {
    id: number;
    accountId: string;
    description: string;
    debit: number;
    credit: number;
};

export default function NewJournalEntryPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<GLAccountOption[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState("");
    const [description, setDescription] = useState("");
    const [lines, setLines] = useState<JournalLine[]>([
        { id: 1, accountId: "", description: "", debit: 0, credit: 0 },
        { id: 2, accountId: "", description: "", debit: 0, credit: 0 },
    ]);

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    useEffect(() => {
        const loadAccounts = async () => {
            setLoadingAccounts(true);
            try {
                const accountData = await getGLAccountsList();
                setAccounts(accountData);
            } catch {
                toast.error("Gagal memuat daftar akun");
            } finally {
                setLoadingAccounts(false);
            }
        };

        loadAccounts();
    }, []);

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
        if (!isBalanced) {
            toast.error("Jurnal harus balance sebelum disimpan");
            return;
        }

        if (!description.trim()) {
            toast.error("Deskripsi jurnal wajib diisi");
            return;
        }

        const validLines = lines.filter((line) => (line.debit > 0 || line.credit > 0));
        if (validLines.length < 2) {
            toast.error("Minimal dua baris akun dengan nominal");
            return;
        }

        const hasInvalidLine = validLines.some((line) => {
            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);
            return !line.accountId || (debit > 0 && credit > 0) || (debit <= 0 && credit <= 0);
        });

        if (hasInvalidLine) {
            toast.error("Setiap baris harus memiliki akun serta nilai debit/kredit yang valid");
            return;
        }

        setIsLoading(true);
        try {
            const accountById = new Map(accounts.map((acc) => [acc.id, acc]));
            const journalLines = validLines.map((line) => {
                const account = accountById.get(line.accountId);
                if (!account) throw new Error("Akun jurnal tidak ditemukan");
                return {
                    accountCode: account.code,
                    debit: Number(line.debit || 0),
                    credit: Number(line.credit || 0),
                    description: line.description || description.trim(),
                };
            });

            const postResult = await postJournalEntry({
                date: new Date(transactionDate),
                reference: reference.trim(),
                description: description.trim(),
                lines: journalLines,
            });

            if (!postResult.success) {
                toast.error(("error" in postResult ? postResult.error : null) || "Gagal menyimpan jurnal");
                return;
            }

            toast.success("Jurnal berhasil diposting");
            router.push("/finance/journal");
        } catch (error: any) {
            toast.error(error?.message || "Terjadi kesalahan saat menyimpan jurnal");
        } finally {
            setIsLoading(false);
        }
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
                                <Input
                                    id="date"
                                    type="date"
                                    required
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ref">No. Referensi</Label>
                                <Input
                                    id="ref"
                                    placeholder="Contoh: ADJ-2024-001"
                                    required
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Deskripsi</Label>
                                <Input
                                    id="desc"
                                    placeholder="Keterangan jurnal..."
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
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
                                                disabled={loadingAccounts}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={loadingAccounts ? "Loading akun..." : "Pilih Akun"} />
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
                    <Button type="submit" disabled={isLoading || !isBalanced || loadingAccounts || accounts.length === 0}>
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
