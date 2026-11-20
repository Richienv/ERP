/**
 * Which kind of business this deployment serves, so the dashboard shows only what that
 * business uses (ui-ux-master skill: one screen, one job; no cards nobody acts on).
 *
 * - "sparepart" (default): spare-part trading. Armada (fleet) and SDM (staff, attendance,
 *   leave) are not run in this ERP, so the dashboard and its work inbox leave them out.
 * - "mining": the KRI mining edition. Armada and SDM stay on the dashboard.
 *
 * Set NEXT_PUBLIC_BUSINESS_PROFILE=mining on a mining deployment. The menus and pages
 * themselves are unchanged; this only decides what the dashboard puts in front of people.
 */

export type BusinessProfile = "sparepart" | "mining"

/** Dashboard sections that only some businesses use. */
export type OptionalDashboardModule = "fleet" | "hcm"

const DASHBOARD_MODULES: Record<BusinessProfile, Record<OptionalDashboardModule, boolean>> = {
    sparepart: { fleet: false, hcm: false },
    mining: { fleet: true, hcm: true },
}

export function getBusinessProfile(): BusinessProfile {
    // Next inlines NEXT_PUBLIC_* at build time, so this is safe on server and client.
    return process.env.NEXT_PUBLIC_BUSINESS_PROFILE === "mining" ? "mining" : "sparepart"
}

/** Should the dashboard show this module's card and its inbox items? */
export function dashboardShows(module: OptionalDashboardModule, profile: BusinessProfile = getBusinessProfile()): boolean {
    return DASHBOARD_MODULES[profile][module]
}

/** True for dashboard modules that are always shown (finance, procurement, inventory…). */
export function dashboardShowsModule(module: string, profile: BusinessProfile = getBusinessProfile()): boolean {
    if (module === "fleet" || module === "hcm") return dashboardShows(module, profile)
    return true
}
