"use client";

import React, { useRef } from 'react';
import { motion, useMotionValue, useMotionTemplate, useAnimationFrame } from "framer-motion";
import { cn } from "@/lib/utils";

const GridPattern = ({ offsetX, offsetY, size }: { offsetX: any; offsetY: any; size: number }) => {
    return (
        <svg className="w-full h-full">
            <defs>
                <motion.pattern
                    id="grid-pattern-dash"
                    width={size}
                    height={size}
                    patternUnits="userSpaceOnUse"
                    x={offsetX}
                    y={offsetY}
                >
                    <path
                        d={`M ${size} 0 L 0 0 0 ${size}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-muted-foreground/20"
                    />
                </motion.pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern-dash)" />
        </svg>
    );
};

export function InfiniteBackground() {
    const gridSize = 40;

    // Track mouse position
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        // We want global mouse tracking if possible, but localized to container is fine for bg
        const { left, top } = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - left);
        mouseY.set(e.clientY - top);
    };

    // Grid offsets
    const gridOffsetX = useMotionValue(0);
    const gridOffsetY = useMotionValue(0);

    useAnimationFrame(() => {
        const currentX = gridOffsetX.get();
        const currentY = gridOffsetY.get();
        gridOffsetX.set((currentX + 0.2) % gridSize);
        gridOffsetY.set((currentY + 0.2) % gridSize);
    });

    const maskImage = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

    return (
        <div
            className="fixed inset-0 z-0 h-full w-full bg-background"
            onMouseMove={handleMouseMove}
        >
            {/* Base Grid */}
            <div className="absolute inset-0 z-0 opacity-20">
                <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize} />
            </div>

            {/* Highlight Grid */}
            <motion.div
                className="absolute inset-0 z-0 opacity-50"
                style={{ maskImage, WebkitMaskImage: maskImage }}
            >
                <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize} />
            </motion.div>


        </div>
    );
}
