"use client"

import { useState, useEffect } from "react"
import { FileText } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBInput,
} from "@/components/ui/nb-dialog"

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
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader
                icon={FileText}
                title={mode === "create" ? "Buat Skenario Baru" : "Ubah Nama Skenario"}
            />
            <NBDialogBody>
                <NBInput
                    label="Nama Skenario"
                    required
                    value={name}
                    onChange={setName}
                    placeholder="Optimis..."
                />
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSave}
                submitLabel={mode === "create" ? "Buat" : "Simpan"}
                disabled={!name.trim()}
            />
        </NBDialog>
    )
}
