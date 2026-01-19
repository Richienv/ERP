"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react"
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

            // Check role and redirect accordingly
            const { data: { user } } = await supabase.auth.getUser()
            const role = user?.user_metadata?.role as string

            toast.success("Login berhasil!")
            router.refresh()

            // Dynamic Redirect
            switch (role) {
                case "ROLE_CEO":
                    router.push("/dashboard")
                    break
                case "ROLE_MANAGER":
                    router.push("/manager")
                    break
                case "ROLE_ACCOUNTANT":
                    router.push("/finance")
                    break
                case "ROLE_SALES":
                    router.push("/sales")
                    break
                case "ROLE_STAFF":
                    router.push("/staff")
                    break
                default:
                    router.push("/dashboard")
            }
        } catch (err) {
            console.error("Login Error:", err)
            setError("Terjadi kesalahan sistem")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[350px] md:max-w-[400px] space-y-6 md:space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-black">
                        Masuk
                    </h1>
                    <p className="text-zinc-500 text-sm md:text-lg">
                        Sistem ERP Cerdas Era AI
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6 mt-8">
                    {/* Error Alert */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-base font-bold">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="nama@perusahaan.com"
                            className="h-12 border-2 border-black rounded-xl text-base px-4 focus-visible:ring-0 focus-visible:border-black shadow-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="password" className="text-base font-bold">Kata Sandi</Label>
                            <Link href="/forgot-password">
                                <span className="text-sm font-bold underline decoration-2 underline-offset-4 text-black hover:opacity-70">
                                    Lupa Password?
                                </span>
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Masukkan password"
                                className="h-12 border-2 border-black rounded-xl text-base px-4 pr-10 focus-visible:ring-0 focus-visible:border-black shadow-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-black"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Sign In Button */}
                    <Button
                        type="submit"
                        className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-bold text-lg rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? "Memproses..." : "Masuk"}
                    </Button>
                </form>

                <div className="text-center space-y-4">
                    <p className="font-medium">
                        Belum punya akun? <Link href="/signup" className="font-bold underline decoration-2 underline-offset-4">Daftar</Link>
                    </p>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-zinc-500 font-medium">atau</span>
                        </div>
                    </div>

                    {/* Social Buttons Stub */}
                    <div className="space-y-3">
                        {/* Removed Google/Passkey specifically unless requested, to keep clean. 
                             Or keep Google as placeholder action? 
                             kept Google but made it functional-ish or toast stub 
                         */}
                        <Button
                            variant="outline"
                            className="w-full h-12 border-2 border-zinc-100 rounded-xl hover:bg-zinc-50 hover:border-zinc-200 text-base font-semibold justify-center gap-3 shadow-none"
                            onClick={() => toast.info("Google Auth belum dikonfigurasi")}
                        >
                            <span className="text-red-500 font-bold text-xl">G</span>
                            Lanjutkan dengan Google
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
