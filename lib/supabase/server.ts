import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildLocalDemoAuthUser, isLocalDemoAllowed, LOCAL_DEMO_COOKIE } from '@/lib/local-demo'

export async function createClient() {
    const cookieStore = await cookies()

    // DURING BUILD: Defaults to avoid crash if env vars are missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing the user session.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // The `remove` method was called from a Server Component.
                        // This can be ignored if we have middleware refreshing the user session.
                    }
                },
            },
        }
    )

    if (isLocalDemoAllowed() && cookieStore.get(LOCAL_DEMO_COOKIE)?.value === "1") {
        const demoUser = buildLocalDemoAuthUser()
        supabase.auth.getUser = (async () => ({
            data: { user: demoUser as never },
            error: null,
        })) as typeof supabase.auth.getUser
    }

    return supabase
}
