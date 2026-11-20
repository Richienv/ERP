"use client"

import * as React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
    getConfirmSnapshot,
    registerConfirmHost,
    settleConfirm,
    subscribeConfirm,
} from "@/lib/confirm-store"

export { confirmAction, askText } from "@/lib/confirm-store"

/**
 * Renders the one confirm / ask dialog for the whole app (mounted in GlobalLayout).
 * Title names the action, the description says what changes, the button is a verb.
 */
export function ConfirmActionHost() {
    const request = React.useSyncExternalStore(subscribeConfirm, getConfirmSnapshot, () => null)
    const [text, setText] = React.useState("")

    React.useEffect(() => registerConfirmHost(), [])
    React.useEffect(() => {
        setText(request?.defaultValue ?? "")
    }, [request?.id, request?.defaultValue])

    const isAsk = request?.kind === "ask"
    const cannotConfirm = isAsk && !!request?.required && !text.trim()

    const submit = () => {
        if (!request || cannotConfirm) return
        settleConfirm(isAsk ? text : true)
    }

    return (
        <AlertDialog
            open={!!request}
            onOpenChange={(open) => {
                if (!open) settleConfirm(isAsk ? null : false)
            }}
        >
            {request ? (
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-snug">{request.title}</AlertDialogTitle>
                        {request.description ? (
                            <AlertDialogDescription className="whitespace-pre-line text-[15px] leading-relaxed text-slate-600 dark:text-zinc-400">
                                {request.description}
                            </AlertDialogDescription>
                        ) : (
                            <AlertDialogDescription className="sr-only">{request.title}</AlertDialogDescription>
                        )}
                    </AlertDialogHeader>

                    {isAsk ? (
                        <div className="space-y-1.5">
                            {request.label ? (
                                <Label htmlFor="confirm-action-input" className="text-sm font-semibold">
                                    {request.label}
                                    {request.required ? <span className="text-red-600"> *</span> : null}
                                </Label>
                            ) : null}
                            {request.multiline ? (
                                <Textarea
                                    id="confirm-action-input"
                                    autoFocus
                                    rows={3}
                                    value={text}
                                    placeholder={request.placeholder}
                                    onChange={(e) => setText(e.target.value)}
                                    className="text-base"
                                />
                            ) : (
                                <Input
                                    id="confirm-action-input"
                                    autoFocus
                                    value={text}
                                    inputMode={request.inputMode === "numeric" ? "numeric" : "text"}
                                    placeholder={request.placeholder}
                                    onChange={(e) => setText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            submit()
                                        }
                                    }}
                                    className="h-11 text-base"
                                />
                            )}
                            {request.required && !text.trim() ? (
                                <p className="text-sm text-slate-600 dark:text-zinc-400">Wajib diisi sebelum melanjutkan.</p>
                            ) : null}
                        </div>
                    ) : null}

                    <AlertDialogFooter>
                        <AlertDialogCancel className="h-10">{request.cancelLabel}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={cannotConfirm}
                            onClick={(e) => {
                                if (cannotConfirm) {
                                    e.preventDefault()
                                    return
                                }
                                submit()
                            }}
                            className={cn(
                                "h-10",
                                request.destructive && "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/30"
                            )}
                        >
                            {request.confirmLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            ) : null}
        </AlertDialog>
    )
}
