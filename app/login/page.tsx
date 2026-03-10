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

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rememberMe, setRememberMe] = useState(false)
    const [tenantName, setTenantName] = useState<string | null>(null)

    // Load tenant branding
    useEffect(() => {
        fetch("/api/tenant")
            .then(res => res.json())
            .then(data => {
                if (data?.tenantName) setTenantName(data.tenantName)
            })
            .catch(() => {})
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
                setError(error.message)
                toast.error("Login gagal: " + error.message)
                return
            }

            // Clear cache warming flag so background warm runs after fresh login
            sessionStorage.removeItem("erp_cache_warmed")

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

            // Check role and redirect accordingly
            const { data: { user } } = await supabase.auth.getUser()
            const role = user?.user_metadata?.role as string

            toast.success("Login berhasil!")

            let targetPath = "/dashboard"
            switch (role) {
                case "ROLE_MANAGER": targetPath = "/manager"; break
                case "ROLE_ACCOUNTANT": targetPath = "/finance"; break
                case "ROLE_SALES": targetPath = "/sales"; break
                case "ROLE_STAFF": targetPath = "/staff"; break
            }
            window.location.href = targetPath
        } catch (err) {
            console.error("Login Error:", err)
            setError("Terjadi kesalahan sistem")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left panel — branding with geometric pattern (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] bg-black relative overflow-hidden items-end p-10">
                {/* CSS geometric grid pattern */}
                <div className="absolute inset-0 opacity-[0.08]" style={{
                    backgroundImage: `
                        linear-gradient(to right, white 1px, transparent 1px),
                        linear-gradient(to bottom, white 1px, transparent 1px)
                    `,
                    backgroundSize: '48px 48px',
                }} />

                {/* Diagonal accent block */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-20"
                     style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400 opacity-10"
                     style={{ clipPath: 'polygon(0 100%, 100% 100%, 0 0)' }} />

                {/* Floating accent squares */}
                <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-emerald-500 rotate-45" />
                <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-white opacity-30" />
                <div className="absolute bottom-1/3 left-1/4 w-4 h-4 border border-emerald-500 rotate-12" />

                {/* Branding content */}
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center">
                            <span className="text-black font-bold text-lg font-heading">E</span>
                        </div>
                        <div className="h-px flex-1 bg-zinc-800 max-w-24" />
                    </div>

                    <h2 className="text-white text-4xl xl:text-5xl font-heading font-bold leading-[1.1] tracking-tight">
                        Kelola bisnis<br />
                        <span className="text-emerald-400">lebih cerdas.</span>
                    </h2>

                    <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
                        Inventori, penjualan, keuangan, manufaktur — semua dalam satu sistem terintegrasi.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {["Inventori", "Penjualan", "Keuangan", "Manufaktur", "SDM"].map((mod) => (
                            <span key={mod} className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 border border-zinc-800 px-2.5 py-1">
                                {mod}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — login form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
                <div className="w-full max-w-[420px] space-y-8">
                    {/* Mobile logo (shown only on small screens) */}
                    <div className="lg:hidden flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 bg-black flex items-center justify-center">
                            <span className="text-emerald-400 font-bold text-base font-heading">E</span>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                            {tenantName || "ERP System"}
                        </span>
                    </div>

                    {/* Header */}
                    <div className="space-y-2">
                        {tenantName && (
                            <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                                {tenantName}
                            </p>
                        )}
                        <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-black">
                            Masuk
                        </h1>
                        <p className="text-zinc-500 text-sm">
                            {tenantName ? `Masuk ke portal ${tenantName}` : "Masuk ke sistem ERP Anda"}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Error Alert */}
                        {error && (
                            <div className="p-3 bg-red-50 border-2 border-red-200 flex items-center gap-2.5 text-sm text-red-700 font-medium shadow-[2px_2px_0px_0px_rgba(239,68,68,0.2)]">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-bold text-black">
                                Email
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="nama@perusahaan.com"
                                className="h-12 border-2 border-black text-base px-4 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-black focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-none rounded-none transition-shadow placeholder:text-zinc-300"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password" className="text-sm font-bold text-black">
                                    Kata Sandi
                                </Label>
                                <Link href="/forgot-password" className="text-xs font-bold text-zinc-500 hover:text-black underline decoration-1 underline-offset-4 transition-colors">
                                    Lupa?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className="h-12 border-2 border-black text-base px-4 pr-11 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-black focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-none rounded-none transition-shadow placeholder:text-zinc-300"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
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
                                className="h-4 w-4 border-2 border-black rounded-none accent-black cursor-pointer"
                            />
                            <label htmlFor="remember" className="text-sm text-zinc-600 font-medium cursor-pointer select-none">
                                Ingat email saya
                            </label>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            className="w-full h-12 bg-black hover:bg-zinc-900 text-white font-bold text-base rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    Masuk
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t-2 border-zinc-100" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white px-3 text-xs font-bold uppercase tracking-widest text-zinc-300">atau</span>
                        </div>
                    </div>

                    {/* Google stub */}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 border-2 border-zinc-200 rounded-none text-sm font-semibold justify-center gap-2.5 shadow-none hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                        onClick={() => toast.info("Google Auth belum dikonfigurasi")}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Lanjutkan dengan Google
                    </Button>

                    {/* Sign up link */}
                    <p className="text-center text-sm text-zinc-500">
                        Belum punya akun?{" "}
                        <Link href="/signup" className="font-bold text-black underline decoration-2 underline-offset-4 hover:text-emerald-600 transition-colors">
                            Daftar
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
