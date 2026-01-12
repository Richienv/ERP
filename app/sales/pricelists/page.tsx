"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    FileText,
    Tags,
    Calendar,
    ArrowUpDown,
    DollarSign,
    Book,
    BookOpen,
    Share2,
    Download,
    Eye,
    Edit3
} from "lucide-react";
import Link from "next/link";
import { mockPriceLists } from "@/components/sales/pricelists/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function PriceListsPage() {
    const [selectedBook, setSelectedBook] = useState<typeof mockPriceLists[0] | null>(null);
    const [search, setSearch] = useState("");

    const filteredLists = mockPriceLists.filter(list =>
        list.name.toLowerCase().includes(search.toLowerCase()) ||
        list.code.toLowerCase().includes(search.toLowerCase())
    );

    const formatPrice = (price: number, currency: string) => {
        if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
    }

    const handleShare = () => {
        toast.success("Tautan Daftar Harga disalin!", {
            description: "Siap dibagikan ke WhatsApp klien.",
            className: "border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white"
        });
    }

    return (
        <div className="flex-1 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen font-sans">
            <Toaster position="top-center" toastOptions={{ className: 'rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' }} />

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
                        <Book className="h-8 w-8" /> Daftar Harga
                    </h2>
                    <p className="text-muted-foreground font-bold mt-1">
                        Galeri strategi harga & katalog produk aktif.
                    </p>
                </div>
                <Button className="h-12 px-6 font-black uppercase tracking-wide border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-black text-white hover:bg-zinc-800 rounded-xl">
                    <Plus className="mr-2 h-5 w-5" />
                    Buat Baru
                </Button>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-4 mb-8 max-w-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Cari koleksi..."
                        className="pl-12 h-12 text-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:translate-y-[2px] transition-all rounded-xl font-bold bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredLists.map((book) => (
                    <motion.div
                        key={book.id}
                        layoutId={`book-${book.id}`}
                        whileHover={{ y: -4 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <Card
                            className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer overflow-hidden rounded-xl h-full flex flex-col group"
                            onClick={() => setSelectedBook(book)}
                        >
                            {/* Book Cover */}
                            <div className={cn("h-40 p-6 flex flex-col justify-between border-b-2 border-black relative overflow-hidden", book.coverColor)}>
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                                    <BookOpen className="h-24 w-24" />
                                </div>
                                <div className="flex justify-between items-start z-10">
                                    <Badge className="bg-white/20 hover:bg-white/30 text-current border-2 border-current shadow-sm backdrop-blur-sm font-black uppercase tracking-widest text-[10px]">
                                        {book.code}
                                    </Badge>
                                    <Badge className={cn("font-black uppercase tracking-widest text-[10px] border-2 border-black",
                                        book.status === 'ACTIVE' ? "bg-green-400 text-black" :
                                            book.status === 'INACTIVE' ? "bg-zinc-300 text-zinc-600" : "bg-yellow-300 text-black"
                                    )}>
                                        {book.status === 'ACTIVE' ? 'AKTIF' : book.status === 'INACTIVE' ? 'NONAKTIF' : 'DRAFT'}
                                    </Badge>
                                </div>
                                <h3 className={cn("text-2xl font-black leading-tight tracking-tight uppercase z-10", book.coverColor.includes("text-white") ? "text-white shadow-black drop-shadow-md" : "text-black")}>
                                    {book.name}
                                </h3>
                            </div>

                            {/* Book Details */}
                            <CardContent className="p-5 flex-1 flex flex-col gap-4">
                                <p className="text-sm font-bold text-muted-foreground line-clamp-3 leading-relaxed">
                                    {book.description}
                                </p>

                                <div className="mt-auto pt-4 border-t-2 border-zinc-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-black">
                                        <div className="bg-zinc-100 p-2 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            <Tags className="h-4 w-4" />
                                        </div>
                                        <span>{book.itemCount} Item</span>
                                    </div>
                                    <div className="text-xs font-bold text-zinc-400 font-mono">
                                        {book.lastUpdated.toLocaleDateString("id-ID", { month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Booklet Modal (The "Open Book" View) */}
            <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
                <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-zinc-50 overflow-hidden rounded-2xl h-[80vh] flex flex-col">
                    {selectedBook && (
                        <>
                            {/* Modal Header aka "Book Spine" */}
                            <div className={cn("p-6 border-b-2 border-black flex justify-between items-center", selectedBook.coverColor)}>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className={cn("text-3xl font-black uppercase tracking-tighter", selectedBook.coverColor.includes("text-white") ? "text-white" : "text-black")}>
                                            {selectedBook.name}
                                        </h2>
                                        <Badge className="bg-black/20 text-current border border-current backdrop-blur-md">{selectedBook.currency}</Badge>
                                    </div>
                                    <p className={cn("mt-1 font-bold opacity-80", selectedBook.coverColor.includes("text-white") ? "text-white" : "text-black")}>
                                        {selectedBook.code}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" className="border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] h-10 w-10 p-0 rounded-lg" title="Edit">
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button onClick={handleShare} className="border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] h-10 w-10 p-0 rounded-lg bg-white text-black hover:bg-zinc-100" title="Bagikan">
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Modal Content aka "Pages" */}
                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
                                {/* Left: Info Sidebar */}
                                <div className="w-full md:w-1/3 p-6 border-b-2 md:border-b-0 md:border-r-2 border-black bg-zinc-50">
                                    <h4 className="font-black uppercase tracking-widest text-xs text-zinc-500 mb-4">Deskripsi</h4>
                                    <p className="font-bold text-zinc-800 leading-relaxed mb-8">
                                        {selectedBook.description}
                                    </p>

                                    <h4 className="font-black uppercase tracking-widest text-xs text-zinc-500 mb-4">Informasi</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border-2 border-black shadow-sm">
                                            <span className="font-bold text-zinc-500 text-sm">Berlaku Hingga</span>
                                            <span className="font-black">Des 2024</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border-2 border-black shadow-sm">
                                            <span className="font-bold text-zinc-500 text-sm">Target</span>
                                            <span className="font-black">Ritel</span>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col gap-3">
                                        <Button className="w-full font-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2 justify-center py-6 text-lg">
                                            <Download className="h-5 w-5" /> Unduh PDF
                                        </Button>
                                    </div>
                                </div>

                                {/* Right: Item List */}
                                <div className="flex-1 flex flex-col bg-white">
                                    <div className="p-4 border-b-2 border-black bg-zinc-100 flex justify-between items-center">
                                        <div className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                                            <Tags className="h-4 w-4" />
                                            {selectedBook.items.length} Item Termasuk
                                        </div>
                                        <div className="relative w-48">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                            <Input className="h-8 pl-7 text-xs font-bold border-2 border-black" placeholder="Cari item..." />
                                        </div>
                                    </div>
                                    <ScrollArea className="flex-1 p-0">
                                        {selectedBook.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 border-b border-zinc-100 hover:bg-yellow-50 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 bg-zinc-200 rounded border border-black flex items-center justify-center font-black text-xs">
                                                        {(idx + 1).toString().padStart(2, '0')}
                                                    </div>
                                                    <span className="font-bold text-sm">{item.name}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-mono font-bold text-sm bg-zinc-100 px-2 py-1 rounded border border-zinc-200 group-hover:bg-white group-hover:border-black transition-all">
                                                        {formatPrice(item.price, selectedBook.currency)}
                                                    </span>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Edit3 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedBook.items.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground font-bold">
                                                Belum ada item di daftar ini.
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
