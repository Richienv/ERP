"use client";

import { useState, useEffect } from "react";
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    CreditCard,
    Banknote,
    Tag,
    PauseCircle,
    PlayCircle,
    Sparkles,
    Shirt,
    Scissors,
    Package,
    RotateCcw,
    User,
    ChevronRight,
    Calculator,
    ScanBarcode,
    History,
    TrendingUp,
    Target,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// --- Mock Data ---

const CATEGORIES = [
    { id: "all", name: "SEMUA", icon: Package },
    { id: "fabric", name: "KAIN", icon: ScrollArea },
    { id: "apparel", name: "PAKAIAN", icon: Shirt },
    { id: "acc", name: "AKSESORIS", icon: Scissors },
];

const PRODUCTS = [
    { id: 1, name: "Cotton Combed 30s - Navy", price: 125000, category: "fabric", image: "bg-blue-900", stock: 45, code: "FAB-001" },
    { id: 2, name: "Cotton Combed 30s - Black", price: 125000, category: "fabric", image: "bg-zinc-900", stock: 120, code: "FAB-002" },
    { id: 3, name: "Cotton Combed 30s - White", price: 120000, category: "fabric", image: "bg-zinc-100", stock: 80, code: "FAB-003" },
    { id: 4, name: "Polo Shirt Premium - M", price: 85000, category: "apparel", image: "bg-emerald-600", stock: 12, code: "APP-001" },
    { id: 5, name: "Polo Shirt Premium - L", price: 85000, category: "apparel", image: "bg-emerald-700", stock: 15, code: "APP-002" },
    { id: 6, name: "Benang Jahit 500m - Set", price: 45000, category: "acc", image: "bg-amber-500", stock: 200, code: "ACC-001" },
    { id: 7, name: "Kancing Kemeja (1 Gross)", price: 25000, category: "acc", image: "bg-slate-400", stock: 50, code: "ACC-002" },
    { id: 8, name: "Rayon Viscose Motif", price: 95000, category: "fabric", image: "bg-purple-500", stock: 30, code: "FAB-004" },
    { id: 9, name: "Rib Knit Collar", price: 15000, category: "acc", image: "bg-zinc-800", stock: 100, code: "ACC-003" },
];

const RECOMMENDATIONS: Record<number, number[]> = {
    2: [9, 6],
    1: [6],
};

