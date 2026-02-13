"use client"

/**
 * Global Error Boundary — catches errors at the root layout level.
 * This is the LAST line of defense. When auth cookies are stale/corrupt
 * after a server restart, Supabase client-side code can throw unrecoverable
 * errors. This page lets users clear site data and retry without opening DevTools.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const handleClearAndRetry = () => {
        // 1. Clear all cookies (especially sb-* Supabase auth cookies)
        document.cookie.split(";").forEach((c) => {
            const name = c.trim().split("=")[0]
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        })

        // 2. Clear localStorage & sessionStorage (Supabase stores tokens here too)
        try {
            localStorage.clear()
        } catch {}
        try {
            sessionStorage.clear()
        } catch {}

        // 3. Hard reload to /login to get a fresh start
        window.location.href = "/login"
    }

    return (
        <html lang="id">
            <body>
                <div
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fafafa",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        padding: "2rem",
                    }}
                >
                    <div
                        style={{
                            maxWidth: "480px",
                            width: "100%",
                            background: "#fff",
                            border: "2px solid #000",
                            boxShadow: "8px 8px 0px 0px rgba(0,0,0,1)",
                            padding: "2.5rem",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: "64px",
                                height: "64px",
                                background: "#000",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "32px",
                                fontWeight: 900,
                                margin: "0 auto 1.5rem",
                                border: "2px solid #000",
                            }}
                        >
                            !
                        </div>
                        <h1
                            style={{
                                fontSize: "1.5rem",
                                fontWeight: 900,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                margin: "0 0 0.5rem",
                            }}
                        >
                            Sesi Kedaluwarsa
                        </h1>
                        <p
                            style={{
                                fontSize: "0.875rem",
                                color: "#666",
                                margin: "0 0 2rem",
                                lineHeight: 1.6,
                            }}
                        >
                            Sesi login Anda sudah tidak valid. Ini biasanya terjadi setelah server
                            di-restart. Klik tombol di bawah untuk masuk kembali.
                        </p>
                        <button
                            onClick={handleClearAndRetry}
                            style={{
                                width: "100%",
                                padding: "0.875rem 1.5rem",
                                background: "#000",
                                color: "#fff",
                                border: "2px solid #000",
                                boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.3)",
                                fontSize: "0.875rem",
                                fontWeight: 900,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                cursor: "pointer",
                                transition: "all 0.15s",
                                marginBottom: "0.75rem",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = "translate(2px, 2px)"
                                e.currentTarget.style.boxShadow = "2px 2px 0px 0px rgba(0,0,0,0.3)"
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "translate(0, 0)"
                                e.currentTarget.style.boxShadow = "4px 4px 0px 0px rgba(0,0,0,0.3)"
                            }}
                        >
                            Masuk Kembali
                        </button>
                        <button
                            onClick={reset}
                            style={{
                                width: "100%",
                                padding: "0.75rem 1.5rem",
                                background: "#fff",
                                color: "#000",
                                border: "2px solid #000",
                                boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = "translate(2px, 2px)"
                                e.currentTarget.style.boxShadow = "2px 2px 0px 0px rgba(0,0,0,1)"
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "translate(0, 0)"
                                e.currentTarget.style.boxShadow = "4px 4px 0px 0px rgba(0,0,0,1)"
                            }}
                        >
                            Coba Lagi Tanpa Reset
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
