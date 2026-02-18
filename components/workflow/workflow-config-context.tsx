"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface TenantBranding {
    tenantName: string | null;
    planType: string | null;
}

interface WorkflowConfigContextType {
    activeModules: string[] | null; // null = Show All
    setActiveModules: (modules: string[] | null) => void;
    isModuleActive: (moduleName: string) => boolean;
    refreshFromServer: () => Promise<void>;
    tenantBranding: TenantBranding;
}

const WorkflowConfigContext = createContext<WorkflowConfigContextType | undefined>(undefined);

const normalizeModules = (modules: string[]) =>
    Array.from(
        new Set(
            modules
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim().toUpperCase())
                .filter(Boolean)
        )
    )

export function WorkflowConfigProvider({ children }: { children: React.ReactNode }) {
    const [activeModules, setActiveModulesState] = useState<string[] | null>(null);
    const [hasLocalOverride, setHasLocalOverride] = useState(false);
    const [tenantBranding, setTenantBranding] = useState<TenantBranding>({ tenantName: null, planType: null });

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

            const permissions = normalizeModules(permissionsRaw as string[])
            const systemRoleCode = typeof payload?.data?.systemRoleCode === "string"
                ? payload.data.systemRoleCode.trim().toUpperCase()
                : null

            // Capture tenant branding if present
            if (payload?.data?.tenantName) {
                setTenantBranding({
                    tenantName: payload.data.tenantName,
                    planType: payload.data.planType || null,
                })
            }

            if (permissions.includes("ALL")) {
                setActiveModulesState(null)
                return
            }

            // If no mapped system role exists yet, default to "show all" to preserve legacy behavior.
            // If mapped role exists but has no permissions, lock navigation to dashboard-only.
            if (!systemRoleCode) {
                setActiveModulesState(null)
                return
            }
            setActiveModulesState(permissions.length > 0 ? permissions : [])
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
                    setActiveModulesState(normalizeModules(parsed));
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
        const normalized = modules ? normalizeModules(modules) : null
        setActiveModulesState(normalized);
        if (modules) {
            localStorage.setItem("erp_active_modules", JSON.stringify(normalized));
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
        const normalizedModuleName = moduleName.trim().toUpperCase()
        // Check if any active module string contains the moduleName (fuzzy match for simplicity)
        // e.g. "MOD_SALES" enables "Penjualan & CRM" if we map it correctly.
        // Better: We define a mapping in the Sidebar. 
        // For now, let's assume we pass a key like "SALES" and check if it exists in the active set.
        return activeModules.some((m) => m.includes(normalizedModuleName) || normalizedModuleName.includes(m));
    };

    return (
        <WorkflowConfigContext.Provider value={{ activeModules, setActiveModules, isModuleActive, refreshFromServer, tenantBranding }}>
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
