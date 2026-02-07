"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
    const { setTheme, theme } = useTheme()

    const themes = [
        { name: "Light", value: "light" },
        { name: "Dark", value: "dark" },
        { name: "Claude", value: "claude" },
        { name: "Ritchie Pop", value: "ritchie" },
        { name: "Ritchie Minimal", value: "ritchie-minimal" },
    ]

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-800 bg-transparent text-zinc-400 hover:text-foreground hover:bg-zinc-800/50 backdrop-blur-sm">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-popover/90 backdrop-blur-lg border-border/50">
                {themes.map((t) => (
                    <DropdownMenuItem
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={`cursor-pointer ${theme === t.value ? "bg-accent text-accent-foreground font-medium" : ""}`}
                    >
                        {t.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
