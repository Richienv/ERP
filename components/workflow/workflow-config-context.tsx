"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface WorkflowConfigContextType {
    activeModules: string[] | null; // null = Show All
    setActiveModules: (modules: string[] | null) => void;
    isModuleActive: (moduleName: string) => boolean;
    refreshFromServer: () => Promise<void>;
}

const WorkflowConfigContext = createContext<WorkflowConfigContextType | undefined>(undefined);

export function WorkflowConfigProvider({ children }: { children: React.ReactNode }) {
    const [activeModules, setActiveModulesState] = useState<string[] | null>(null);
    const [hasLocalOverride, setHasLocalOverride] = useState(false);

    const refreshFromServer = async () => {
        try {
            const response = await fetch("/api/system/module-access", {
                method: "GET",
                cache: "no-store",
            })
            if (!response.ok) return
            const payload = await response.json()
            if (!payload?.success) return

            const permissionsRaw = payload?.data?.permissions
            if (!Array.isArray(permissionsRaw)) return

            const permissions = Array.from(
                new Set(
                    permissionsRaw
                        .filter((value: unknown) => typeof value === "string")
                        .map((value: string) => value.trim().toUpperCase())
                        .filter(Boolean)
                )
            )

            if (permissions.includes("ALL")) {
                setActiveModulesState(null)
                return
            }
            setActiveModulesState(permissions.length > 0 ? permissions : null)
        } catch (error) {
            console.error("Failed to refresh module permissions from server", error)
        }
    }

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("erp_active_modules");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setActiveModulesState(parsed);
                    setHasLocalOverride(true);
                } else {
                    console.warn("Invalid config format in localStorage, resetting.");
                    localStorage.removeItem("erp_active_modules");
                }
            } catch (e) {
                console.error("Failed to parse active modules", e);
                localStorage.removeItem("erp_active_modules");
            }
        } else {
            void refreshFromServer()
        }
    }, []);

    const setActiveModules = (modules: string[] | null) => {
        setActiveModulesState(modules);
        if (modules) {
            localStorage.setItem("erp_active_modules", JSON.stringify(modules));
            setHasLocalOverride(true);
        } else {
            localStorage.removeItem("erp_active_modules");
            setHasLocalOverride(false);
            void refreshFromServer()
        }
    };

    useEffect(() => {
        if (hasLocalOverride) return
        const intervalId = window.setInterval(() => {
            void refreshFromServer()
        }, 60000)
        return () => window.clearInterval(intervalId)
    }, [hasLocalOverride])

    const isModuleActive = (moduleName: string) => {
        if (!activeModules) return true; // Show all if no config
        if (!Array.isArray(activeModules)) return true; // Safety fallback
        // Check if any active module string contains the moduleName (fuzzy match for simplicity)
        // e.g. "MOD_SALES" enables "Penjualan & CRM" if we map it correctly.
        // Better: We define a mapping in the Sidebar. 
        // For now, let's assume we pass a key like "SALES" and check if it exists in the active set.
        return activeModules.some(m => typeof m === 'string' && (m.includes(moduleName) || moduleName.includes(m)));
    };

    return (
        <WorkflowConfigContext.Provider value={{ activeModules, setActiveModules, isModuleActive, refreshFromServer }}>
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
