"use client"

import Link from "next/link"
import { NB } from "@/lib/dialog-styles"
import { Button } from "@/components/ui/button"
import {
    Building,
    TrendingDown,
    CalendarClock,
    ShieldAlert,
    Percent,
    Lock,
    ArrowLeft,
    Calculator,
    Calendar,
    Factory,
    AlertTriangle,
    FolderTree,
    ExternalLink,
    Info,
} from "lucide-react"

export const dynamic = "force-dynamic"

const depreciationMethods = [
    {
        code: "STRAIGHT_LINE",
        name: "Garis Lurus",
        nameEn: "Straight-Line",
        icon: TrendingDown,
        color: "bg-blue-500",
        description:
            "Beban penyusutan sama rata setiap periode selama masa manfaat aset. Cocok untuk aset dengan pola penggunaan konsisten.",
        formula: "(Harga Perolehan - Nilai Residu) / Masa Manfaat",
    },
    {
        code: "DECLINING_BALANCE",
        name: "Saldo Menurun",
        nameEn: "Declining Balance",
        icon: Calculator,
        color: "bg-amber-500",
        description:
            "Beban penyusutan lebih besar di awal dan menurun setiap periode. Cocok untuk aset yang cepat kehilangan nilai seperti kendaraan.",
        formula: "Nilai Buku Awal Periode x Tarif Penyusutan",
    },
    {
        code: "UNITS_OF_PRODUCTION",
        name: "Unit Produksi",
        nameEn: "Units of Production",
        icon: Factory,
        color: "bg-emerald-500",
        description:
            "Beban penyusutan berdasarkan tingkat penggunaan atau output produksi aktual. Cocok untuk mesin pabrik.",
        formula: "(Harga Perolehan - Nilai Residu) / Total Unit x Unit Aktual",
    },
]

const frequencies = [
    {
        code: "MONTHLY",
        name: "Bulanan",
        nameEn: "Monthly",
        icon: Calendar,
        color: "bg-indigo-500",
        description:
            "Penyusutan dihitung dan dicatat setiap bulan. Memberikan laporan keuangan bulanan yang akurat. Direkomendasikan untuk perusahaan yang membuat laporan keuangan bulanan.",
        recommended: true,
    },
    {
        code: "YEARLY",
        name: "Tahunan",
        nameEn: "Yearly",
        icon: CalendarClock,
        color: "bg-violet-500",
        description:
            "Penyusutan dihitung dan dicatat sekali setahun di akhir tahun fiskal. Lebih sederhana tetapi kurang detail untuk laporan interim.",
        recommended: false,
    },
]

const fiscalPeriods = [
    { period: "Januari 2026", status: "locked" },
    { period: "Februari 2026", status: "locked" },
    { period: "Maret 2026", status: "open" },
    { period: "April 2026", status: "open" },
    { period: "Mei 2026", status: "future" },
    { period: "Juni 2026", status: "future" },
]

