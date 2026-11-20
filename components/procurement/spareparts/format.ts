const SYMBOL: Record<string, string> = { IDR: "Rp", CNY: "¥", USD: "$" }

/** Amount in its own currency: Rp 10.941.825 · ¥88.650 · $1.200,50 (Indonesian grouping everywhere). */
export function money(amount: number, currency = "IDR"): string {
    const decimals = currency === "IDR" ? 0 : Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2
    const n = new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount || 0)
    const sym = SYMBOL[currency] ?? `${currency} `
    return currency === "IDR" ? `${sym} ${n}` : `${sym}${n}`
}

/** Short rupiah for tight spots: Rp 220,7 jt · Rp 1,2 M. */
export function rupiahShort(amount: number): string {
    const abs = Math.abs(amount)
    const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v)
    if (abs >= 1e9) return `Rp ${fmt(amount / 1e9)} M`
    if (abs >= 1e6) return `Rp ${fmt(amount / 1e6)} jt`
    if (abs >= 1e3) return `Rp ${fmt(amount / 1e3)} rb`
    return `Rp ${fmt(amount)}`
}

export function shortDate(iso: string | null | undefined): string {
    if (!iso) return "—"
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso))
}

export function todayIso(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function ms(n: number): string {
    return n < 10 ? `${n.toFixed(1)} ms` : `${Math.round(n)} ms`
}
