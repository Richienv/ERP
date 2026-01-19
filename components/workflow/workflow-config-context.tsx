"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface WorkflowConfigContextType {
    activeModules: string[] | null; // null = Show All
    setActiveModules: (modules: string[] | null) => void;
    isModuleActive: (moduleName: string) => boolean;
}

const WorkflowConfigContext = createContext<WorkflowConfigContextType | undefined>(undefined);

export function WorkflowConfigProvider({ children }: { children: React.ReactNode }) {
    const [activeModules, setActiveModulesState] = useState<string[] | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("erp_active_modules");
        if (saved) {
            try {
                setActiveModulesState(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse active modules", e);
            }
        }
    }, []);

    const setActiveModules = (modules: string[] | null) => {
        setActiveModulesState(modules);
        if (modules) {
            localStorage.setItem("erp_active_modules", JSON.stringify(modules));
        } else {
            localStorage.removeItem("erp_active_modules");
        }
    };

    const isModuleActive = (moduleName: string) => {
        if (!activeModules) return true; // Show all if no config
        // Check if any active module string contains the moduleName (fuzzy match for simplicity)
        // e.g. "MOD_SALES" enables "Penjualan & CRM" if we map it correctly.
        // Better: We define a mapping in the Sidebar. 
        // For now, let's assume we pass a key like "SALES" and check if it exists in the active set.
        return activeModules.some(m => m.includes(moduleName) || moduleName.includes(m));
    };

    return (
        <WorkflowConfigContext.Provider value={{ activeModules, setActiveModules, isModuleActive }}>
            {children}
        </WorkflowConfigContext.Provider>
    );
}

export function useWorkflowConfig() {
    const context = useContext(WorkflowConfigContext);
    if (context === undefined) {
        throw new Error("useWorkflowConfig must be used within a WorkflowConfigProvider");
    }
    return context;
}
