"use client"

import { useState } from "react"
import { PRICE_BOOKS, PriceBook } from "./data"
import { motion } from "framer-motion"
import { Globe, ShoppingBag, Shield, Tag, BookOpen, Share2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PriceBookGalleryProps {
    onOpenBook: (book: PriceBook) => void
}

export function PriceBookGallery({ onOpenBook }: PriceBookGalleryProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-4">
            {PRICE_BOOKS.map((book) => (
                <PriceBookCover key={book.id} book={book} onClick={() => onOpenBook(book)} />
            ))}
        </div>
    )
}

function PriceBookCover({ book, onClick }: { book: PriceBook; onClick: () => void }) {
    const getIcon = (iconName: string) => {
        switch (iconName) {
            case "globe": return <Globe className="h-12 w-12 text-white/90" />
            case "store": return <ShoppingBag className="h-12 w-12 text-white/90" />
            case "shield": return <Shield className="h-12 w-12 text-white/90" />
            case "tag": return <Tag className="h-12 w-12 text-white/90" />
            default: return <BookOpen className="h-12 w-12 text-white/90" />
        }
    }

    // Pattern styles
    const getPattern = (pattern: string) => {
        // Simple CSS patterns using gradients
        switch (pattern) {
            case "dots": return "radial-gradient(circle, rgba(255,255,255,0.2) 2px, transparent 2px)"
            case "grid": return "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)"
            case "waves": return "repeating-linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px)"
            default: return ""
        }
    }

    return (
        <div className="group perspective-1000 cursor-pointer" onClick={onClick}>
            <motion.div
                whileHover={{ rotateY: -10, rotateX: 5, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative aspect-[3/4] rounded-r-2xl rounded-l-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-2 border-black overflow-hidden flex flex-col justify-between p-6 ${book.coverParams.color}`}
            >
                {/* Book Spine Highlight (Left) */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-white/20 border-r border-black/10 z-20"></div>

                {/* Pattern Overlay */}
                <div
                    className="absolute inset-0 opacity-30 z-0 pointer-events-none"
                    style={{
                        backgroundImage: getPattern(book.coverParams.pattern),
                        backgroundSize: book.coverParams.pattern === "dots" ? "16px 16px" : "20px 20px"
                    }}
                />

                {/* Top Content */}
                <div className="relative z-10">
                    <div className="w-20 h-20 rounded-full border-2 border-white/40 flex items-center justify-center bg-white/10 backdrop-blur-sm mb-6">
                        {getIcon(book.coverParams.icon)}
                    </div>
                    <h3 className="text-3xl font-black text-white leading-tight mb-2 tracking-tight drop-shadow-sm font-serif">
                        {book.title}
                    </h3>
                    <p className="text-white/80 font-medium text-sm border-l-2 border-white/50 pl-2">
                        {book.subtitle}
                    </p>
                </div>

                {/* Bottom Content */}
                <div className="relative z-10 flex flex-col items-start gap-2">
                    <Badge variant="outline" className="bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md">
                        {book.items.length} Items
                    </Badge>
                    <p className="text-[10px] text-white/60 font-mono">
                        Valid: {book.validUntil}
                    </p>
                </div>

                {/* Decorative "Page" Edges (Right side effect) */}
                <div className="absolute top-2 bottom-2 right-0 w-1 bg-gradient-to-l from-black/20 to-transparent"></div>

            </motion.div>

            {/* Shadow/Reflection Hint */}
            <div className="mt-4 mx-auto w-[80%] h-4 bg-black/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
    )
}
