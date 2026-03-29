"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { usePaymentTerms } from "@/hooks/use-payment-terms"
import { useCurrencies } from "@/hooks/use-currencies"
import { SelectItem } from "@/components/ui/select"
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { createCustomerSchema, type CreateCustomerInput } from "@/lib/validations"
import { Loader2, User, Building2, CreditCard, Phone, Settings2, Check } from "lucide-react"
import { motion } from "framer-motion"
import { NB } from "@/lib/dialog-styles"
import { formatNpwp, getNpwpDigits, isValidNpwp } from "@/lib/npwp"
import {
  NBSection,
  NBInput,
  NBCurrencyInput,
  NBSelect,
  NBTextarea,
} from "@/components/ui/nb-dialog"
import { getNextCustomerCode, getCustomerCategories } from "@/lib/actions/sales"

/* ═══════════════════════════════════════════ */
/* HELPER FUNCTIONS                            */
/* ═══════════════════════════════════════════ */

/** Detect customer type from company name */
function detectCustomerType(name: string): "COMPANY" | "INDIVIDUAL" | null {
  if (!name || name.trim().length < 2) return null
  const upper = name.trim().toUpperCase()
  if (/\b(PT|CV|UD|YAYASAN|KOPERASI|FIRMA|FA|PD|BUMN|BUMD|PERSEROAN|PERSERO)\b/.test(upper)) {
    return "COMPANY"
  }
  // If it looks like a personal name (letters+spaces, no company prefix, >5 chars)
  if (name.trim().length > 5 && /^[a-zA-Z\s.']+$/.test(name.trim()) && name.includes(" ")) {
    return "INDIVIDUAL"
  }
  return null
}

/** Simple email format check */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Format phone with spaces on blur */
function formatPhoneOnBlur(raw: string): string {
  if (!raw) return ""
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 5) return raw
  // +62 / 62 prefix → international format
  if (digits.startsWith("62") && digits.length >= 10) {
    const rest = digits.slice(2)
    const parts = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7, 11)].filter(Boolean)
    return "+62 " + parts.join(" ")
  }
  // 0XX domestic mobile
  if (digits.startsWith("0") && digits.length >= 10) {
    const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(Boolean)
    return parts.join(" ")
  }
  return raw
}

// Indonesian provinces for dropdown
const INDONESIAN_PROVINCES = [
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "D.I. Yogyakarta",
  "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
  "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara",
  "Gorontalo", "Sulawesi Barat", "Sumatera Utara", "Sumatera Barat", "Riau",
  "Kepulauan Riau", "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung",
  "Bangka Belitung", "Maluku", "Maluku Utara", "Papua", "Papua Barat",
  "Papua Tengah", "Papua Pegunungan", "Papua Selatan", "Papua Barat Daya"
]

type CustomerCategoryOption = { id: string; code: string; name: string }

/* ═══════════════════════════════════════════ */
/* COMPONENT                                   */
/* ═══════════════════════════════════════════ */

