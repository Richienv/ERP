/**
 * Dev-only Web Vitals logging.
 * Call once on app mount to log Core Web Vitals to console.
 * Production uses Vercel Speed Insights (already in layout.tsx).
 */
export function reportWebVitals() {
    if (process.env.NODE_ENV !== "development") return
    if (typeof window === "undefined") return

    import("web-vitals").then(({ onCLS, onLCP, onINP, onTTFB }) => {
        onCLS((m) => console.log(`[Vitals] CLS: ${m.value.toFixed(3)}`))
        onLCP((m) => console.log(`[Vitals] LCP: ${m.value.toFixed(0)}ms`))
        onINP((m) => console.log(`[Vitals] INP: ${m.value.toFixed(0)}ms`))
        onTTFB((m) => console.log(`[Vitals] TTFB: ${m.value.toFixed(0)}ms`))
    })
}
