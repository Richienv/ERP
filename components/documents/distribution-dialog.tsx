"use client"
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
    open: boolean
    onClose: () => void
    onSubmit: (recipientEmail: string, notes: string) => Promise<void> | void
}

export function DistributionDialog({ open, onClose, onSubmit }: Props) {
    const [email, setEmail] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    function isValidEmail(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    }

    async function handleSubmit() {
        if (!isValidEmail(email)) return
        setSubmitting(true)
        try {
            await onSubmit(email, notes)
            setEmail('')
            setNotes('')
            onClose()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kirim PDF via Email</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label>Email Penerima</Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vendor@example.com"
                        />
                    </div>
                    <div>
                        <Label>Catatan (opsional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Mohon konfirmasi penerimaan..."
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValidEmail(email) || submitting}>
                        {submitting ? 'Mengirim...' : 'Kirim'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
