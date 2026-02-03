import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { ReceivingWrapper } from "./receiving-wrapper"

export default function ReceivingPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        }>
            <ReceivingWrapper />
        </Suspense>
    )
}