export default function PosRevampPage() {
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [cart, setCart] = useState<{ id: number; qty: number }[]>([]);
    const [parkedCarts, setParkedCarts] = useState<{ id: string; name: string; items: typeof cart; time: Date }[]>([]);
    const [showPayModal, setShowPayModal] = useState(false);

    // Automation State
    const [dailyTarget, setDailyTarget] = useState(5000000);
    const [currentSales, setCurrentSales] = useState(3250000);
    const [discount, setDiscount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [lastTransaction, setLastTransaction] = useState<{ total: number, method: string } | null>(null);

    // --- Computed ---
    const filteredProducts = PRODUCTS.filter(p =>
        (activeCategory === "all" || p.category === activeCategory) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    );

    const cartTotal = cart.reduce((sum, item) => {
        const product = PRODUCTS.find(p => p.id === item.id);
        return sum + (product ? product.price * item.qty : 0);
    }, 0);

    const discountAmount = cartTotal * discount;
    const subtotalAfterDisc = cartTotal - discountAmount;
    const tax = subtotalAfterDisc * 0.11;
    const finalTotal = subtotalAfterDisc + tax;

    const progress = (currentSales / dailyTarget) * 100;

    // --- Actions ---
    const addToCart = (id: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === id);

            // AI Upsell Check (Mock)
            const product = PRODUCTS.find(p => p.id === id);
            const recs = RECOMMENDATIONS[id];

            if (recs && !existing) {
                const recProduct = PRODUCTS.find(p => p.id === recs[0]);
                if (recProduct) {
                    toast("🤖 Ritchie AI Suggestion", {
                        description: `Customer buying ${product?.name}? They usually need ${recProduct.name} too!`,
                        action: {
                            label: `Add (+${formatRupiah(recProduct.price)})`,
                            onClick: () => addToCart(recProduct.id)
                        },
                        duration: 5000,
                        className: "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 font-bold"
                    })
                }
            }

            if (existing) {
                return prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { id, qty: 1 }];
        });
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, qty: Math.max(1, item.qty + delta) };
            }
            return item;
        }));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const toggleDiscount = () => {
        if (discount === 0) {
            setDiscount(0.1);
            toast.success("Discount 10% Applied!", { className: "font-bold border-2 border-black" });
        } else {
            setDiscount(0);
            toast.info("Discount Removed", { className: "font-bold border-2 border-black" });
        }
    };

    const handlePayment = async (method: 'CASH' | 'CARD') => {
        setIsProcessing(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsProcessing(false);
        setShowPayModal(false);
        setPaymentSuccess(true);
        setLastTransaction({ total: finalTotal, method });

        // Update Shift Ledger
        setCurrentSales(prev => prev + finalTotal);

        // Clear Cart after short delay
        setTimeout(() => {
            setPaymentSuccess(false);
            setCart([]);
            setDiscount(0);
            setLastTransaction(null);
            toast.success(`Payment Successful! Receipt Printed.`, { className: "font-bold border-2 border-black bg-green-100 text-green-900" });
        }, 3000);
    };

    const parkCart = () => {
        if (cart.length === 0) return;
        const id = Math.random().toString(36).substr(2, 9);
        setParkedCarts(prev => [...prev, {
            id,
            name: `Queue #${prev.length + 1}`,
            items: cart,
            time: new Date()
        }]);
        setCart([]);
        toast.success("Order Parked!", { className: "font-bold border-2 border-black" });
    };

    const restoreCart = (id: string) => {
        const parked = parkedCarts.find(c => c.id === id);
        if (parked) {
            if (cart.length > 0) parkCart();
            setCart(parked.items);
            setParkedCarts(prev => prev.filter(c => c.id !== id));
            toast.success("Order Restored!", { className: "font-bold border-2 border-black" });
        }
    }

    const formatRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);

    return (
        <div className="flex h-[calc(100vh-2rem)] overflow-hidden bg-zinc-100 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 p-2 gap-4">
            <Toaster position="top-center" toastOptions={{ className: 'rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' }} />

            {/* Payment Success Overlay */}
            <AnimatePresence>
                {paymentSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white p-8 rounded-2xl border-4 border-black shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] flex flex-col items-center max-w-sm w-full text-center"
                        >
                            <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center mb-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <CheckCircle className="h-12 w-12 text-white" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Payment Success!</h2>
                            <p className="text-zinc-500 font-medium mb-6">Printing receipt for transaction...</p>
                            <div className="bg-zinc-100 p-4 rounded-xl border-2 border-black w-full mb-4">
                                <div className="flex justify-between text-sm font-bold text-zinc-500 uppercase">
                                    <span>Amount Paid</span>
                                    <span>{lastTransaction?.method}</span>
                                </div>
                                <div className="text-3xl font-black tracking-tighter mt-1">
                                    {formatRupiah(lastTransaction?.total || 0).replace(",00", "")}
                                </div>
                            </div>
                            <Button className="w-full font-bold border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all" onClick={() => setPaymentSuccess(false)}>
                                Close Now
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === LEFT: PRODUCT CATALOG === */}
            <div className="flex-1 flex flex-col gap-4">

                {/* 1. Header Bar with Shift Ledger */}
                <div className="flex items-stretch gap-4">
                    {/* Shift Ledger Widget */}
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 rounded-lg flex items-center gap-4 min-w-[280px]">
                        <div className="h-10 w-10 bg-black text-white flex items-center justify-center rounded-md font-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]">
                            <Target className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1">
                                <span>Shift Gap</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 rounded-full border border-black overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className="h-full bg-green-500"
                                />
                            </div>
                            <div className="text-xs font-black mt-1">{formatRupiah(currentSales)} / {formatRupiah(dailyTarget)}</div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-zinc-400">
                            <Search className="h-5 w-5" />
                            <span className="text-xs font-mono border border-zinc-300 rounded px-1">/</span>
                        </div>
                        <Input
                            placeholder="Search Product or Scan Barcode..."
                            className="h-full text-lg pl-16 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0 focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white dark:bg-zinc-900"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                <ScanBarcode className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 2. Categories as Tabs */}
                <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-none">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-lg font-black transition-all whitespace-nowrap border-2 uppercase tracking-wide text-sm",
                                activeCategory === cat.id
                                    ? "bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] translate-x-0 translate-y-0"
                                    : "bg-white text-zinc-500 border-black hover:bg-zinc-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* 3. Product Grid (Rigid Cards) */}
                <ScrollArea className="flex-1 -mr-2 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                        {filteredProducts.map(product => (
                            <motion.div
                                key={product.id}
                                layoutId={`product-${product.id}`}
                                className="group"
                            >
                                <Card
                                    className="h-full cursor-pointer flex flex-col border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden bg-white dark:bg-zinc-900 rounded-lg active:scale-[0.98]"
                                    onClick={() => addToCart(product.id)}
                                >
                                    <div className="aspect-[4/3] relative overflow-hidden border-b-2 border-black bg-zinc-100">
                                        <div className={cn("absolute inset-0 transition-transform duration-500 group-hover:scale-105", product.image)} />
                                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                            {product.code}
                                        </div>
                                        {product.stock < 20 && (
                                            <div className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-1 text-[10px] font-bold border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                LOW STOCK
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col flex-1 justify-between">
                                        <h3 className="font-bold text-sm leading-tight line-clamp-2 uppercase">
                                            {product.name}
                                        </h3>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-lg font-black tracking-tight">
                                                {formatRupiah(product.price).replace(",00", "")}
                                            </span>
                                            <Button size="icon" className="h-6 w-6 rounded-full bg-black text-white border-none hover:bg-zinc-800">
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* === RIGHT: TICKET / REGISTER === */}
            <div className="w-[450px] flex flex-col h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden z-10 shrink-0">

                {/* Visual Header */}
                <div className="bg-zinc-100 dark:bg-zinc-800 p-4 border-b-2 border-black flex justify-between items-center pattern-grid-lg">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                            <User className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Customer</span>
                            <span className="font-bold text-sm">Walk-In Guest</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {parkedCarts.length > 0 && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-10 w-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative bg-yellow-400 hover:bg-yellow-500 hover:text-black">
                                        <History className="h-5 w-5" />
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 bg-red-600 border border-black text-white text-[10px] items-center justify-center font-bold rounded-full">{parkedCarts.length}</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                    <DialogHeader>
                                        <DialogTitle className="uppercase font-black">Parked Orders</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2 mt-2">
                                        {parkedCarts.map(p => (
                                            <div key={p.id} className="flex justify-between items-center p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all bg-white" onClick={() => restoreCart(p.id)}>
                                                <div className="font-bold">{p.name} <span className="text-xs font-medium text-muted-foreground">({p.items.length} items)</span></div>
                                                <div className="text-xs font-mono">{p.time.toLocaleTimeString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                            onClick={parkCart}
                            disabled={cart.length === 0}
                            title="Park Order (F5)"
                        >
                            <PauseCircle className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Receipt Roll Area */}
                <div className="flex-1 bg-white relative flex flex-col">
                    {/* Paper Tear Graphic */}
                    <div className="h-3 w-full bg-zigzag opacity-50 absolute top-0 z-10 pointer-events-none"></div>

                    <ScrollArea className="flex-1 p-4">
                        <AnimatePresence initial={false}>
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4 select-none"
                                >
                                    <div className="h-24 w-24 border-4 border-dashed border-zinc-200 rounded-full flex items-center justify-center">
                                        <ShoppingCart className="h-10 w-10 text-zinc-300" />
                                    </div>
                                    <p className="text-lg font-black uppercase tracking-widest text-zinc-300">Register Ready</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, index) => {
                                        const product = PRODUCTS.find(p => p.id === item.id);
                                        if (!product) return null;
                                        return (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="flex items-start gap-3 group relative pl-6"
                                            >
                                                {/* Line Number */}
                                                <div className="absolute left-0 top-1 text-[10px] font-mono text-zinc-400 w-4 text-right">
                                                    {(index + 1).toString().padStart(2, '0')}
                                                </div>

                                                <div className="flex-1 border-b border-dashed border-zinc-200 pb-3">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-sm uppercase leading-tight pr-4">{product.name}</h4>
                                                        <span className="font-mono font-bold text-sm">{formatRupiah(product.price * item.qty).replace(",00", "")}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="text-xs text-muted-foreground font-medium">@{formatRupiah(product.price).replace("Rp", "").replace(",00", "")}</div>

                                                        <div className="flex items-center gap-2 bg-zinc-100 rounded border border-zinc-200 p-0.5">
                                                            <button className="h-5 w-5 flex items-center justify-center hover:bg-white rounded text-xs font-bold" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></button>
                                                            <span className="w-6 text-center text-xs font-bold font-mono">{item.qty}</span>
                                                            <button className="h-5 w-5 flex items-center justify-center hover:bg-white rounded text-xs font-bold" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    className="opacity-0 group-hover:opacity-100 absolute -right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 transition-opacity bg-white p-1 shadow-sm border rounded-full"
                                                    onClick={() => removeFromCart(item.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </AnimatePresence>
                    </ScrollArea>
                </div>

                {/* Footer / Total */}
                <div className="bg-zinc-50 dark:bg-zinc-900 border-t-2 border-black p-4 space-y-4">
                    <div className="space-y-1 text-sm font-mono text-zinc-500">
                        <div className="flex justify-between">
                            <span>SUBTOTAL</span>
                            <span>{formatRupiah(cartTotal).replace(",00", "").replace("Rp", "")}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span className="flex items-center gap-1 font-bold"><Tag className="h-3 w-3" /> DISC ({discount * 100}%)</span>
                                <span>-{formatRupiah(discountAmount).replace(",00", "").replace("Rp", "")}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>TAX (11%)</span>
                            <span>{formatRupiah(tax).replace(",00", "").replace("Rp", "")}</span>
                        </div>
                    </div>

                    <Separator className="bg-black" />

                    <div className="flex justify-between items-end text-black dark:text-white">
                        <span className="font-black text-xl uppercase tracking-wider">Total</span>
                        <span className="font-black text-4xl tracking-tighter">{formatRupiah(finalTotal).replace(",00", "")}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 h-14">
                        <Button
                            variant="outline"
                            className={cn(
                                "h-full border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] rounded-lg font-bold flex flex-col gap-0 items-center justify-center bg-white",
                                discount > 0 ? "bg-black text-white" : ""
                            )}
                            onClick={toggleDiscount}
                        >
                            <Tag className="h-4 w-4" />
                            <span className="text-[10px] uppercase">Disc</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-full border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] rounded-lg font-bold flex flex-col gap-0 items-center justify-center bg-white"
                            onClick={() => setShowPayModal(true)}
                        >
                            <CreditCard className="h-4 w-4" />
                            <span className="text-[10px] uppercase">Card</span>
                        </Button>

                        <Button
                            className="col-span-2 h-full bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] rounded-lg text-lg font-black uppercase tracking-wider flex items-center gap-2"
                            disabled={cart.length === 0}
                            onClick={() => setShowPayModal(true)}
                        >
                            PAY <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Automation: Payment Modal */}
                <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
                    <DialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden sm:max-w-lg">
                        <div className="bg-black text-white p-6 text-center">
                            <h2 className="text-zinc-400 uppercase tracking-widest text-xs font-bold mb-2">Amount Due</h2>
                            <div className="text-5xl font-black tracking-tighter">{formatRupiah(finalTotal).replace(",00", "")}</div>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-4">
                            <Button
                                className="h-24 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white text-black hover:bg-zinc-50 flex flex-col gap-2 rounded-xl"
                                onClick={() => handlePayment('CASH')}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Sparkles className="h-8 w-8 animate-spin" /> : <Banknote className="h-8 w-8" />}
                                <span className="font-black uppercase tracking-wide">{isProcessing ? "Processing..." : "Cash"}</span>
                            </Button>
                            <Button
                                className="h-24 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white text-black hover:bg-zinc-50 flex flex-col gap-2 rounded-xl"
                                onClick={() => handlePayment('CARD')}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Sparkles className="h-8 w-8 animate-spin" /> : <CreditCard className="h-8 w-8" />}
                                <span className="font-black uppercase tracking-wide">{isProcessing ? "Connecting..." : "Card / QRIS"}</span>
                            </Button>
                        </div>

                        <div className="bg-zinc-100 p-4 border-t-2 border-black flex justify-between items-center">
                            <Button variant="ghost" className="font-bold text-zinc-500" onClick={() => setShowPayModal(false)}>Cancel</Button>
                            <Button variant="link" className="font-bold">Split Bill</Button>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </div>
    );
}

// Utility for formatting
const formatRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
