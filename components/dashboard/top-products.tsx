"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertCircle, Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";

// Textile-specific data: Raw Material Tracking
const products = [
    { name: "Cotton Combed 30s", category: "Kain", stock: 1200, usage: 850, status: "Tinggi", unit: "kg" },
    { name: "Polyester Yarn", category: "Benang", stock: 450, usage: 620, status: "Rendah", unit: "kg" },
    { name: "Indigo Blue Dye", category: "Kimia", stock: 156, usage: 124, status: "Stabil", unit: "L" },
    { name: "Spandex Fiber", category: "Elastis", stock: 200, usage: 180, status: "Peringatan", unit: "kg" },
    { name: "Rayon Viscose", category: "Kain", stock: 800, usage: 450, status: "Stabil", unit: "kg" },
    { name: "YKK Zippers", category: "Aksesoris", stock: 5000, usage: 3200, status: "Tinggi", unit: "pcs" },
];

export function TopProducts() {
    return (
        <div className="relative bg-card border border-border/50 rounded-3xl min-h-[400px] flex flex-col overflow-hidden group hover:shadow-lg transition-all duration-300">
            {/* Subtle Spotlight */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/5 blur-[60px] opacity-20 pointer-events-none" />

            {/* Grain Overlay */}
            <div
                className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            <div className="relative z-10 flex items-center justify-between p-6 border-b border-border/50">
                <div>
                    <h3 className="font-medium text-lg text-foreground">Tracking Bahan Baku</h3>
                    <p className="text-xs text-muted-foreground mt-1">Monitoring persediaan material produksi</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                    <Layers className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
            </div>

            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {products.map((product, i) => (
                    <div key={i} className="group flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-lg font-serif font-medium text-muted-foreground border border-border/50 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all">
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1">
                                <h4 className="font-medium text-foreground truncate">{product.name}</h4>
                                <span className="text-sm font-medium text-muted-foreground">{product.usage} {product.unit} terpakai</span>
                            </div>

                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(product.usage / (product.stock + product.usage)) * 100}%` }} // Simplified progress logic
                                    transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                                    className={cn(
                                        "h-full rounded-full",
                                        product.stock < 500 ? "bg-rose-500" : "bg-indigo-500"
                                    )}
                                />
                            </div>

                            <div className="flex justify-between mt-2 text-xs">
                                <span className="text-muted-foreground">{product.category}</span>
                                {product.stock < 500 ? (
                                    <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
                                        <AlertCircle className="h-3 w-3" />
                                        Stok Rendah ({product.stock} {product.unit})
                                    </span>
                                ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400">Tersedia ({product.stock} {product.unit})</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-border/50 bg-secondary/30 rounded-b-3xl">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Nilai Material</span>
                    <span className="font-serif font-medium text-foreground">Rp 850.000.000</span>
                </div>
            </div>
        </div>
    );
}
