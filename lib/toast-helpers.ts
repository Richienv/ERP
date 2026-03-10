import { toast } from "sonner"

/**
 * Show a success toast with an Undo action button.
 *
 * @example
 * toastWithUndo("Produk dihapus", async () => {
 *   await restoreProduct(id)
 * })
 */
export function toastWithUndo(
  message: string,
  onUndo: () => void | Promise<void>,
  options?: { description?: string; duration?: number }
) {
  toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 6000,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await onUndo()
          toast.success("Berhasil dibatalkan")
        } catch {
          toast.error("Gagal membatalkan")
        }
      },
    },
  })
}

/**
 * Show an error toast with a Retry action button.
 *
 * @example
 * toastWithRetry("Gagal menyimpan data", async () => {
 *   await saveProduct(data)
 * })
 */
export function toastWithRetry(
  message: string,
  onRetry: () => void | Promise<void>,
  options?: { description?: string; duration?: number }
) {
  toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 8000,
    action: {
      label: "Coba Lagi",
      onClick: async () => {
        try {
          await onRetry()
          toast.success("Berhasil!")
        } catch {
          toast.error("Masih gagal. Silakan coba lagi nanti.")
        }
      },
    },
  })
}

/**
 * Show a loading toast that resolves to success/error.
 * Same as toast.promise but with Indonesian defaults.
 *
 * @example
 * toastPromise(createInvoice(data), {
 *   loading: "Membuat invoice...",
 *   success: "Invoice berhasil dibuat",
 *   error: "Gagal membuat invoice",
 * })
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }
) {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  })
}

/**
 * Show a destructive action toast with countdown.
 * Useful for soft-deletes: action happens after delay unless user clicks Undo.
 *
 * @example
 * toastDestructive("Produk akan dihapus", async () => {
 *   await deleteProduct(id)
 * })
 */
export function toastDestructive(
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: { undoLabel?: string; duration?: number }
) {
  let cancelled = false

  toast(message, {
    duration: options?.duration ?? 5000,
    action: {
      label: options?.undoLabel ?? "Batalkan",
      onClick: () => {
        cancelled = true
        toast.success("Dibatalkan")
      },
    },
    onDismiss: async () => {
      if (cancelled) return
      try {
        await onConfirm()
      } catch {
        toast.error("Terjadi kesalahan")
      }
    },
    onAutoClose: async () => {
      if (cancelled) return
      try {
        await onConfirm()
      } catch {
        toast.error("Terjadi kesalahan")
      }
    },
  })
}
