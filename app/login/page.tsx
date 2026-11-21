"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { IntegraLogo, INTEGRA_COLORS } from "@/components/brand/integra-logo"
import { loginErrorMessage } from "@/lib/auth-messages"
import { businessPitch } from "@/lib/business-profile"

/** The modules this business uses, as the sidebar shows them (never promise a hidden one). */
const pitch = businessPitch()

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    /** True once sign-in worked and the dashboard is loading: the button says so. */
    const [isOpening, setIsOpening] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rememberMe, setRememberMe] = useState(false)
    const [tenantName, setTenantName] = useState<string | null>(null)
    const [localDemoAvailable, setLocalDemoAvailable] = useState(false)

    // Load tenant branding
    useEffect(() => {
        fetch("/api/tenant")
            .then(res => res.json())
            .then(data => {
                if (data?.tenantName) setTenantName(data.tenantName)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetch("/api/dev/local-demo", { method: "GET", cache: "no-store" })
            .then((res) => {
                if (res.ok) setLocalDemoAvailable(true)
            })
            .catch(() => {})
    }, [])

    // Detect session expiry redirect (from middleware ?expired=true)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get("expired") === "true") {
            toast.info("Sesi Anda telah berakhir. Silakan masuk kembali.", { duration: 5000 })
            // Clean up URL without reload
            window.history.replaceState({}, "", "/login")
        }
    }, [])

    // Load saved email on component mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberedEmail')
        const savedRememberMe = localStorage.getItem('rememberMe')

        if (savedEmail && savedRememberMe === 'true') {
            setEmail(savedEmail)
            setRememberMe(true)
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) return

        setIsLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                // One plain Indonesian message, shown once, next to the form (no English, no duplicate toast).
                setError(loginErrorMessage(error.message))
                return
            }

            // Save email only if "Remember Me" is checked (never store passwords)
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email)
                localStorage.setItem('rememberMe', 'true')
            } else {
                localStorage.removeItem('rememberedEmail')
                localStorage.removeItem('rememberMe')
            }
            // Always clean up any legacy password storage
            localStorage.removeItem('rememberPassword')

            setIsOpening(true)
            window.location.href = "/dashboard"
        } catch (err) {
            console.error("Login Error:", err)
            setError(loginErrorMessage(err instanceof Error ? err.message : ""))
        } finally {
            setIsLoading(false)
        }
    }

    const handleLocalDemo = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/dev/local-demo", { method: "POST" })
            if (!res.ok) {
                setError("Demo lokal tidak tersedia")
                toast.error("Demo lokal tidak tersedia")
                return
            }
            setIsOpening(true)
            window.location.href = "/dashboard"
        } catch {
            setError("Demo lokal gagal")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen bg-background">
            {/* Left panel — brand (desktop only). Fixed navy: a brand surface, not themable chrome. */}
            <aside
                className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex lg:w-[44%] xl:w-[46%] xl:p-14"
                style={{ background: INTEGRA_COLORS.navy }}
            >
                {/* Quiet ledger bars, echoing the mark */}
                <div aria-hidden className="pointer-events-none absolute -right-16 bottom-16 flex flex-col items-center gap-6 opacity-[0.06]">
                    <div className="h-12 w-56 rounded-xl bg-white" />
                    <div className="h-12 w-80 rounded-xl bg-white" />
                    <div className="h-12 w-[26rem] rounded-xl bg-white" />
                </div>

                <IntegraLogo tone="inverse" size="lg" caption="ERP" className="relative" />

                <div className="relative max-w-md space-y-5">
                    <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-[2.75rem]">
                        Satu sistem.
                        <br />
                        <span className="text-blue-300">Semua kendali.</span>
                    </h2>
                    <p className="text-base leading-relaxed text-slate-300">
                        {pitch.line}
                    </p>
                    <ul className="flex flex-wrap gap-2 pt-1" aria-label="Modul">
                        {pitch.modules.map((mod) => (
                            <li key={mod} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-slate-200">
                                {mod}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-sm text-slate-400">
                    {tenantName ? `Portal ${tenantName}` : "Dibuat untuk pemilik usaha. Bukan departemen IT."}
                </p>
            </aside>

            {/* Right panel — login form */}
            <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
                <div className="w-full max-w-[440px]">
                    {/* Logo for phones and tablets */}
                    <div className="mb-8 flex justify-center lg:hidden">
                        <IntegraLogo size="lg" caption="ERP" />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
                        {/* Header */}
                        <div className="mb-6 space-y-1.5">
                            {tenantName && (
                                <p className="text-sm font-semibold text-primary">
                                    {tenantName}
                                </p>
                            )}
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                Masuk
                            </h1>
                            <p className="text-[15px] text-muted-foreground">
                                {tenantName ? `Masuk ke portal ${tenantName}` : "Masuk ke sistem ERP Anda"}
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Error Alert */}
                            {error && (
                                <div role="alert" className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="nama@perusahaan.com"
                                    className="h-11 rounded-md border-input px-3.5 text-base shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                                        Kata sandi
                                    </Label>
                                    <Link href="/forgot-password" className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
                                        Lupa kata sandi?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Masukkan kata sandi"
                                        className="h-11 rounded-md border-input px-3.5 pr-12 text-base shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                        title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                                        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="flex items-center gap-2.5">
                                <input
                                    type="checkbox"
                                    id="remember"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="size-[18px] cursor-pointer rounded border border-input accent-primary"
                                />
                                <label htmlFor="remember" className="cursor-pointer select-none text-sm text-foreground/80">
                                    Ingat email saya
                                </label>
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-md text-base font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isLoading || isOpening}
                            >
                                {isLoading || isOpening ? (
                                    <>
                                        <Loader2 className="size-[18px] animate-spin" aria-hidden />
                                        {isOpening ? "Membuka dasbor…" : "Memeriksa email dan kata sandi…"}
                                    </>
                                ) : (
                                    <>
                                        Masuk
                                        <ArrowRight className="size-[18px]" />
                                    </>
                                )}
                            </Button>
                            {localDemoAvailable && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 w-full rounded-md border-primary/40 text-[15px] font-semibold text-primary hover:bg-primary/5 hover:text-primary"
                                    disabled={isLoading}
                                    onClick={handleLocalDemo}
                                >
                                    Masuk demo lokal (KRI)
                                </Button>
                            )}
                        </form>

                    </div>

                    {/* Sign up link */}
                    <p className="mt-6 text-center text-[15px] text-muted-foreground">
                        Belum punya akun?{" "}
                        <Link href="/signup" className="rounded-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80">
                            Daftar
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
