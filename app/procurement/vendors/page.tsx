import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { VendorsWrapper } from "./vendors-wrapper"

export default function VendorsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        }>
            <VendorsWrapper />
        </Suspense>
    )
}