export default function FixedAssetSettingsPage() {
    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-500">
                    <div className="flex items-center gap-3">
                        <Building className="h-6 w-6 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">
                                Pengaturan Aset Tetap
                            </h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">
                                Konfigurasi metode penyusutan, frekuensi, dan pengaturan terkait
                            </p>
                        </div>
                    </div>
                    <Link href="/finance/fixed-assets">
                        <Button
                            variant="outline"
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Kembali
                        </Button>
                    </Link>
                </div>
            </div>

            {/* SECTION 1: Metode Penyusutan */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className={NB.sectionHead}>
                    <TrendingDown className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Metode Penyusutan</span>
                </div>
                <div className={NB.sectionBody}>
                    <p className="text-sm text-zinc-600 font-medium">
                        Sistem mendukung 3 metode penyusutan sesuai standar akuntansi Indonesia (PSAK 16).
                        Metode dipilih per-aset saat pendaftaran.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        {depreciationMethods.map((method) => {
                            const Icon = method.icon
                            return (
                                <div
                                    key={method.code}
                                    className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white"
                                >
                                    <div className={`${method.color} h-1.5`} />
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-5 w-5 text-zinc-700" />
                                            <div>
                                                <div className="font-black text-sm text-zinc-900">
                                                    {method.name}
                                                </div>
                                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                                    {method.nameEn}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-600 leading-relaxed">
                                            {method.description}
                                        </p>
                                        <div className="bg-zinc-50 border-2 border-zinc-200 p-2">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                                                Formula
                                            </div>
                                            <div className="text-xs font-mono font-bold text-zinc-700">
                                                {method.formula}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* SECTION 2: Frekuensi Penyusutan */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className={NB.sectionHead}>
                    <CalendarClock className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Frekuensi Penyusutan</span>
                </div>
                <div className={NB.sectionBody}>
                    <p className="text-sm text-zinc-600 font-medium">
                        Pilih seberapa sering penyusutan dihitung dan dicatat ke jurnal.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {frequencies.map((freq) => {
                            const Icon = freq.icon
                            return (
                                <div
                                    key={freq.code}
                                    className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white"
                                >
                                    <div className={`${freq.color} h-1.5`} />
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-5 w-5 text-zinc-700" />
                                                <div>
                                                    <div className="font-black text-sm text-zinc-900">
                                                        {freq.name}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                                        {freq.nameEn}
                                                    </div>
                                                </div>
                                            </div>
                                            {freq.recommended && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border-2 border-emerald-300 px-2 py-0.5">
                                                    Direkomendasikan
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-600 leading-relaxed">
                                            {freq.description}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* SECTION 3: Kontrol Penyusutan */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className={NB.sectionHead}>
                    <ShieldAlert className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Kontrol Penyusutan</span>
                </div>
                <div className={NB.sectionBody}>
                    <div className="border-2 border-amber-400 bg-amber-50 p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-2">
                            <div className="font-black text-sm text-amber-800 uppercase tracking-wide">
                                Penyusutan Otomatis: Nonaktif
                            </div>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Penyusutan <span className="font-black">tidak dijalankan secara otomatis</span> oleh
                                sistem. Anda harus menjalankan proses penyusutan secara manual melalui
                                fungsi &quot;Jalankan Penyusutan&quot; di halaman Penyusutan. Ini memberikan
                                kontrol penuh kepada akuntan untuk memastikan semua data sudah benar
                                sebelum jurnal penyusutan dibuat.
                            </p>
                            <div className="flex items-center gap-3 pt-1">
                                <Link href="/finance/fixed-assets/depreciation">
                                    <Button className="h-8 bg-amber-600 text-white hover:bg-amber-700 border-2 border-amber-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all">
                                        <Calculator className="mr-2 h-3.5 w-3.5" />
                                        Buka Halaman Penyusutan
                                        <ExternalLink className="ml-2 h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="bg-zinc-50 border-2 border-zinc-200 p-4 mt-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                            Langkah Menjalankan Penyusutan
                        </div>
                        <ol className="text-xs text-zinc-600 space-y-1 list-decimal list-inside font-medium">
                            <li>Pastikan semua aset baru sudah didaftarkan dengan data lengkap</li>
                            <li>Buka halaman Penyusutan dan pilih periode yang akan diproses</li>
                            <li>Klik &quot;Jalankan Penyusutan&quot; untuk menghitung dan membuat jurnal</li>
                            <li>Review jurnal yang dihasilkan sebelum posting</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* SECTION 4: Pengaturan Nilai Residu */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className={NB.sectionHead}>
                    <Percent className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Pengaturan Nilai Residu</span>
                </div>
                <div className={NB.sectionBody}>
                    <div className="flex items-start gap-3 bg-blue-50 border-2 border-blue-200 p-4">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        <div className="space-y-2">
                            <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                Nilai residu (salvage value) adalah estimasi nilai aset di akhir masa manfaatnya.
                                Nilai ini mengurangi dasar penyusutan sehingga aset tidak disusutkan melebihi nilai
                                yang diharapkan tersisa.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                            <div className="bg-indigo-500 h-1.5" />
                            <div className="p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <FolderTree className="h-5 w-5 text-zinc-700" />
                                    <div className="font-black text-sm text-zinc-900">Per Kategori</div>
                                </div>
                                <p className="text-xs text-zinc-600 leading-relaxed">
                                    Setiap kategori aset memiliki persentase nilai residu default.
                                    Saat aset baru didaftarkan, nilai residu otomatis dihitung dari
                                    persentase default kategori tersebut.
                                </p>
                                <Link href="/finance/fixed-assets/categories">
                                    <Button
                                        variant="outline"
                                        className="h-8 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white mt-1"
                                    >
                                        <FolderTree className="mr-2 h-3.5 w-3.5" />
                                        Kelola Kategori
                                        <ExternalLink className="ml-2 h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                            <div className="bg-purple-500 h-1.5" />
                            <div className="p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Building className="h-5 w-5 text-zinc-700" />
                                    <div className="font-black text-sm text-zinc-900">Per Aset</div>
                                </div>
                                <p className="text-xs text-zinc-600 leading-relaxed">
                                    Nilai residu dapat di-override per aset individual. Jika aset tertentu
                                    memiliki estimasi nilai sisa yang berbeda dari default kategori,
                                    ubah langsung di form detail aset.
                                </p>
                                <Link href="/finance/fixed-assets">
                                    <Button
                                        variant="outline"
                                        className="h-8 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white mt-1"
                                    >
                                        <Building className="mr-2 h-3.5 w-3.5" />
                                        Lihat Daftar Aset
                                        <ExternalLink className="ml-2 h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 5: Kunci Periode Akuntansi */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className={NB.sectionHead}>
                    <Lock className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Kunci Periode Akuntansi</span>
                </div>
                <div className={NB.sectionBody}>
                    <p className="text-sm text-zinc-600 font-medium">
                        Periode yang dikunci tidak dapat menerima jurnal penyusutan baru. Kelola kunci
                        periode di halaman Periode Fiskal.
                    </p>
                    <div className="border-2 border-black overflow-hidden rounded-none mt-2">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-zinc-100 border-b-2 border-black">
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5 text-left">
                                        Periode
                                    </th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5 text-left">
                                        Status
                                    </th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5 text-left">
                                        Keterangan
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {fiscalPeriods.map((fp, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-b border-zinc-100 last:border-b-0"
                                    >
                                        <td className="px-4 py-2.5 text-sm font-bold text-zinc-900">
                                            {fp.period}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {fp.status === "locked" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 border-2 border-red-300 px-2 py-0.5">
                                                    <Lock className="h-3 w-3" />
                                                    Dikunci
                                                </span>
                                            )}
                                            {fp.status === "open" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border-2 border-emerald-300 px-2 py-0.5">
                                                    Terbuka
                                                </span>
                                            )}
                                            {fp.status === "future" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-500 border-2 border-zinc-300 px-2 py-0.5">
                                                    Belum Dimulai
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-zinc-500 font-medium">
                                            {fp.status === "locked" &&
                                                "Jurnal penyusutan tidak bisa ditambahkan"}
                                            {fp.status === "open" &&
                                                "Dapat menerima jurnal penyusutan"}
                                            {fp.status === "future" &&
                                                "Periode belum aktif"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Data di atas adalah contoh referensi. Kelola periode di halaman Periode Fiskal.
                        </p>
                        <Link href="/finance/fiscal-periods">
                            <Button
                                variant="outline"
                                className="h-8 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                            >
                                <Lock className="mr-2 h-3.5 w-3.5" />
                                Kelola Periode Fiskal
                                <ExternalLink className="ml-2 h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
