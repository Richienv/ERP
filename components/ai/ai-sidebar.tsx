"use client";

import { useAI } from "./ai-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Bot,
    Send,
    X,
    Sparkles,
    Zap,
    BarChart3,
    Search
} from "lucide-react";

export function AISidebar() {
    const { isOpen, close } = useAI();

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={close}
            />

            {/* Sidebar Panel */}
            <div
                className={cn(
                    "fixed right-0 top-0 z-50 h-full w-[400px] border-l border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-purple-500/20">
                                <Bot className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold font-heading tracking-tight text-white">
                                    ERP Intelligence
                                </h2>
                                <p className="text-xs text-zinc-400">Powered by Gemini</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={close}
                            className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Quick Actions (Mock) */}
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-auto flex flex-col items-center gap-2 p-3 border-white/5 bg-white/5 hover:bg-white/10 hover:text-indigo-300 transition-colors">
                                <BarChart3 className="h-5 w-5" />
                                <span className="text-xs">Analyze Sales</span>
                            </Button>
                            <Button variant="outline" className="h-auto flex flex-col items-center gap-2 p-3 border-white/5 bg-white/5 hover:bg-white/10 hover:text-pink-300 transition-colors">
                                <Zap className="h-5 w-5" />
                                <span className="text-xs">Predict Stock</span>
                            </Button>
                        </div>
                    </div>


                    {/* Chat Area (Mock) */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {/* AI Message */}
                            <div className="flex gap-3">
                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20">
                                    <Sparkles className="h-4 w-4 text-indigo-400" />
                                </div>
                                <div className="rounded-2xl rounded-tl-sm bg-white/5 p-4 text-sm text-zinc-200 shadow-sm border border-white/5">
                                    <p>Hello! I'm your ERP Assistant. How can I help you optimize your business today?</p>
                                </div>
                            </div>

                            {/* User Message Mock */}
                            <div className="flex gap-3 flex-row-reverse">
                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700">
                                    <span className="text-xs font-bold">ME</span>
                                </div>
                                <div className="rounded-2xl rounded-tr-sm bg-indigo-600 p-4 text-sm text-white shadow-md">
                                    <p>Show me the top selling products this week.</p>
                                </div>
                            </div>

                            {/* AI Response Mock */}
                            <div className="flex gap-3">
                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20">
                                    <Sparkles className="h-4 w-4 text-indigo-400" />
                                </div>
                                <div className="space-y-3 rounded-2xl rounded-tl-sm bg-white/5 p-4 text-sm text-zinc-200 shadow-sm border border-white/5">
                                    <p>Here are your top performers:</p>
                                    <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                                        <li>Wireless Headset X1 (150 units)</li>
                                        <li>Mechanical Keyboard Pro (89 units)</li>
                                        <li>Ergonomic Mouse (72 units)</li>
                                    </ul>
                                    <Button size="sm" variant="ghost" className="w-full mt-2 text-xs text-indigo-300 hover:text-indigo-200">View Full Report &rarr;</Button>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/10 bg-black/40">
                        <div className="relative">
                            <Input
                                placeholder="Ask anything about your data..."
                                className="pr-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
                            />
                            <Button
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-zinc-600">
                            AI can make mistakes. Please verify important financial data.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
