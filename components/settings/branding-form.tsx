"use client"
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { LogoUploader } from './logo-uploader'

export function BrandingForm() {
    const [form, setForm] = useState({
        tenantName: '',
        companyAddress: '',
        companyNpwp: '',
        companyEmail: '',
        companyPhone: '',
        primaryColor: '#18181b',
        logoStorageKey: '',
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/settings/branding')
            .then(r => r.json())
            .then(({ data }) => { if (data) setForm(f => ({ ...f, ...data })); setLoading(false) })
    }, [])

    async function onSave() {
        const res = await fetch('/api/settings/branding', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        if (!res.ok) { toast.error('Gagal menyimpan'); return }
        toast.success('Branding disimpan')
    }

    if (loading) return <div className="text-sm text-zinc-500">Memuat...</div>

    return (
        <div className="space-y-4 max-w-xl">
            <div>
                <Label>Nama Perusahaan</Label>
                <Input value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} />
            </div>
            <div>
                <Label>Alamat</Label>
                <Input value={form.companyAddress ?? ''} onChange={e => setForm({ ...form, companyAddress: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>NPWP</Label>
                    <Input value={form.companyNpwp ?? ''} onChange={e => setForm({ ...form, companyNpwp: e.target.value })} />
                </div>
                <div>
                    <Label>Telepon</Label>
                    <Input value={form.companyPhone ?? ''} onChange={e => setForm({ ...form, companyPhone: e.target.value })} />
                </div>
            </div>
            <div>
                <Label>Email</Label>
                <Input value={form.companyEmail ?? ''} onChange={e => setForm({ ...form, companyEmail: e.target.value })} />
            </div>
            <div>
                <Label>Logo Perusahaan</Label>
                <LogoUploader
                    currentKey={form.logoStorageKey}
                    onChange={(newKey) => setForm({ ...form, logoStorageKey: newKey ?? '' })}
                />
            </div>
            <div>
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2">
                    <Input type="color" value={form.primaryColor ?? '#18181b'} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="w-16 h-9 p-1" />
                    <Input value={form.primaryColor ?? ''} onChange={e => setForm({ ...form, primaryColor: e.target.value })} placeholder="#18181b" className="flex-1" />
                </div>
            </div>
            <Button onClick={onSave}>Simpan Branding</Button>
        </div>
    )
}
