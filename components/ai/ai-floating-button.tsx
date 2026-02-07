"use client";

import { useAI } from "./ai-context";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AIFloatingButton() {
    const { toggle, isOpen } = useAI();

    return (
        <Button
            onClick={toggle}
            size="icon"
            className={cn(
                "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-105",
                "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white border-0",
                "hover:shadow-indigo-500/50 hover:ring-2 hover:ring-offset-2 hover:ring-indigo-500/50",
                isOpen && "rotate-45 scale-90 opacity-70"
            )}
        >
            <Sparkles className={cn("h-6 w-6", isOpen ? "animate-none" : "animate-pulse")} />
            <span className="sr-only">Toggle AI Assistant</span>
        </Button>
    );
}
