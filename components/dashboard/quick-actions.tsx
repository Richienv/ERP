"use client";

import {
    Plus,
    Package,
    Users,
    FileText,
    ShoppingCart,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
    label: string;
    icon: React.ElementType;
    color: string;
    href: string;
}

const actions: ActionItem[] = [
    { label: "New Sale", icon: ShoppingCart, color: "text-blue-400 group-hover:text-blue-300", href: "/sales/new" },
    { label: "Add Product", icon: Package, color: "text-emerald-400 group-hover:text-emerald-300", href: "/inventory/new" },
    { label: "New Invoice", icon: FileText, color: "text-purple-400 group-hover:text-purple-300", href: "/finance/invoice/new" },
    { label: "Add Customer", icon: Users, color: "text-orange-400 group-hover:text-orange-300", href: "/crm/new" },
    { label: "Check Stock", icon: Package, color: "text-pink-400 group-hover:text-pink-300", href: "/inventory" },
    { label: "View Reports", icon: FileText, color: "text-cyan-400 group-hover:text-cyan-300", href: "/reports" },
];

export function QuickActions() {
    return (
        <div className="col-span-1 md:col-span-2 row-span-3 grid grid-cols-2 gap-4">
            {actions.map((action, i) => (
                <a
                    key={i}
                    href={action.href}
                    className="group relative flex flex-col items-center justify-center gap-4 rounded-3xl bg-zinc-900 border border-zinc-700 p-6 text-center transition-all duration-300 hover:bg-zinc-800/50"
                >
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/50 border border-zinc-700/50 transition-colors group-hover:bg-zinc-700 group-hover:scale-110 duration-300")}>
                        <action.icon className="h-6 w-6 text-zinc-300 group-hover:text-white" />
                    </div>
                    <span className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors tracking-wide">
                        {action.label}
                    </span>

                    <div className="absolute right-4 top-4 opacity-0 transition-all duration-300 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0">
                        <Plus className="h-3 w-3 text-white" />
                    </div>
                </a>
            ))}
        </div>
    );
}
