import { Suspense } from "react"
import { getOnboardingTemplates } from "@/lib/actions/hcm-onboarding"
import { ClipboardCheck } from "lucide-react"

export const dynamic = "force-dynamic"

async function OnboardingContent() {
    const templates = await getOnboardingTemplates()

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-widest">Onboarding Karyawan</h2>
            </div>

            {templates.length === 0 ? (
                <div className="bg-white border-2 border-black p-8 text-center">
                    <ClipboardCheck className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Belum ada template onboarding
                    </span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((t) => (
                        <div
                            key={t.id}
                            className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black">{t.name}</span>
                                <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                                    {t.taskCount} tugas
                                </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-bold">
                                Dibuat: {new Date(t.createdAt).toLocaleDateString('id-ID')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function OnboardingPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <ClipboardCheck className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat onboarding...
                        </span>
                    </div>
                }
            >
                <OnboardingContent />
            </Suspense>
        </div>
    )
}
