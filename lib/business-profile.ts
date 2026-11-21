/**
 * Which kind of business this deployment serves, so the app shows only what that
 * business uses (ui-ux-master skill: one screen, one job; no menus or cards nobody acts on).
 *
 * - "sparepart" (default): spare-part trading. Armada (fleet) and SDM (staff, payroll,
 *   attendance, leave) are not run in this ERP, so the sidebar, the Cmd+K palette, the
 *   dashboard and its work inbox leave them out.
 * - "mining": the KRI mining edition. Armada and SDM stay everywhere.
 *
 * Set NEXT_PUBLIC_BUSINESS_PROFILE=mining on a mining deployment. The /fleet and /hcm pages
 * themselves still open from a direct link (nothing is deleted or redirected); they are
 * just not offered in the menus.
 */

export type BusinessProfile = "sparepart" | "mining"

/** Modules that only some businesses use. */
export type OptionalModule = "fleet" | "hcm"

const PROFILE_MODULES: Record<BusinessProfile, Record<OptionalModule, boolean>> = {
    sparepart: { fleet: false, hcm: false },
    mining: { fleet: true, hcm: true },
}

/** Page prefixes owned by each optional module. */
const MODULE_PATHS: Record<OptionalModule, string> = {
    fleet: "/fleet",
    hcm: "/hcm",
}

export function getBusinessProfile(): BusinessProfile {
    // Next inlines NEXT_PUBLIC_* at build time, so this is safe on server and client.
    return process.env.NEXT_PUBLIC_BUSINESS_PROFILE === "mining" ? "mining" : "sparepart"
}

function isOptionalModule(module: string): module is OptionalModule {
    return module === "fleet" || module === "hcm"
}

/** Does this business use the module? Modules that every business uses return true. */
export function businessUsesModule(module: string, profile: BusinessProfile = getBusinessProfile()): boolean {
    if (isOptionalModule(module)) return PROFILE_MODULES[profile][module]
    return true
}

/** Should the dashboard show this module's card and its inbox items? */
export function dashboardShows(module: OptionalModule, profile: BusinessProfile = getBusinessProfile()): boolean {
    return PROFILE_MODULES[profile][module]
}

/** True for dashboard modules that are always shown (finance, procurement, inventory…). */
export function dashboardShowsModule(module: string, profile: BusinessProfile = getBusinessProfile()): boolean {
    return businessUsesModule(module, profile)
}

/**
 * True when a route belongs to a module this business doesn't use, so menus and the Cmd+K
 * palette should not offer it. Not used for redirects: the page still opens from a link.
 */
export function isProfileHiddenPath(pathname: string, profile: BusinessProfile = getBusinessProfile()): boolean {
    const path = pathname.split(/[?#]/)[0]
    return (Object.keys(MODULE_PATHS) as OptionalModule[]).some((module) => {
        const prefix = MODULE_PATHS[module]
        const owns = path === prefix || path.startsWith(`${prefix}/`)
        return owns && !PROFILE_MODULES[profile][module]
    })
}

/**
 * What the sign-in page promises: one plain line and the modules this business opens in the
 * sidebar (kept equal to the visible sidebar by __tests__/ui-ux-master-guards.test.ts). A plain
 * list here keeps the sidebar's icon set out of the login bundle.
 */
const PROFILE_PITCH: Record<BusinessProfile, { line: string; modules: string[] }> = {
    sparepart: {
        line: "Stok spare part, pembelian, tagihan vendor, dan kas tercatat rapi dalam satu sistem.",
        modules: ["Inventori", "Pengadaan", "Keuangan"],
    },
    mining: {
        line: "Armada, spare part, pembelian, keuangan, dan gaji tercatat rapi dalam satu sistem.",
        modules: ["Armada", "Inventori", "Pengadaan", "Keuangan", "SDM"],
    },
}

export function businessPitch(profile: BusinessProfile = getBusinessProfile()): { line: string; modules: string[] } {
    return PROFILE_PITCH[profile]
}
