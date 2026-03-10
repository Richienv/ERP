"use client"

import { useState, useCallback } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { IconLoader2 } from "@tabler/icons-react"
import { Textarea } from "@/components/ui/textarea"

interface ConfirmDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: (reason?: string) => void | Promise<void>
  withReason?: boolean
  reasonPlaceholder?: string
  reasonRequired?: boolean
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "default",
  onConfirm,
  withReason = false,
  reasonPlaceholder = "Alasan...",
  reasonRequired = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState("")

  const handleConfirm = useCallback(async () => {
    if (withReason && reasonRequired && !reason.trim()) return
    try {
      setLoading(true)
      await onConfirm(withReason ? reason : undefined)
      setOpen(false)
      setReason("")
    } catch {
      // Error handling done by caller via toast
    } finally {
      setLoading(false)
    }
  }, [onConfirm, withReason, reason, reasonRequired])

  const isDestructive = variant === "destructive"

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v) }}>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {withReason && (
          <div className="py-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="rounded-none border-2 border-zinc-300 focus:border-black resize-none placeholder:text-zinc-300"
              rows={3}
              disabled={loading}
            />
            {reasonRequired && !reason.trim() && (
              <p className="text-xs text-red-500 mt-1">Alasan wajib diisi</p>
            )}
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="rounded-none border-2 border-zinc-300 hover:bg-zinc-50 font-medium"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={loading || (withReason && reasonRequired && !reason.trim())}
            className={`rounded-none border-2 font-semibold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              isDestructive
                ? "border-red-700 bg-red-600 text-white hover:bg-red-700"
                : "border-black bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {loading && <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
