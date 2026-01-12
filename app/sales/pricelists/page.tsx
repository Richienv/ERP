"use client"

import { useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { AppSidebar } from "@/components/app-sidebar"
import { Navigation } from "@/components/dashboard/navigation"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PriceBookGallery } from "@/components/sales/pricelists/price-book-gallery"
import { BookletViewer } from "@/components/sales/pricelists/booklet-viewer"
import { PriceBook } from "@/components/sales/pricelists/data"

export default function PriceListsPage() {
    const [selectedBook, setSelectedBook] = useState<PriceBook | null>(null)
    const [isViewerOpen, setIsViewerOpen] = useState(false)

    const handleOpenBook = (book: PriceBook) => {
        setSelectedBook(book)
        setIsViewerOpen(true)
    }

    return (
        <div className="min-h-screen bg-[#F0F2F5] font-sans text-zinc-900">
            {/* 1. TOP NAVIGATION */}
            <SiteHeader />

            <div className="flex">
                {/* 2. SIDEBAR */}
                <AppSidebar />

                {/* 3. MAIN CONTENT AREA */}
                <main className="flex-1 p-6 lg:p-8 ml-64 transition-all duration-300">
                    <div className="max-w-7xl mx-auto space-y-8">

                        {/* HEADER SECTION */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-2 font-serif">
                                    Katalog & Harga
                                </h1>
                                <p className="text-zinc-500 font-medium max-w-2xl">
                                    Manage and share your digital price books. Click any catalog to view details or share with customers.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative hidden md:block w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        placeholder="Search catalogs..."
                                        className="pl-9 bg-white border-2 border-zinc-200 focus:border-black rounded-lg transition-all h-10 shadow-sm"
                                    />
                                </div>
                                <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-transparent shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:text-white hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] transition-all font-bold">
                                    <Plus className="mr-2 h-4 w-4" /> New Catalog
                                </Button>
                            </div>
                        </div>

                        {/* GALLERY GRID */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Filter className="h-5 w-5" /> Recent Collections
                                </h2>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-black">View All</Button>
                                </div>
                            </div>

                            <PriceBookGallery onOpenBook={handleOpenBook} />
                        </div>

                    </div>
                </main>
            </div>

            {/* DETAIL VIEWER MODAL */}
            <BookletViewer
                book={selectedBook}
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
            />
        </div>
    )
}
