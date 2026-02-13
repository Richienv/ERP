import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Wrap getUser in try/catch with timeout — if auth is broken (stale JWT, network error),
    // treat user as unauthenticated and clear auth cookies to prevent error loops
    let user = null
    try {
        const authPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        const result = await Promise.race([authPromise, timeoutPromise])

        if (result && 'data' in result && !result.error) {
            user = result.data?.user ?? null
        } else if (result && 'error' in result) {
            // Auth returned an error (e.g., invalid token) — clear auth cookies
            clearAuthCookies(response, request)
        }
        // If timeout won (result is null), user stays null — treated as unauthenticated
    } catch (err) {
        // getUser() threw an exception — clear auth cookies
        console.error("Middleware: auth.getUser() threw, clearing cookies:", err)
        clearAuthCookies(response, request)
    }

    // Define protected routes
    const protectedRoutes = [
        "/dashboard",
        "/inventory",
        "/finance",
        "/hcm",
        "/sales",
        "/procurement",
        "/manufacturing",
        "/hr",
        "/accountant",
        "/manager",
        "/staff"
    ]

    const { pathname } = request.nextUrl

    // Check if it's a protected route
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
    )

    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const redirectResponse = NextResponse.redirect(url)
        // Also clear auth cookies on the redirect response to prevent loops
        clearAuthCookies(redirectResponse, request)
        return redirectResponse
    }

    // If user is logged in but trying to access login page, redirect to dashboard
    if (user && pathname === '/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return response
}

/**
 * Clear all Supabase auth cookies (sb-*) to prevent stale session loops.
 */
function clearAuthCookies(response: NextResponse, request: NextRequest) {
    request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-') || name.includes('supabase')) {
            response.cookies.set(name, '', {
                expires: new Date(0),
                path: '/',
            })
        }
    })
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
