"use client"
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'
import { LogoUploader } from './logo-uploader'
import { NB } from '@/lib/dialog-styles'
import { cn } from '@/lib/utils'

const DEFAULT_BRAND_COLOR = '#18181b'

export function BrandingForm() {
    const [form, setForm] = useState({
        tenantName: '',
        companyAddress: '',
        companyNpwp: '',
        companyEmail: '',
        companyPhone: '',
        primaryColor: DEFAULT_BRAND_COLOR,
        logoStorageKey: '',
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savedAt, setSavedAt] = useState<Date | null>(null)

    useEffect(() => {
        fetch('/api/settings/branding')
            .then(r => r.json())
            .then(({ data }) => {
                if (data) {
                    setForm(f => ({
                        ...f,
                        tenantName: data.tenantName ?? '',
                        companyAddress: data.companyAddress ?? '',
                        companyNpwp: data.companyNpwp ?? '',
                        companyEmail: data.companyEmail ?? '',
                        companyPhone: data.companyPhone ?? '',
                        primaryColor: data.primaryColor ?? DEFAULT_BRAND_COLOR,
                        logoStorageKey: data.logoStorageKey ?? '',
                    }))
                }
                setLoading(false)
            })
            .catch(() => {
                toast.error('Gagal memuat branding')
                setLoading(false)
            })
    }, [])

    async function onSave() {
        setSaving(true)
        try {
            const res = await fetch('/api/settings/branding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    // never send empty strings — Prisma update treats empty as "set to ''"
                    // which is fine, but cleaner to omit empties:
                    logoStorageKey: form.logoStorageKey || null,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.detail ? `${json.error}: ${json.detail}` : (json.error || 'Gagal menyimpan'))
                return
            }
            setSavedAt(new Date())
            toast.success('Branding disimpan')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Memuat branding...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Two-column grid: form on left, preview on right */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                {/* LEFT: form fields */}
                <div className="space-y-4">
                    <div>
                        <label className={NB.label}>Nama Perusahaan <span className={NB.labelRequired}>*</span></label>
                        <Input
                            value={form.tenantName}
                            onChange={e => setForm({ ...form, tenantName: e.target.value })}
                            placeholder="PT Contoh Indonesia"
                            className={cn(NB.input, form.tenantName ? NB.inputActive : NB.inputEmpty)}
                        />
                    </div>

                    <div>
                        <label className={NB.label}>Alamat</label>
                        <Input
                            value={form.companyAddress}
                            onChange={e => setForm({ ...form, companyAddress: e.target.value })}
                            placeholder="Jl. Sudirman No. 1, Jakarta"
                            className={cn(NB.input, form.companyAddress ? NB.inputActive : NB.inputEmpty)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={NB.label}>NPWP</label>
                            <Input
                                value={form.companyNpwp}
                                onChange={e => setForm({ ...form, companyNpwp: e.target.value })}
                                placeholder="01.234.567.8-901.000"
                                className={cn(NB.inputMono, form.companyNpwp ? NB.inputActive : NB.inputEmpty)}
                            />
                            <span className={NB.labelHint}>15 atau 16 digit (NIK-based)</span>
                        </div>
                        <div>
                            <label className={NB.label}>Telepon</label>
                            <Input
                                value={form.companyPhone}
                                onChange={e => setForm({ ...form, companyPhone: e.target.value })}
                                placeholder="+62 21 1234567"
                                className={cn(NB.input, form.companyPhone ? NB.inputActive : NB.inputEmpty)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={NB.label}>Email</label>
                        <Input
                            type="email"
                            value={form.companyEmail}
                            onChange={e => setForm({ ...form, companyEmail: e.target.value })}
                            placeholder="info@perusahaan.id"
                            className={cn(NB.input, form.companyEmail ? NB.inputActive : NB.inputEmpty)}
                        />
                    </div>

                    <div>
                        <label className={NB.label}>Logo Perusahaan</label>
                        <LogoUploader
                            currentKey={form.logoStorageKey}
                            onChange={(newKey) => setForm({ ...form, logoStorageKey: newKey ?? '' })}
                        />
                    </div>

                    <div>
                        <label className={NB.label}>Brand Color</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={form.primaryColor || DEFAULT_BRAND_COLOR}
                                onChange={e => setForm({ ...form, primaryColor: e.target.value })}
                                className="w-12 h-8 p-0.5 border-2 border-black rounded-none cursor-pointer"
                            />
                            <Input
                                value={form.primaryColor}
                                onChange={e => setForm({ ...form, primaryColor: e.target.value })}
                                placeholder={DEFAULT_BRAND_COLOR}
                                className={cn(NB.inputMono, 'flex-1', form.primaryColor !== DEFAULT_BRAND_COLOR && form.primaryColor ? NB.inputActive : NB.inputEmpty)}
                            />
                        </div>
                        <span className={NB.labelHint}>Hex color, dipakai di header semua dokumen PDF</span>
                    </div>
                </div>

                {/* RIGHT: live PDF header preview */}
                <div className="space-y-2">
                    <span className={NB.label}>Preview Header PDF</span>
                    <div className="border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div
                            className="border-b-2 pb-2 mb-2"
                            style={{ borderColor: form.primaryColor || DEFAULT_BRAND_COLOR }}
                        >
                            <div
                                className="font-black text-base"
                                style={{ color: form.primaryColor || DEFAULT_BRAND_COLOR }}
                            >
                                {form.tenantName || 'PT Contoh Indonesia'}
                            </div>
                            {form.companyAddress && (
                                <div className="text-[10px] text-zinc-500 mt-0.5">{form.companyAddress}</div>
                            )}
                            {form.companyNpwp && (
                                <div className="text-[10px] text-zinc-500 font-mono">NPWP: {form.companyNpwp}</div>
                            )}
                        </div>
                        <div className="text-[10px] text-zinc-400 italic">Body dokumen tampil di sini...</div>
                        <div className="text-[8px] text-zinc-400 text-center mt-6 pt-2 border-t border-zinc-200">
                            {form.tenantName || 'PT Contoh Indonesia'}
                            {form.companyEmail && ` • ${form.companyEmail}`}
                            {form.companyPhone && ` • ${form.companyPhone}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-between border-t-2 border-black pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {savedAt
                        ? `Tersimpan terakhir: ${savedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Belum disimpan'}
                </div>
                <Button onClick={onSave} disabled={saving} className={NB.submitBtn}>
                    {saving ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Menyimpan...</>
                    ) : (
                        <><Save className="h-3.5 w-3.5 mr-2" /> Simpan Branding</>
                    )}
                </Button>
            </div>
        </div>
    )
}
