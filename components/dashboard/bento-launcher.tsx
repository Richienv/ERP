"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export interface BentoLauncherItem {
    title: string
    href: string
    icon: LucideIcon
    description?: string
    color?: string // Tailwind class for text color
    gradient?: string // CSS gradient
}

interface BentoLauncherProps {
    items: BentoLauncherItem[]
    columns?: 2 | 3 | 4
    compact?: boolean
}

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function BentoLauncher({ items, columns = 3, compact = false }: BentoLauncherProps) {
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isRitchiePop = mounted && theme === "ritchie"
    const isRitchieMinimal = mounted && theme === "ritchie-minimal"
    const isAnyRitchie = isRitchiePop || isRitchieMinimal

    // Ritchie "Pop" Color Cycle: 9 Distinct Colors
    const popColors = [
        "bg-[oklch(0.6_0.2_250)] text-white border-2 border-black",    // 1. Blue (White text)
        "bg-[oklch(0.9_0.05_350)] text-black border-2 border-black",   // 2. Pink (Black text)
        "bg-[oklch(0.85_0.15_140)] text-black border-2 border-black",  // 3. Green (Black text)
        "bg-[oklch(0.85_0.17_90)] text-black border-2 border-black",   // 4. Yellow (Black text)
        "bg-[oklch(0.7_0.18_300)] text-white border-2 border-black",   // 5. Purple (White text)
        "bg-[oklch(0.75_0.18_50)] text-black border-2 border-black",   // 6. Orange (Black text)
        "bg-[oklch(0.65_0.22_25)] text-white border-2 border-black",   // 7. Red (White text)
        "bg-[oklch(0.8_0.15_200)] text-black border-2 border-black",   // 8. Cyan (Black text)
        "bg-[oklch(0.9_0.18_130)] text-black border-2 border-black"    // 9. Lime (Black text)
    ]

    const minimalStyle = "bg-white text-black border-2 border-black"

    return (
        <div className={cn(
            "grid gap-6 transition-all duration-300",
            compact
                ? "grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"
                : cn(
                    columns === 2 && "grid-cols-1 md:grid-cols-2",
                    columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                    columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                )
        )}>
            {items.map((item, index) => {
                let ritchieStyle = ""
                if (isRitchiePop) {
                    ritchieStyle = popColors[index % popColors.length]
                } else if (isRitchieMinimal) {
                    ritchieStyle = minimalStyle
                }

                // For Blue card in Ritchie, icon bg should be careful. 
                // Actually in Pop design, icons typically are simple (White on Blue, Black on others).
                // We'll handle icon styling dynamically.

                return (
                    <Link key={item.title} href={item.href} className="block group w-full">
                        <motion.div
                            layout
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                                "relative overflow-hidden shadow-md hover:shadow-xl transition-all duration-500",
                                compact ? "rounded-2xl p-4 aspect-square flex flex-col items-center justify-center text-center" : "rounded-3xl p-8 h-48 md:h-56",
                                !compact && "flex flex-col items-center justify-center text-center", // Always center content (Default & Ritchie)
                                isAnyRitchie
                                    ? cn(ritchieStyle, "shadow-none hover:shadow-none") // Ritchie: High contrast
                                    : "bg-card border border-sidebar-primary/30"
                            )}
                        >


                            {/* 3. Content */}
                            <div className={cn(
                                "relative z-10",
                                !compact && "flex flex-col items-center gap-3", // Always flex center
                                !compact && isAnyRitchie && "w-full" // Ensure width for centering
                            )}>
                                {/* Icon with Dynamic Color: Hidden in Ritchie Minimal Large Cards */}
                                {(!isRitchieMinimal || compact) && (
                                    <div className={cn(
                                        "rounded-2xl transition-transform duration-500 group-hover:scale-110",
                                        compact ? "p-2.5" : "p-3",
                                        !compact && isAnyRitchie ? "absolute -top-6 -right-6 m-4" : "", // Ritchie: Top-Right (with offset)
                                        isRitchiePop
                                            ? "bg-white/20 backdrop-blur-sm p-2 rounded-full border-2 border-black/10" // Pop: Smaller Bubble
                                            : isRitchieMinimal
                                                ? "bg-black text-white p-2 rounded-full border-none shadow-none" // Minimal: Smaller Bubble (Only shows in Compact)
                                                : cn("bg-secondary", item.color) // Default
                                    )}>
                                        <item.icon className={cn(
                                            compact ? "w-6 h-6" : "w-8 h-8",
                                            isAnyRitchie ? "w-5 h-5" : "", // Smaller icon for Ritchie
                                            isAnyRitchie
                                                ? "text-current" // Inherit text color
                                                : ""
                                        )} />
                                    </div>
                                )}

                                {!compact && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    // Removed absolute positioning to allow centering
                                    >
                                        <h3 className={cn(
                                            "font-serif text-2xl font-medium mb-1",
                                            isAnyRitchie ? "font-bold" : "text-foreground"
                                        )}>{item.title}</h3>
                                        {item.description && (
                                            <p className={cn(
                                                "text-sm font-medium",
                                                isAnyRitchie ? "opacity-80" : "text-muted-foreground"
                                            )}>{item.description}</p>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* 4. Glass Shine Effect on Hover (Default Only) */}
                            {!isAnyRitchie && (
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
                            )}

                        </motion.div>
                        {compact && (
                            <p className="mt-2 text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors truncate w-full px-1">{item.title}</p>
                        )}
                    </Link>
                )
            })}
        </div>
    )
}
