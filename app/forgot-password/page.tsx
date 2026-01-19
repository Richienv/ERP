"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
    const supabase = createClient()

    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMode, setSuccessMode] = useState(false)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/account/reset-password`,
            })

            if (error) {
                setError(error.message)
                toast.error("Gagal: " + error.message)
                return
            }

            setSuccessMode(true)
            toast.success("Link reset password telah dikirim.")
        } catch (err) {
            console.error("Reset Error:", err)
            setError("Terjadi kesalahan sistem")
        } finally {
            setIsLoading(false)
        }
    }

    if (successMode) {
        return (
            <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-[400px] text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Mail className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-serif font-medium">Cek Email Anda</h1>
                    <p className="text-zinc-500">
                        Instruksi reset password telah dikirim ke <strong>{email}</strong>.
                    </p>
                    <Link href="/login">
                        <Button className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-bold rounded-xl mt-4">
                            Kembali ke Login
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[350px] md:max-w-[400px] space-y-6 md:space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <Link href="/login" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-black mb-4">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight text-black text-center">
                        Lupa Password
                    </h1>
                    <p className="text-zinc-500 text-sm md:text-base text-center">
                        Masukkan email Anda untuk reset password
                    </p>
                </div>

                <form onSubmit={handleReset} className="space-y-6 mt-8">
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

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-bold text-lg rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? "Memproses..." : "Kirim Link Reset"}
                    </Button>
                </form>
            </div>
        </div>
    )
}
