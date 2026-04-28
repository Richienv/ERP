import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    // DURING BUILD: Defaults to avoid crash if env vars are missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

    return createServerClient(
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
                        // This can be ignored if you have middleware refreshing the user session.
                    }
                },
            },
        }
    )
}

/**
 * Service-role Supabase client — bypasses RLS. Use for server-side
 * operations that have already enforced authorization at the API layer
 * (e.g. document storage uploads after canViewEntity check).
 *
 * NEVER expose this client or its key to the browser.
 */
let _serviceClient: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
    if (_serviceClient) return _serviceClient
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY (and URL) required for service client')
    }
    _serviceClient = createSupabaseClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    return _serviceClient
}
