/**
 * Awaitable confirm / ask dialogs, styled like the rest of Integra.
 *
 * Why: the browser's own `window.confirm()` / `prompt()` look like an error popup, show
 * the site address and "OK", block the whole page, and can't say clearly what will change.
 * For 40–60+ users a confirmation must name the action, say what changes, and offer a
 * button with a verb ("Hapus produk"), not "OK" (ui-ux-master skill, layers 5 and 8).
 *
 * Use:
 *   if (!(await confirmAction({ title: "Hapus produk ini?", description: "…", confirmLabel: "Hapus produk", destructive: true }))) return
 *   const reason = await askText({ title: "Tolak PO-0012?", label: "Alasan penolakan", required: true })
 *   if (reason === null) return   // cancelled
 *
 * `<ConfirmActionHost />` (components/ui/confirm-action-host.tsx) renders the dialog once
 * for the whole app. Without a mounted host (tests, odd layouts) the browser dialog is used,
 * so a caller is never left waiting forever.
 */

export interface ConfirmOptions {
    /** The question, naming the thing: "Hapus kategori Oli?" */
    title: string
    /** What will and will not change, in plain words. */
    description?: string
    /** A verb + object: "Hapus kategori". Default "Ya, lanjutkan". */
    confirmLabel?: string
    /** Default "Batal". */
    cancelLabel?: string
    /** Red confirm button for actions that delete or cannot be undone. */
    destructive?: boolean
}

export interface AskOptions extends ConfirmOptions {
    /** Field label shown above the input, e.g. "Alasan penolakan". */
    label?: string
    placeholder?: string
    defaultValue?: string
    /** Keep the confirm button disabled until something is typed. */
    required?: boolean
    /** "numeric" shows a number keypad on phones. */
    inputMode?: "text" | "numeric"
    /** A textarea instead of a one-line input (for reasons and notes). */
    multiline?: boolean
}

export interface ConfirmRequest extends AskOptions {
    id: number
    kind: "confirm" | "ask"
    confirmLabel: string
    cancelLabel: string
    destructive: boolean
}

type Resolver = (value: boolean | string | null) => void

let current: (ConfirmRequest & { resolve: Resolver }) | null = null
let nextId = 1
let hosts = 0
const listeners = new Set<() => void>()

function emit() {
    for (const listener of listeners) listener()
}

export function subscribeConfirm(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getConfirmSnapshot(): ConfirmRequest | null {
    return current
}

/** Called by the host on mount; returns the cleanup for unmount. */
export function registerConfirmHost(): () => void {
    hosts += 1
    return () => {
        hosts = Math.max(0, hosts - 1)
    }
}

/** Resolve the open dialog. A second call (e.g. the close event after a click) is ignored. */
export function settleConfirm(value: boolean | string | null): void {
    const request = current
    if (!request) return
    current = null
    emit()
    request.resolve(value)
}

function open(kind: "confirm" | "ask", options: AskOptions): Promise<boolean | string | null> {
    const cancelValue = kind === "ask" ? null : false
    if (hosts === 0) {
        if (typeof window === "undefined") return Promise.resolve(cancelValue)
        const text = [options.title, options.description].filter(Boolean).join("\n\n")
        // ui-lint-ignore: deliberate fallback when no host is mounted
        return Promise.resolve(kind === "ask" ? window.prompt(text, options.defaultValue ?? "") : window.confirm(text)) // ui-lint-ignore
    }
    return new Promise((resolve) => {
        // Only one dialog at a time: a new request cancels the one still open.
        if (current) settleConfirm(current.kind === "ask" ? null : false)
        current = {
            ...options,
            id: nextId++,
            kind,
            confirmLabel: options.confirmLabel ?? "Ya, lanjutkan",
            cancelLabel: options.cancelLabel ?? "Batal",
            destructive: options.destructive ?? false,
            resolve: resolve as Resolver,
        }
        emit()
    })
}

/** Ask the user to confirm. Resolves true on confirm, false on cancel / Esc / click outside. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
    return open("confirm", options) as Promise<boolean>
}

/** Ask for a short text (a reason, a number). Resolves the trimmed text, or null when cancelled. */
export function askText(options: AskOptions): Promise<string | null> {
    return open("ask", options).then((value) => (typeof value === "string" ? value.trim() : null))
}
