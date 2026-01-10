"use client";

import React, { createContext, useContext, useState } from "react";

interface AIContextType {
    isOpen: boolean;
    toggle: () => void;
    close: () => void;
    open: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggle = () => setIsOpen((prev) => !prev);
    const close = () => setIsOpen(false);
    const open = () => setIsOpen(true);

    return (
        <AIContext.Provider value={{ isOpen, toggle, close, open }}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI() {
    const context = useContext(AIContext);
    if (context === undefined) {
        throw new Error("useAI must be used within an AIProvider");
    }
    return context;
}
