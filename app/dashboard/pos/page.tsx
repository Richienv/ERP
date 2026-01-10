"use client";

import { useState } from "react";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mock Product Data (Textile Retail Context)
const PRODUCTS = [
    { id: 1, name: "Cotton Combed 30s - Navy", price: 125000, category: "Kain", image: "bg-blue-900" },
    { id: 2, name: "Cotton Combed 30s - Black", price: 125000, category: "Kain", image: "bg-zinc-900" },
    { id: 3, name: "Cotton Combed 30s - White", price: 120000, category: "Kain", image: "bg-zinc-100" },
    { id: 4, name: "Polo Shirt Premium - M", price: 85000, category: "Pakaian", image: "bg-emerald-600" },
    { id: 5, name: "Polo Shirt Premium - L", price: 85000, category: "Pakaian", image: "bg-emerald-700" },
    { id: 6, name: "Benang Jahit 500m - Set", price: 45000, category: "Aksesoris", image: "bg-amber-500" },
    { id: 7, name: "Kancing Kemeja (1 Gross)", price: 25000, category: "Aksesoris", image: "bg-slate-400" },
    { id: 8, name: "Rayon Viscose Motif", price: 95000, category: "Kain", image: "bg-purple-500" },
];

const CATEGORIES = ["Semua", "Kain", "Pakaian", "Aksesoris"];

export default function PosPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("Semua");
    const [cart, setCart] = useState<{ id: number; qty: number }[]>([]);

    const filteredProducts = PRODUCTS.filter(p =>
        (category === "Semua" || p.category === category) &&
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const addToCart = (id: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === id);
            if (existing) {
                return prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { id, qty: 1 }];
        });
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, qty: Math.max(1, item.qty + delta) };
            }
            return item;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => {
        const product = PRODUCTS.find(p => p.id === item.id);
        return sum + (product ? product.price * item.qty : 0);
    }, 0);

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden gap-4 p-4">
            {/* LEFT: Product Section */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Header & Search */}
                <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari produk..."
                            className="pl-9 bg-secondary/50 border-0"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {CATEGORIES.map(cat => (
                            <Button
                                key={cat}
                                variant={category === cat ? "default" : "outline"}
                                onClick={() => setCategory(cat)}
                                size="sm"
                                className="rounded-full"
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <ScrollArea className="flex-1">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                        {filteredProducts.map(product => (
                            <Card
                                key={product.id}
                                className="cursor-pointer group hover:border-primary transition-all overflow-hidden border-border/50 bg-card"
                                onClick={() => addToCart(product.id)}
                            >
                                <div className={`h-32 w-full ${product.image} opacity-80 group-hover:scale-105 transition-transform duration-500`} />
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                                        <span className="font-semibold text-primary">{formatRupiah(product.price)}</span>
                                    </div>
                                    <h3 className="font-medium text-sm line-clamp-2 text-foreground">{product.name}</h3>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* RIGHT: Cart Section */}
            <div className="w-[400px] flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/30">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Keranjang</h2>
                    </div>
                    <Badge variant="outline">{cart.length} Item</Badge>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                            <ShoppingCart className="h-16 w-16" />
                            <p>Keranjang kosong</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cart.map(item => {
                                const product = PRODUCTS.find(p => p.id === item.id);
                                if (!product) return null;
                                return (
                                    <div key={item.id} className="flex gap-3 items-center bg-secondary/20 p-2 rounded-lg border border-border/50">
                                        <div className={`h-12 w-12 rounded-md ${product.image}`} />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm truncate">{product.name}</h4>
                                            <p className="text-xs text-muted-foreground">{formatRupiah(product.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }}>
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-sm font-medium w-4 text-center">{item.qty}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}>
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-6 bg-secondary/30 border-t border-border/50 space-y-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatRupiah(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Pajak (11%)</span>
                            <span>{formatRupiah(cartTotal * 0.11)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-primary">{formatRupiah(cartTotal * 1.11)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="w-full gap-2">
                            <Tag className="h-4 w-4" /> Diskon
                        </Button>
                        <Button variant="outline" className="w-full gap-2">
                            <CreditCard className="h-4 w-4" /> Kartu
                        </Button>
                    </div>

                    <Button className="w-full h-12 text-lg gap-2 shadow-lg shadow-primary/20" disabled={cart.length === 0}>
                        <Banknote className="h-5 w-5" /> Bayar {formatRupiah(cartTotal * 1.11)}
                    </Button>
                </div>
            </div>
        </div>
    );
}
