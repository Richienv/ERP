/**
 * Local-only demo session. Never active on Vercel or NODE_ENV=production.
 * Requires ALLOW_LOCAL_DEMO=1 in the process environment.
 */
export const LOCAL_DEMO_COOKIE = "kri-local-demo"
export const LOCAL_DEMO_EMAIL = "demo.kri@local"
export const LOCAL_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export function isLocalDemoAllowed(
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    return (
        env.ALLOW_LOCAL_DEMO === "1" &&
        env.NODE_ENV !== "production" &&
        env.VERCEL !== "1"
    )
}

/** Client-safe flag — Next inlines NEXT_PUBLIC_* at compile time. */
export function isLocalDemoUiEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO === "1"
}

export function buildLocalDemoAuthUser() {
    const now = new Date().toISOString()
    return {
        id: LOCAL_DEMO_USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: LOCAL_DEMO_EMAIL,
        email_confirmed_at: now,
        phone: "",
        confirmed_at: now,
        last_sign_in_at: now,
        app_metadata: { provider: "local-demo", providers: ["local-demo"] },
        user_metadata: { name: "Demo KRI", role: "ROLE_ADMIN" },
        identities: [],
        created_at: now,
        updated_at: now,
        is_anonymous: false,
    }
}
