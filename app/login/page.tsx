"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, UserRole } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Factory, Lock, User, Key, Mail, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
    const { login } = useAuth()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState<UserRole | "">("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        if (!username || !role) return

        setIsLoading(true)
        // Simulate network delay
        setTimeout(() => {
            login(username, role as UserRole)
            setIsLoading(false)
        }, 800)
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
                    {/* Username */}
                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-base font-bold">Nama Pengguna</Label>
                        <Input
                            id="username"
                            placeholder="Masukkan nama Anda"
                            className="h-12 border-2 border-black rounded-xl text-base px-4 focus-visible:ring-0 focus-visible:border-black shadow-none"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="password" className="text-base font-bold">Kata Sandi</Label>
                            <button type="button" className="text-sm font-bold underline decoration-2 underline-offset-4 text-black hover:opacity-70">
                                Lupa Password?
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Masukkan password"
                                className="h-12 border-2 border-black rounded-xl text-base px-4 pr-10 focus-visible:ring-0 focus-visible:border-black shadow-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            // disabled // Removing disabled for better demo feel
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

                    {/* Role Selection (Kept for functionality, styled to match) */}
                    <div className="space-y-2">
                        <Label className="text-base font-bold">Pilih Jabatan</Label>
                        <Select onValueChange={(val) => setRole(val as UserRole)} required>
                            <SelectTrigger className="h-12 border-2 border-black rounded-xl text-base px-4 focus:ring-0 focus:border-black shadow-none">
                                <SelectValue placeholder="Pilih peran departemen Anda" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black rounded-xl shadow-none">
                                <SelectGroup>
                                    <SelectLabel>Pilih Peran</SelectLabel>
                                    <SelectItem value="ROLE_CEO">Pemilik / CEO</SelectItem>
                                    <SelectItem value="ROLE_MANAGER">Manajer Operasional</SelectItem>
                                    <SelectItem value="ROLE_ACCOUNTANT">Akuntan & Keuangan</SelectItem>
                                    <SelectItem value="ROLE_STAFF">Staf</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
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
                        Belum punya akun? <a href="#" className="font-bold underline decoration-2 underline-offset-4">Daftar</a>
                    </p>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-zinc-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-zinc-500 font-medium">atau</span>
                        </div>
                    </div>

                    {/* Social Buttons */}
                    <div className="space-y-3">
                        <Button variant="outline" className="w-full h-12 border-2 border-zinc-100 rounded-xl hover:bg-zinc-50 hover:border-zinc-200 text-base font-semibold justify-center gap-3 shadow-none">
                            <span className="text-red-500 font-bold text-xl">G</span>
                            Lanjutkan dengan Google
                        </Button>
                        <Button variant="outline" className="w-full h-12 border-2 border-zinc-100 rounded-xl hover:bg-zinc-50 hover:border-zinc-200 text-base font-semibold justify-center gap-3 shadow-none">
                            <Key className="w-5 h-5" />
                            Gunakan Kunci Akses ERP
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
