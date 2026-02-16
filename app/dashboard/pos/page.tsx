"use client";

import { useState } from "react";
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
    Sparkles,
    Shirt,
    Scissors,
    Package,
    User,
    ChevronRight,
    ScanBarcode,
    History,
    Target,
    CheckCircle,
    Ruler,
    Store,
    Users,
    X,
    Split,
    ShoppingBag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// --- Mock Data ---

const CATEGORIES = [
    { id: "all", name: "SEMUA", icon: Package },
    { id: "fabric", name: "KAIN", icon: Ruler },
    { id: "apparel", name: "PAKAIAN", icon: Shirt },
    { id: "acc", name: "AKSESORIS", icon: Scissors },
];

const PRODUCTS = [
    { id: 1, name: "Cotton Combed 30s - Navy", price: 125000, wholesalePrice: 110000, category: "fabric", image: "bg-blue-900", stock: 45, code: "FAB-001", unit: "meter" },
    { id: 2, name: "Cotton Combed 30s - Black", price: 125000, wholesalePrice: 110000, category: "fabric", image: "bg-zinc-900", stock: 120, code: "FAB-002", unit: "meter" },
    { id: 3, name: "Cotton Combed 30s - White", price: 120000, wholesalePrice: 105000, category: "fabric", image: "bg-zinc-100", stock: 80, code: "FAB-003", unit: "meter" },
    { id: 4, name: "Polo Shirt Premium - M", price: 85000, wholesalePrice: 72000, category: "apparel", image: "bg-emerald-600", stock: 12, code: "APP-001", unit: "pcs" },
    { id: 5, name: "Polo Shirt Premium - L", price: 85000, wholesalePrice: 72000, category: "apparel", image: "bg-emerald-700", stock: 15, code: "APP-002", unit: "pcs" },
    { id: 6, name: "Benang Jahit 500m - Set", price: 45000, wholesalePrice: 38000, category: "acc", image: "bg-amber-500", stock: 200, code: "ACC-001", unit: "set" },
    { id: 7, name: "Kancing Kemeja (1 Gross)", price: 25000, wholesalePrice: 20000, category: "acc", image: "bg-slate-400", stock: 50, code: "ACC-002", unit: "gross" },
    { id: 8, name: "Rayon Viscose Motif", price: 95000, wholesalePrice: 82000, category: "fabric", image: "bg-purple-500", stock: 30, code: "FAB-004", unit: "meter" },
    { id: 9, name: "Rib Knit Collar", price: 15000, wholesalePrice: 12000, category: "acc", image: "bg-zinc-800", stock: 100, code: "ACC-003", unit: "pcs" },
];

const RECOMMENDATIONS: Record<number, number[]> = {
    2: [9, 6],
    1: [6],
};

const CUSTOMERS = [
    { id: "walk-in", name: "Walk-In Guest", type: "INDIVIDUAL" as const, creditLimit: 0 },
    { id: "c1", name: "PT Maju Tekstil", type: "COMPANY" as const, creditLimit: 50000000 },
    { id: "c2", name: "CV Garmen Sejahtera", type: "COMPANY" as const, creditLimit: 30000000 },
    { id: "c3", name: "Toko Kain Murah", type: "COMPANY" as const, creditLimit: 10000000 },
    { id: "c4", name: "Bu Siti (Penjahit)", type: "INDIVIDUAL" as const, creditLimit: 5000000 },
    { id: "c5", name: "Pak Ahmad (Konveksi)", type: "INDIVIDUAL" as const, creditLimit: 15000000 },
];

type CartItem = { id: number; qty: number; meters?: number };
type Customer = typeof CUSTOMERS[number];

