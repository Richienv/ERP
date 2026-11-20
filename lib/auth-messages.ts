/**
 * Plain Indonesian for sign-in errors. Supabase returns English sentences such as
 * "Invalid login credentials"; users (40–60+) need what happened and what to do next.
 */
export function loginErrorMessage(raw: string | null | undefined): string {
    const msg = (raw ?? "").toLowerCase()
    if (msg.includes("invalid login credentials") || msg.includes("invalid email or password")) {
        return "Email atau kata sandi salah. Periksa lagi, atau pilih “Lupa kata sandi?” untuk membuat yang baru."
    }
    if (msg.includes("email not confirmed")) {
        return "Email ini belum dikonfirmasi. Buka email dari sistem dan klik tautan konfirmasinya, lalu coba masuk lagi."
    }
    if (msg.includes("too many requests") || msg.includes("rate limit")) {
        return "Terlalu banyak percobaan masuk. Tunggu sekitar 1 menit, lalu coba lagi."
    }
    if (msg.includes("user banned") || msg.includes("banned")) {
        return "Akun ini sedang dinonaktifkan. Hubungi admin perusahaan untuk mengaktifkannya."
    }
    if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch")) {
        return "Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi."
    }
    return "Belum bisa masuk. Coba lagi sebentar lagi; kalau tetap gagal, hubungi admin perusahaan."
}
