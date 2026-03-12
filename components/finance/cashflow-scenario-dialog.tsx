"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"

interface ScenarioDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (name: string) => void
    initialName?: string
    mode: "create" | "rename"
}

export function CashflowScenarioDialog({ open, onOpenChange, onSave, initialName = "", mode }: ScenarioDialogProps) {
    const [name, setName] = useState(initialName)

    useEffect(() => {
        if (open) setName(initialName)
    }, [open, initialName])

    const handleSave = () => {
        const trimmed = name.trim()
        if (!trimmed) return
        onSave(trimmed)
        setName("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        {mode === "create" ? "Buat Skenario Baru" : "Ubah Nama Skenario"}
                    </DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div>
                        <label className={NB.label}>Nama Skenario</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            placeholder="Optimis..."
                            className={NB.input}
                            autoFocus
                        />
                    </div>
                    <div className={NB.footer}>
                        <Button className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button className={NB.submitBtn} onClick={handleSave} disabled={!name.trim()}>
                            {mode === "create" ? "Buat" : "Simpan"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
