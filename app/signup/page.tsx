"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function SignUpPage() {
    const router = useRouter()
    const supabase = createClient()

    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMode, setSuccessMode] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password || !fullName || !role) return

        setIsLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: fullName,
                        role: role
                    }
                }
            })

            if (error) {
                setError(error.message)
                toast.error("Registrasi gagal: " + error.message)
                return
            }

            setSuccessMode(true)
            toast.success("Registrasi berhasil! Silakan cek email Anda.")
        } catch (err) {
            console.error("SignUp Error:", err)
            setError("Terjadi kesalahan sistem")
        } finally {
            setIsLoading(false)
        }
    }

    if (successMode) {
        return (
            <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-[400px] text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <MailIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-serif font-medium">Cek Email Anda</h1>
                    <p className="text-zinc-500">
                        Kami telah mengirimkan link verifikasi ke <strong>{email}</strong>.
                        Silakan klik link tersebut untuk mengaktifkan akun Anda.
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
                    <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-black text-center">
                        Buat Akun
                    </h1>
                    <p className="text-zinc-500 text-sm md:text-lg text-center">
                        Bergabung dengan Tim ERP
                    </p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-6 mt-8">
                    {/* Error Alert */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label htmlFor="fullname" className="text-base font-bold">Nama Lengkap</Label>
                        <Input
                            id="fullname"
                            placeholder="Contoh: Budi Santoso"
                            className="h-12 border-2 border-black rounded-xl text-base px-4 focus-visible:ring-0 focus-visible:border-black shadow-none"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

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

                    {/* Role Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="role" className="text-base font-bold">Peran / Jabatan</Label>
                        <select
                            id="role"
                            className="w-full h-12 border-2 border-black rounded-xl text-base px-4 focus:outline-none focus:ring-0 shadow-none bg-white"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            <option value="" disabled>Pilih Peran Anda</option>
                            <option value="ROLE_CEO">Owner / CEO</option>
                            <option value="ROLE_MANAGER">Operations Manager</option>
                            <option value="ROLE_ACCOUNTANT">Finance & Accounting</option>
                            <option value="ROLE_SALES">Sales & Marketing</option>
                            <option value="ROLE_STAFF">Staff Operasional</option>
                        </select>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-base font-bold">Kata Sandi</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Minimal 6 karakter"
                                className="h-12 border-2 border-black rounded-xl text-base px-4 pr-10 focus-visible:ring-0 focus-visible:border-black shadow-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
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

                    {/* Sign Up Button */}
                    <Button
                        type="submit"
                        className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-bold text-lg rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? "Mendaftar..." : "Daftar Sekarang"}
                    </Button>
                </form>

                <div className="text-center">
                    <p className="font-medium">
                        Sudah punya akun? <Link href="/login" className="font-bold underline decoration-2 underline-offset-4">Masuk</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

function MailIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    )
}
