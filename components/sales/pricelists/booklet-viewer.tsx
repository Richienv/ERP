"use client"

import { PriceBook } from "./data"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Share2, Download, Printer, PlusCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface BookletViewerProps {
    book: PriceBook | null
    isOpen: boolean
    onClose: () => void
}

export function BookletViewer({ book, isOpen, onClose }: BookletViewerProps) {
    if (!book) return null

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-xl md:max-w-2xl w-full border-l-2 border-black p-0 overflow-hidden flex flex-col bg-[#faf9f6]">
                {/* Paper Texture Background Color roughly matching subtle paper */}

                {/* Header - Styled like a document header */}
                <div className="p-6 border-b-2 border-dashed border-zinc-200 bg-white">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <Badge variant="outline" className="mb-2 border-black text-black rounded-none capitalize">
                                {book.subtitle}
                            </Badge>
                            <h2 className="text-4xl font-black tracking-tighter text-black font-serif">
                                {book.title}
                            </h2>
                            <p className="text-zinc-500 font-mono text-xs mt-1">
                                Catalog ID: {book.id} • Expires: {book.validUntil}
                            </p>
                        </div>
                        <div className={`p-3 rounded-full ${book.coverParams.color} bg-opacity-10`}>
                            {/* Small dot of color to indicate context */}
                            <div className={`w-3 h-3 rounded-full ${book.coverParams.color}`}></div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-8 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all active:translate-y-[2px]">
                            <Share2 className="w-3 h-3 mr-2" /> Share Link
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-8 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all active:translate-y-[2px]">
                            <Download className="w-3 h-3 mr-2" /> PDF
                        </Button>
                    </div>
                </div>

                {/* Content - Scrollable Table */}
                <ScrollArea className="flex-1 p-6">
                    <div className="bg-white border-2 border-black p-1 shadow-sm">
                        <Table>
                            <TableHeader className="bg-black">
                                <TableRow className="hover:bg-black/90">
                                    <TableHead className="text-white font-bold w-[100px]">Code</TableHead>
                                    <TableHead className="text-white font-bold">Item Description</TableHead>
                                    <TableHead className="text-white font-bold text-right">Price</TableHead>
                                    <TableHead className="text-white font-bold w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {book.items.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-zinc-50 border-b border-zinc-100">
                                        <TableCell className="font-mono text-xs font-bold text-zinc-500">
                                            {item.code}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-sm text-zinc-900">{item.name}</div>
                                            <div className="text-xs text-zinc-400">{item.spec}</div>
                                            <div className="text-[10px] text-zinc-500 mt-0.5">Min Order: {item.minQty} {item.unit}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-mono font-bold">
                                                Rp {item.price.toLocaleString('id-ID')}
                                            </div>
                                            <div className="text-[10px] text-zinc-400">per {item.unit}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-black hover:bg-black hover:text-white rounded-full">
                                                <PlusCircle className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Legal Footer */}
                    <div className="mt-8 text-center text-zinc-400 text-[10px] font-mono p-4 border-t border-dashed border-zinc-200">
                        <p>PRICES SUBJECT TO CHANGE WITHOUT NOTICE.</p>
                        <p>STANDARD TERMS & CONDITIONS APPLY. DO NOT DISTRIBUTE EXTERNALLY.</p>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