interface CustomerFormProps {
  initialData?: Partial<CreateCustomerInput>
  onSubmit: (data: CreateCustomerInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  isEdit?: boolean
}

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false
}: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: paymentTermOptions = [] } = usePaymentTerms()
  const { data: currencies = [] } = useCurrencies()

  // ── Auto-code state ──
  const [autoCodeLoading, setAutoCodeLoading] = useState(!isEdit)
  const [autoCodeError, setAutoCodeError] = useState(false)

  // ── DB-backed categories ──
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryOption[]>([])

  // ── Load categories from DB ──
  useEffect(() => {
    let cancelled = false
    getCustomerCategories()
      .then((cats) => { if (!cancelled) setCustomerCategories(cats) })
      .catch(() => { /* silently fail — dropdown stays empty */ })
    return () => { cancelled = true }
  }, [])

  // ── Manual override tracking ──
  const typeManuallySetRef = useRef(isEdit)
  const termManuallySetRef = useRef(isEdit)

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      code: initialData?.code || "",
      name: initialData?.name || "",
      legalName: initialData?.legalName || "",
      customerType: initialData?.customerType || "COMPANY",
      categoryId: initialData?.categoryId || "",
      npwp: initialData?.npwp || "",
      nik: initialData?.nik || "",
      taxAddress: initialData?.taxAddress || "",
      isTaxable: initialData?.isTaxable ?? true,
      taxStatus: initialData?.taxStatus || "PKP",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      website: initialData?.website || "",
      creditLimit: initialData?.creditLimit || 0,
      creditTerm: initialData?.creditTerm || 30,
      paymentTerm: initialData?.paymentTerm || "NET_30",
      currency: initialData?.currency || "IDR",
      priceListId: initialData?.priceListId || "",
      salesPersonId: initialData?.salesPersonId || "",
      isActive: initialData?.isActive ?? true,
      isProspect: initialData?.isProspect ?? false,
    },
  })

  const { watch, setValue, getValues } = form
  const customerType = watch("customerType")
  const isTaxable = watch("isTaxable")
  const nameValue = watch("name")
  const creditTerm = watch("creditTerm")
  const emailValue = watch("email")
  const npwpValue = watch("npwp")

  // ── 1. Auto-generate customer code ──
  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    getNextCustomerCode()
      .then((code) => {
        if (!cancelled) {
          setValue("code", code)
          setAutoCodeLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutoCodeError(true)
          setAutoCodeLoading(false)
        }
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit])

  // ── 2. Name → customerType auto-detect ──
  const detectedType = detectCustomerType(nameValue)
  useEffect(() => {
    if (typeManuallySetRef.current || isEdit || !detectedType) return
    setValue("customerType", detectedType)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedType])

  // ── 5. isTaxable → taxStatus auto-set ──
  useEffect(() => {
    setValue("taxStatus", isTaxable ? "PKP" : "NON_PKP")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTaxable])

  // ── 9. creditTerm → paymentTerm auto-suggest ──
  useEffect(() => {
    if (termManuallySetRef.current || paymentTermOptions.length === 0) return
    if (creditTerm === 0) {
      const cod = paymentTermOptions.find((t: any) => t.code === "COD" || t.days === 0)
      if (cod) setValue("paymentTerm", cod.code as CreateCustomerInput["paymentTerm"])
      return
    }
    const matched = paymentTermOptions.find((t: any) => t.days === creditTerm)
    if (matched) setValue("paymentTerm", matched.code as CreateCustomerInput["paymentTerm"])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditTerm, paymentTermOptions])

  // ── Derived values ──
  const npwpDigits = getNpwpDigits(npwpValue)
  const emailValid = emailValue ? isValidEmail(emailValue) : null

  const handleSubmit = async (data: CreateCustomerInput) => {
    try {
      setIsSubmitting(true)
      await onSubmit(data)
      toast.success(isEdit ? "Pelanggan berhasil diperbarui!" : "Pelanggan berhasil dibuat!")
    } catch (error) {
      toast.error("Terjadi kesalahan. Silakan coba lagi.")
      console.error("Form submission error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider">
              {isEdit ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
            </h1>
            <p className="text-[11px] font-medium text-zinc-400 mt-0.5">
              {isEdit ? "Perbarui informasi pelanggan" : "Isi form di bawah untuk menambah pelanggan baru"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
              className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting ? "Menyimpan..." : isEdit ? "Perbarui" : "Simpan Pelanggan"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Main Content (2 cols) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* ═══ Informasi Dasar ═══ */}
            <NBSection icon={User} title="Informasi Dasar">
              <div className="grid gap-3 md:grid-cols-2">
                {/* 1. Kode Pelanggan — auto-generated */}
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    {autoCodeLoading && !isEdit ? (
                      <div>
                        <label className={NB.label}>Kode Pelanggan <span className={NB.labelRequired}>*</span></label>
                        <div className="h-8 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                      </div>
                    ) : autoCodeError && !isEdit ? (
                      <div>
                        <NBInput label="Kode Pelanggan" required value={field.value} onChange={field.onChange} placeholder="CUST001" />
                        <p className="text-[10px] font-medium text-amber-500 mt-0.5">Auto-generate gagal — input manual</p>
                      </div>
                    ) : (
                      <div>
                        <label className={NB.label}>Kode Pelanggan <span className={NB.labelRequired}>*</span></label>
                        <div className="h-8 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center px-3 text-sm font-mono font-bold text-zinc-600 dark:text-zinc-300">
                          {field.value || "..."}
                          {!isEdit && (
                            <span className="ml-auto text-[9px] font-bold text-orange-400 uppercase tracking-widest">Auto</span>
                          )}
                        </div>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                {/* 2. Tipe Pelanggan — auto-detect from name */}
                <FormField control={form.control} name="customerType" render={({ field }) => (
                  <FormItem>
                    <NBSelect
                      label="Tipe Pelanggan"
                      required
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        typeManuallySetRef.current = true
                      }}
                      options={[
                        { value: "INDIVIDUAL", label: "Perorangan" },
                        { value: "COMPANY", label: "Perusahaan" },
                        { value: "GOVERNMENT", label: "Pemerintah" },
                      ]}
                    />
                    {detectedType && !typeManuallySetRef.current && !isEdit && (
                      <p className="text-[10px] font-medium text-orange-500 mt-0.5">
                        Terdeteksi sebagai {detectedType === "COMPANY" ? "Perusahaan" : "Perorangan"}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <NBInput label="Nama Pelanggan" required value={field.value} onChange={field.onChange} placeholder="PT Teknologi Maju" />
                  <FormMessage />
                </FormItem>
              )} />

              {customerType === "COMPANY" && (
                <FormField control={form.control} name="legalName" render={({ field }) => (
                  <FormItem>
                    <NBInput label="Nama Legal" value={field.value || ""} onChange={field.onChange} placeholder="Nama legal perusahaan" />
                    <p className={NB.labelHint}>Jika berbeda dengan nama pelanggan</p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <NBSelect label="Kategori Pelanggan" value={field.value || ""} onValueChange={field.onChange} placeholder="Pilih kategori">
                    {customerCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </NBSelect>
                  <FormMessage />
                </FormItem>
              )} />
            </NBSection>

            {/* ═══ Informasi Pajak ═══ */}
            <NBSection icon={Building2} title="Informasi Pajak">
              {/* 4. Kena Pajak toggle — auto-set by NPWP */}
              <FormField control={form.control} name="isTaxable" render={({ field }) => (
                <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Kena Pajak</span>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 block">Apakah pelanggan ini dikenakan pajak?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`${NB.toggle} ${field.value ? NB.toggleActive : NB.toggleInactive}`}
                  >
                    <motion.span
                      layout
                      transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                      className={`${NB.toggleThumb} ${field.value ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </div>
              )} />

              {isTaxable && (
                <>
                  {/* 5. Status Pajak — auto-set from isTaxable */}
                  <FormField control={form.control} name="taxStatus" render={({ field }) => (
                    <FormItem>
                      <NBSelect
                        label="Status Pajak"
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={[
                          { value: "PKP", label: "PKP (Pengusaha Kena Pajak)" },
                          { value: "NON_PKP", label: "Non PKP" },
                          { value: "EXEMPT", label: "Bebas Pajak" },
                        ]}
                      />
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-3 md:grid-cols-2">
                    {/* 3. NPWP — auto-format + triggers isTaxable */}
                    {customerType !== "INDIVIDUAL" && (
                      <FormField control={form.control} name="npwp" render={({ field }) => (
                        <FormItem>
                          <NBInput
                            label="NPWP"
                            value={formatNpwp(field.value || "")}
                            onChange={(v) => {
                              const digits = getNpwpDigits(v).slice(0, 16)
                              field.onChange(formatNpwp(digits))
                              // 4. Auto-check isTaxable when NPWP is valid
                              if (isValidNpwp(digits)) setValue("isTaxable", true)
                              else if (digits.length === 0) setValue("isTaxable", false)
                            }}
                            placeholder="01.234.567.8-901.0000"
                          />
                          {npwpDigits.length > 0 && !isValidNpwp(npwpValue) && (
                            <p className="text-[10px] text-red-500 font-bold mt-0.5">
                              NPWP harus 15 atau 16 digit ({npwpDigits.length}/16)
                            </p>
                          )}
                          {isValidNpwp(npwpValue) && (
                            <p className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">
                              <Check className="h-3 w-3" /> NPWP valid
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    {customerType === "INDIVIDUAL" && (
                      <FormField control={form.control} name="nik" render={({ field }) => (
                        <FormItem>
                          <NBInput label="NIK" value={field.value || ""} onChange={field.onChange} placeholder="3201234567890123" />
                          <p className={NB.labelHint}>Nomor Induk Kependudukan (16 digit)</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>

                  <FormField control={form.control} name="taxAddress" render={({ field }) => (
                    <FormItem>
                      <NBTextarea label="Alamat Pajak" value={field.value || ""} onChange={field.onChange} placeholder="Alamat pajak terdaftar..." rows={3} />
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
            </NBSection>

            {/* ═══ Informasi Kontak ═══ */}
            <NBSection icon={Phone} title="Informasi Kontak">
              <div className="grid gap-3 md:grid-cols-2">
                {/* 13. Phone — auto-format on blur */}
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <div onBlur={() => {
                      const formatted = formatPhoneOnBlur(field.value || "")
                      if (formatted !== field.value) field.onChange(formatted)
                    }}>
                      <NBInput label="Nomor Telepon" value={field.value || ""} onChange={field.onChange} placeholder="0812 3456 7890" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* 11. Email — real-time validation */}
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <NBInput label="Email" value={field.value || ""} onChange={field.onChange} placeholder="info@perusahaan.com" />
                    {emailValue && emailValid && (
                      <p className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Format valid
                      </p>
                    )}
                    {emailValue && !emailValid && (
                      <p className="text-[10px] text-red-500 font-bold mt-0.5">Format email tidak valid</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* 12. Website — auto-prepend https:// on blur */}
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <div onBlur={() => {
                    const val = (field.value || "").trim()
                    if (val && !val.startsWith("http://") && !val.startsWith("https://")) {
                      field.onChange("https://" + val)
                    }
                  }}>
                    <NBInput label="Website" value={field.value || ""} onChange={field.onChange} placeholder="perusahaan.com" />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <NBSelect label="Mata Uang" value={field.value || "IDR"} onValueChange={field.onChange}>
                    <SelectItem value="IDR">IDR - Rupiah Indonesia</SelectItem>
                    {currencies.filter((c: any) => c.code !== "IDR").map((c: any) => (
                      <SelectItem key={c.id} value={c.code}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </NBSelect>
                  <FormMessage />
                </FormItem>
              )} />
            </NBSection>
          </div>

          {/* ── Sidebar (1 col) ── */}
          <div className="space-y-4">

            {/* ═══ Manajemen Kredit ═══ */}
            <NBSection icon={CreditCard} title="Manajemen Kredit">
              {/* 7. Limit Kredit — emerald glow when >0 */}
              <FormField control={form.control} name="creditLimit" render={({ field }) => (
                <FormItem>
                  <NBCurrencyInput
                    label="Limit Kredit"
                    value={field.value ? String(field.value) : ""}
                    onChange={(v) => field.onChange(Number(v) || 0)}
                  />
                  <FormMessage />
                </FormItem>
              )} />

              {/* 8. Term Kredit — default 30 days */}
              <FormField control={form.control} name="creditTerm" render={({ field }) => (
                <FormItem>
                  <NBInput
                    label="Term Kredit (Hari)"
                    type="number"
                    value={field.value ? String(field.value) : ""}
                    onChange={(v) => {
                      const num = Number(v) || 0
                      field.onChange(num)
                    }}
                    placeholder="30"
                  />
                  <FormMessage />
                </FormItem>
              )} />

              {/* 9. Term Pembayaran — auto-suggest from creditTerm */}
              <FormField control={form.control} name="paymentTerm" render={({ field }) => (
                <FormItem>
                  <NBSelect
                    label="Term Pembayaran"
                    value={field.value || ""}
                    onValueChange={(v) => {
                      field.onChange(v)
                      termManuallySetRef.current = true
                    }}
                    placeholder="Pilih term"
                  >
                    {paymentTermOptions.map((t: any) => (
                      <SelectItem key={t.id} value={t.code}>{t.name}</SelectItem>
                    ))}
                  </NBSelect>
                  <FormMessage />
                </FormItem>
              )} />
            </NBSection>

            {/* ═══ Status & Pengaturan ═══ */}
            <NBSection icon={Settings2} title="Status & Pengaturan">
              {/* 10. Default Aktif */}
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Status Aktif</span>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 block">Pelanggan dapat bertransaksi</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`${NB.toggle} ${field.value ? NB.toggleActive : NB.toggleInactive}`}
                  >
                    <motion.span
                      layout
                      transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                      className={`${NB.toggleThumb} ${field.value ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </div>
              )} />

              <FormField control={form.control} name="isProspect" render={({ field }) => (
                <div className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Prospek</span>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 block">Tandai sebagai calon pelanggan</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`${NB.toggle} ${field.value ? NB.toggleActive : NB.toggleInactive}`}
                  >
                    <motion.span
                      layout
                      transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                      className={`${NB.toggleThumb} ${field.value ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </div>
              )} />
            </NBSection>
          </div>
        </div>
      </form>
    </Form>
  )
}