export default function PosRevampPage() {
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [parkedCarts, setParkedCarts] = useState<{ id: string; name: string; items: CartItem[]; time: Date }[]>([]);
    const [showPayModal, setShowPayModal] = useState(false);

    const [dailyTarget] = useState(5000000);
    const [currentSales, setCurrentSales] = useState(3250000);
    const [discount, setDiscount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [lastTransaction, setLastTransaction] = useState<{ total: number; method: string } | null>(null);

    const [fabricCutMode, setFabricCutMode] = useState(false);
    const [wholesaleMode, setWholesaleMode] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer>(CUSTOMERS[0]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [showCustomerDialog, setShowCustomerDialog] = useState(false);
    const [splitPayment, setSplitPayment] = useState(false);
    const [splitCashAmount, setSplitCashAmount] = useState("");
    const [meterInput, setMeterInput] = useState("");
    const [meterProductId, setMeterProductId] = useState<number | null>(null);

    // --- Computed ---
    const filteredProducts = PRODUCTS.filter(p =>
        (activeCategory === "all" || p.category === activeCategory) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    );

    const getPrice = (product: typeof PRODUCTS[number]) =>
        wholesaleMode ? product.wholesalePrice : product.price;

    const cartTotal = cart.reduce((sum, item) => {
        const product = PRODUCTS.find(p => p.id === item.id);
        if (!product) return sum;
        const price = getPrice(product);
        const qty = item.meters ?? item.qty;
        return sum + price * qty;
    }, 0);

    const discountAmount = cartTotal * discount;
    const subtotalAfterDisc = cartTotal - discountAmount;
    const tax = subtotalAfterDisc * 0.11;
    const finalTotal = subtotalAfterDisc + tax;

    const progress = (currentSales / dailyTarget) * 100;

    const filteredCustomers = CUSTOMERS.filter(c =>
        c.id !== "walk-in" &&
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    // --- Actions ---
    const addToCart = (id: number) => {
        const product = PRODUCTS.find(p => p.id === id);
        if (!product) return;

        if (fabricCutMode && product.category === "fabric") {
            setMeterProductId(id);
            setMeterInput("");
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === id);

            const recs = RECOMMENDATIONS[id];
            if (recs && !existing) {
                const recProduct = PRODUCTS.find(p => p.id === recs[0]);
                if (recProduct) {
                    toast("Ritchie AI Suggestion", {
                        description: `Customer buying ${product.name}? They usually need ${recProduct.name} too!`,
                        action: {
                            label: `Add (+${formatRupiah(getPrice(recProduct))})`,
                            onClick: () => addToCart(recProduct.id)
                        },
                        duration: 5000,
                    })
                }
            }

            if (existing) {
                return prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { id, qty: 1 }];
        });
    };

    const addFabricByMeter = () => {
        if (!meterProductId || !meterInput) return;
        const meters = parseFloat(meterInput);
        if (isNaN(meters) || meters <= 0) return;

        setCart(prev => {
            const existing = prev.find(item => item.id === meterProductId && item.meters !== undefined);
            if (existing) {
                return prev.map(item =>
                    item.id === meterProductId && item.meters !== undefined
                        ? { ...item, meters: (item.meters ?? 0) + meters }
                        : item
                );
            }
            return [...prev, { id: meterProductId, qty: 1, meters }];
        });

        const product = PRODUCTS.find(p => p.id === meterProductId);
        toast.success(`${meters}m ${product?.name} ditambahkan`);

        setMeterProductId(null);
        setMeterInput("");
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                if (item.meters !== undefined) {
                    return { ...item, meters: Math.max(0.1, (item.meters ?? 1) + delta * 0.5) };
                }
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
            toast.success("Discount 10% Applied!");
        } else {
            setDiscount(0);
            toast.info("Discount Removed");
        }
    };

    const handlePayment = async (method: "CASH" | "CARD" | "SPLIT") => {
        setIsProcessing(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsProcessing(false);
        setShowPayModal(false);
        setPaymentSuccess(true);

        const label = method === "SPLIT"
            ? `SPLIT (Cash ${formatRupiah(Number(splitCashAmount))} + Card)`
            : method;
        setLastTransaction({ total: finalTotal, method: label });

        setCurrentSales(prev => prev + finalTotal);

        setTimeout(() => {
            setPaymentSuccess(false);
            setCart([]);
            setDiscount(0);
            setLastTransaction(null);
            setSplitPayment(false);
            setSplitCashAmount("");
            toast.success("Pembayaran Berhasil! Struk Dicetak.");
        }, 3000);
    };

    const parkCart = () => {
        if (cart.length === 0) return;
        const id = Math.random().toString(36).substr(2, 9);
        setParkedCarts(prev => [...prev, {
            id,
            name: `Antrian #${prev.length + 1}`,
            items: cart,
            time: new Date()
        }]);
        setCart([]);
        toast.success("Order Diparkir!");
    };

    const restoreCart = (id: string) => {
        const parked = parkedCarts.find(c => c.id === id);
        if (parked) {
            if (cart.length > 0) parkCart();
            setCart(parked.items);
            setParkedCarts(prev => prev.filter(c => c.id !== id));
            toast.success("Order Dikembalikan!");
        }
    }

    const selectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowCustomerDialog(false);
        setCustomerSearch("");
        if (customer.type === "COMPANY") {
            setWholesaleMode(true);
            toast.success(`${customer.name} — Mode Grosir Aktif`);
        }
    };

    const formatRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);

    return (
        <div className="flex h-[calc(100vh-2rem)] overflow-hidden bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 p-3 gap-4">
            <Toaster position="top-center" />

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
                            className="bg-white dark:bg-zinc-900 p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center max-w-sm w-full text-center"
                        >
                            <div className="h-20 w-20 bg-emerald-500 flex items-center justify-center mb-6 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Payment Success!</h2>
                            <p className="text-zinc-400 text-xs font-medium mb-6">Printing receipt for transaction...</p>
                            <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border-2 border-black w-full mb-4">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    <span>Amount Paid</span>
                                    <span>{lastTransaction?.method}</span>
                                </div>
                                <div className="text-3xl font-black tracking-tighter mt-1">
                                    {formatRupiah(lastTransaction?.total || 0)}
                                </div>
                            </div>
                            <Button
                                className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider h-10"
                                onClick={() => setPaymentSuccess(false)}
                            >
                                Close Now
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === LEFT: PRODUCT CATALOG === */}
            <div className="flex-1 flex flex-col gap-3">

                {/* Header Bar with Shift Target */}
                <div className="flex items-stretch gap-3">
                    {/* Shift Target Widget */}
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-3 flex items-center gap-4 min-w-[260px]">
                        <div className="h-9 w-9 bg-black text-white flex items-center justify-center font-black">
                            <Target className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                                <span>Shift Gap</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 border border-black overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className="h-full bg-emerald-500"
                                />
                            </div>
                            <div className="text-[10px] font-black mt-1 text-zinc-600 dark:text-zinc-400">
                                {formatRupiah(currentSales)} / {formatRupiah(dailyTarget)}
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-zinc-400">
                            <Search className="h-5 w-5" />
                        </div>
                        <Input
                            placeholder="Cari produk atau scan barcode..."
                            className="h-full text-base pl-12 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0 focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white dark:bg-zinc-900 rounded-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none">
                                <ScanBarcode className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Categories + Mode Toggles */}
                <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-none items-center">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 font-black transition-all whitespace-nowrap border-2 uppercase tracking-widest text-[10px] rounded-none",
                                activeCategory === cat.id
                                    ? "bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]"
                                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-black hover:bg-zinc-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}

                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => {
                                setFabricCutMode(!fabricCutMode);
                                toast(fabricCutMode ? "Mode Potong OFF" : "Mode Potong ON — Klik kain untuk input meter");
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 font-black transition-all whitespace-nowrap border-2 uppercase tracking-widest text-[10px] rounded-none",
                                fabricCutMode
                                    ? "bg-amber-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-black"
                            )}
                        >
                            <Ruler className="h-3.5 w-3.5" /> Potong
                        </button>

                        <button
                            onClick={() => {
                                setWholesaleMode(!wholesaleMode);
                                toast(wholesaleMode ? "Harga Retail" : "Harga Grosir Aktif");
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 font-black transition-all whitespace-nowrap border-2 uppercase tracking-widest text-[10px] rounded-none",
                                wholesaleMode
                                    ? "bg-blue-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-black"
                            )}
                        >
                            <Store className="h-3.5 w-3.5" /> Grosir
                        </button>
                    </div>
                </div>

                {/* Product Grid */}
                <ScrollArea className="flex-1 -mr-2 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-20">
                        {filteredProducts.map(product => (
                            <motion.div
                                key={product.id}
                                layoutId={`product-${product.id}`}
                                className="group"
                            >
                                <Card
                                    className={cn(
                                        "h-full cursor-pointer flex flex-col border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden bg-white dark:bg-zinc-900 active:scale-[0.98] rounded-none",
                                        fabricCutMode && product.category === "fabric" && "ring-2 ring-amber-500"
                                    )}
                                    onClick={() => addToCart(product.id)}
                                >
                                    <div className="aspect-[4/3] relative overflow-hidden border-b-2 border-black bg-zinc-100 dark:bg-zinc-800">
                                        <div className={cn("absolute inset-0 transition-transform duration-500 group-hover:scale-105", product.image)} />
                                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-white/20">
                                            {product.code}
                                        </div>
                                        {fabricCutMode && product.category === "fabric" && (
                                            <div className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                                                <Ruler className="h-3 w-3 inline mr-1" />POTONG
                                            </div>
                                        )}
                                        {product.stock < 20 && (
                                            <div className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                STOK RENDAH
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col flex-1 gap-2">
                                        <h3 className="font-black text-xs leading-tight line-clamp-2 uppercase text-zinc-900 dark:text-white min-h-[2.5em]">
                                            {product.name}
                                        </h3>
                                        <div className="mt-auto flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
                                                    {formatRupiah(getPrice(product)).replace(",00", "")}
                                                </span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {wholesaleMode && product.wholesalePrice < product.price && (
                                                        <span className="text-[9px] text-zinc-400 line-through font-bold decoration-red-500 decoration-2 mr-1">
                                                            {formatRupiah(product.price).replace(",00", "")}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                                                        /{product.unit}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "h-8 w-8 flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all rounded-none",
                                                "bg-black text-white hover:bg-zinc-800"
                                            )}>
                                                <Plus className="h-4 w-4 stroke-[3px]" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Fabric Cut Meter Input Dialog */}
                <Dialog open={meterProductId !== null} onOpenChange={() => { setMeterProductId(null); setMeterInput(""); }}>
                    <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-0 overflow-hidden sm:max-w-sm">
                        <div className="bg-amber-500 text-white p-4 text-center border-b-2 border-black">
                            <Ruler className="h-7 w-7 mx-auto mb-2" />
                            <h2 className="text-[10px] font-black uppercase tracking-widest mb-1">Mode Potong Kain</h2>
                            <div className="text-base font-black">{PRODUCTS.find(p => p.id === meterProductId)?.name}</div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Panjang (meter)</label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    placeholder="Contoh: 2.5"
                                    value={meterInput}
                                    onChange={e => setMeterInput(e.target.value)}
                                    className="border-2 border-black font-mono font-bold text-2xl text-center h-14"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === "Enter") addFabricByMeter(); }}
                                />
                            </div>
                            {meterInput && Number(meterInput) > 0 && (
                                <div className="text-center text-xs font-bold text-zinc-500">
                                    Total: {formatRupiah(Number(meterInput) * getPrice(PRODUCTS.find(p => p.id === meterProductId)!))}
                                </div>
                            )}
                            <Button
                                className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-widest text-xs h-11 transition-all"
                                onClick={addFabricByMeter}
                                disabled={!meterInput || Number(meterInput) <= 0}
                            >
                                Tambahkan ke Keranjang
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* === RIGHT: REGISTER / CART === */}
            <div className="w-full md:w-[360px] lg:w-[420px] flex flex-col h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-10 shrink-0">

                {/* Customer Section Header */}
                <div className="bg-zinc-50 dark:bg-zinc-800 p-3 border-b-2 border-black flex justify-between items-center">
                    <button
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        onClick={() => setShowCustomerDialog(true)}
                    >
                        <div className={cn(
                            "h-9 w-9 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center",
                            selectedCustomer.type === "COMPANY" ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-700"
                        )}>
                            {selectedCustomer.type === "COMPANY" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Pelanggan</span>
                            <span className="font-bold text-sm">{selectedCustomer.name}</span>
                        </div>
                    </button>

                    <div className="flex gap-2">
                        {wholesaleMode && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest border-2 border-black">
                                <Store className="h-3 w-3" /> Grosir
                            </div>
                        )}

                        {parkedCarts.length > 0 && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative bg-amber-400 hover:bg-amber-500 hover:text-black">
                                        <History className="h-4 w-4" />
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 bg-red-500 border border-black text-white text-[9px] items-center justify-center font-bold">{parkedCarts.length}</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                                    <DialogHeader>
                                        <DialogTitle className="uppercase font-black text-sm tracking-widest">Order Diparkir</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2 mt-2">
                                        {parkedCarts.map(p => (
                                            <div key={p.id} className="flex justify-between items-center p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all bg-white dark:bg-zinc-900" onClick={() => restoreCart(p.id)}>
                                                <div className="font-bold text-sm">{p.name} <span className="text-[10px] font-medium text-zinc-400">({p.items.length} item)</span></div>
                                                <div className="text-[10px] font-mono text-zinc-400">{p.time.toLocaleTimeString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all bg-white dark:bg-zinc-800"
                            onClick={parkCart}
                            disabled={cart.length === 0}
                            title="Parkir Order (F5)"
                        >
                            <PauseCircle className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Customer Lookup Dialog */}
                <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                    <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-0 overflow-hidden sm:max-w-md">
                        <div className="bg-black text-white p-4 border-b-2 border-black">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Pilih Pelanggan</h2>
                            <Input
                                placeholder="Cari pelanggan..."
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                className="border-2 border-zinc-600 bg-zinc-900 text-white font-bold h-10 mt-1"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            <button
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 border-b-2 border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left",
                                    selectedCustomer.id === "walk-in" && "bg-zinc-50 dark:bg-zinc-800"
                                )}
                                onClick={() => { selectCustomer(CUSTOMERS[0]); setWholesaleMode(false); }}
                            >
                                <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center border border-black">
                                    <User className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm">Walk-In Guest</div>
                                    <div className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Pelanggan Umum</div>
                                </div>
                            </button>

                            {filteredCustomers.map(c => (
                                <button
                                    key={c.id}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left",
                                        selectedCustomer.id === c.id && "bg-zinc-50 dark:bg-zinc-800"
                                    )}
                                    onClick={() => selectCustomer(c)}
                                >
                                    <div className={cn(
                                        "h-8 w-8 flex items-center justify-center border border-black",
                                        c.type === "COMPANY" ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-700"
                                    )}>
                                        {c.type === "COMPANY" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm">{c.name}</div>
                                        <div className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">
                                            {c.type === "COMPANY" ? "Perusahaan" : "Perorangan"} — Limit {formatRupiah(c.creditLimit)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Cart Items Area */}
                <div className="flex-1 bg-white dark:bg-zinc-900 relative flex flex-col">
                    <ScrollArea className="flex-1 p-4">
                        <AnimatePresence initial={false}>
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4 select-none py-16"
                                >
                                    <div className="h-20 w-20 border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                        <ShoppingCart className="h-8 w-8 text-zinc-300" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Register Ready</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, index) => {
                                        const product = PRODUCTS.find(p => p.id === item.id);
                                        if (!product) return null;
                                        const price = getPrice(product);
                                        const qty = item.meters ?? item.qty;
                                        const isCutItem = item.meters !== undefined;
                                        return (
                                            <motion.div
                                                key={`${item.id}-${isCutItem ? "m" : "q"}`}
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="flex items-start gap-3 group relative pl-6"
                                            >
                                                <div className="absolute left-0 top-1 text-[9px] font-mono text-zinc-400 w-4 text-right">
                                                    {(index + 1).toString().padStart(2, '0')}
                                                </div>

                                                <div className="flex-1 border-b border-dashed border-zinc-200 dark:border-zinc-700 pb-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="pr-4">
                                                            <h4 className="font-bold text-xs uppercase leading-tight">{product.name}</h4>
                                                            {isCutItem && (
                                                                <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1 mt-0.5 tracking-widest">
                                                                    <Ruler className="h-3 w-3" /> Potong Kain
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-mono font-bold text-xs">{formatRupiah(price * qty)}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="text-[10px] text-zinc-400 font-medium">
                                                            @{formatRupiah(price).replace("Rp", "").trim()}/{product.unit}
                                                        </div>

                                                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-0.5">
                                                            <button className="h-5 w-5 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-xs font-bold" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></button>
                                                            <span className="w-8 text-center text-[10px] font-black font-mono">
                                                                {isCutItem ? `${qty}m` : qty}
                                                            </span>
                                                            <button className="h-5 w-5 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-xs font-bold" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    className="opacity-0 group-hover:opacity-100 absolute -right-1 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 transition-opacity bg-white dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-700"
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
                <div className="bg-zinc-50 dark:bg-zinc-800 border-t-2 border-black p-4 space-y-3">
                    <div className="space-y-1 text-[10px] font-mono text-zinc-500">
                        <div className="flex justify-between">
                            <span className="font-black uppercase tracking-widest">Subtotal</span>
                            <span>{formatRupiah(cartTotal)}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span className="flex items-center gap-1 font-black uppercase tracking-widest"><Tag className="h-3 w-3" /> Disc ({discount * 100}%)</span>
                                <span>-{formatRupiah(discountAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="font-black uppercase tracking-widest">Tax (11%)</span>
                            <span>{formatRupiah(tax)}</span>
                        </div>
                    </div>

                    <Separator className="bg-black" />

                    <div className="flex justify-between items-end">
                        <span className="font-black text-base uppercase tracking-widest">Total</span>
                        <span className="font-black text-3xl tracking-tighter">{formatRupiah(finalTotal)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 h-12">
                        <Button
                            variant="outline"
                            className={cn(
                                "h-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-black flex flex-col gap-0 items-center justify-center bg-white dark:bg-zinc-800 transition-all rounded-none",
                                discount > 0 ? "bg-black text-white" : ""
                            )}
                            onClick={toggleDiscount}
                        >
                            <Tag className="h-3.5 w-3.5" />
                            <span className="text-[9px] uppercase tracking-widest">Disc</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-black flex flex-col gap-0 items-center justify-center bg-white dark:bg-zinc-800 transition-all rounded-none"
                            onClick={() => setShowPayModal(true)}
                        >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span className="text-[9px] uppercase tracking-widest">Card</span>
                        </Button>

                        <Button
                            className="col-span-2 h-full bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all rounded-none"
                            disabled={cart.length === 0}
                            onClick={() => setShowPayModal(true)}
                        >
                            PAY <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Payment Modal */}
                <Dialog open={showPayModal} onOpenChange={(open) => { setShowPayModal(open); if (!open) { setSplitPayment(false); setSplitCashAmount(""); } }}>
                    <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-0 overflow-hidden sm:max-w-lg">
                        <div className="bg-black text-white p-6 text-center border-b-2 border-black">
                            <h2 className="text-zinc-400 uppercase tracking-widest text-[10px] font-black mb-2">Total Bayar</h2>
                            <div className="text-4xl font-black tracking-tighter">{formatRupiah(finalTotal)}</div>
                            {selectedCustomer.id !== "walk-in" && (
                                <div className="text-zinc-400 text-[10px] font-black mt-2 uppercase tracking-widest">{selectedCustomer.name}</div>
                            )}
                        </div>

                        {!splitPayment ? (
                            <>
                                <div className="p-6 grid grid-cols-2 gap-4">
                                    <Button
                                        className="h-20 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-50 flex flex-col gap-2 transition-all"
                                        onClick={() => handlePayment("CASH")}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? <Sparkles className="h-7 w-7 animate-spin" /> : <Banknote className="h-7 w-7" />}
                                        <span className="font-black uppercase tracking-widest text-[10px]">{isProcessing ? "Proses..." : "Tunai"}</span>
                                    </Button>
                                    <Button
                                        className="h-20 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-50 flex flex-col gap-2 transition-all"
                                        onClick={() => handlePayment("CARD")}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? <Sparkles className="h-7 w-7 animate-spin" /> : <CreditCard className="h-7 w-7" />}
                                        <span className="font-black uppercase tracking-widest text-[10px]">{isProcessing ? "Menghubungkan..." : "Kartu / QRIS"}</span>
                                    </Button>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border-t-2 border-black flex justify-between items-center">
                                    <Button variant="ghost" className="font-bold text-zinc-500 text-xs" onClick={() => setShowPayModal(false)}>Batal</Button>
                                    <Button
                                        variant="outline"
                                        className="font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 uppercase text-[10px] tracking-widest"
                                        onClick={() => setSplitPayment(true)}
                                    >
                                        <Split className="h-3.5 w-3.5" /> Split Pembayaran
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-6 space-y-4">
                                    <div className="text-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Split Pembayaran — Tunai + Kartu</span>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Bagian Tunai</label>
                                        <Input
                                            type="number"
                                            placeholder="Masukkan jumlah tunai..."
                                            value={splitCashAmount}
                                            onChange={e => setSplitCashAmount(e.target.value)}
                                            className="border-2 border-black font-mono font-bold text-xl text-center h-12"
                                            autoFocus
                                        />
                                    </div>

                                    {splitCashAmount && Number(splitCashAmount) > 0 && (
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div className="p-3 border-2 border-black bg-emerald-50 dark:bg-emerald-900/20">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tunai</div>
                                                <div className="text-base font-black">{formatRupiah(Number(splitCashAmount))}</div>
                                            </div>
                                            <div className="p-3 border-2 border-black bg-blue-50 dark:bg-blue-900/20">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kartu / QRIS</div>
                                                <div className="text-base font-black">{formatRupiah(Math.max(0, finalTotal - Number(splitCashAmount)))}</div>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full h-11 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-widest text-xs transition-all"
                                        onClick={() => handlePayment("SPLIT")}
                                        disabled={isProcessing || !splitCashAmount || Number(splitCashAmount) <= 0 || Number(splitCashAmount) >= finalTotal}
                                    >
                                        {isProcessing ? "Memproses..." : "Proses Split Pembayaran"}
                                    </Button>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 border-t-2 border-black flex justify-between items-center">
                                    <Button variant="ghost" className="font-bold text-zinc-500 text-xs" onClick={() => setSplitPayment(false)}>
                                        <X className="h-4 w-4 mr-1" /> Kembali
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

            </div>
        </div>
    );
}
