/**
 * Module visibility for integra.id Mining Edition (KRI scope).
 *
 * Set to true → menu visible in sidebar.
 * Set to false → menu hidden (route still exists for code reuse,
 *   but unreachable via normal navigation — useful for gradual feature
 *   unlock per customer tier later).
 *
 * Add new module key here, then tag the corresponding sidebar item
 * with `moduleKey` in `lib/sidebar-nav-data.ts`.
 */

export const MODULE_FLAGS = {
    // ── CORE 4 + meta (always on for mining edition) ──
    dashboard: true,
    inventory: true,
    procurement: true,
    finance: true,
    hcm: true,
    settings: true,
    help: true,
    search: true,

    // ── HIDDEN for KRI MVP ──
    // Sales pipeline / quotation / leads — too generic, KRI uses different flow.
    // Customer master accessed via Finance > Invoicing instead.
    sales: false,

    // POS — not relevant for B2B rental/service
    pos: false,

    // Manufacturing (BoM, work orders, MPS, cutting, subcontract) — textile-specific
    manufacturing: false,

    // Operational documents module — superseded by per-module reports
    documents: false,

    // Role-specific dashboards (Accountant, Manager, Staff portal)
    // → CEO dashboard cukup untuk single-tenant view
    accountantPortal: false,
    managerPortal: false,
    staffPortal: false,

    // Permission matrix + admin tools — defer until enterprise tier
    permissionMatrix: false,
    documentNumbering: false,

    // ── INVENTORY SUB-FEATURES (textile-specific) ──
    inventoryFabricRolls: false, // hide "Fabric Rolls" subitem

    // ── HCM SUB-FEATURES ──
    hcmShifts: true, // mining sites pakai shift kerja
    hcmOnboarding: true,
} as const

export type ModuleKey = keyof typeof MODULE_FLAGS

export function isModuleEnabled(key: ModuleKey | undefined): boolean {
    if (!key) return true // untagged items default to visible
    return MODULE_FLAGS[key] === true
}
