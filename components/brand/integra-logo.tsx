import { cn } from "@/lib/utils"

/**
 * Integra brand mark and wordmark.
 *
 * The mark is a blue rounded square holding three white "ledger" bars stacked like
 * books, widest at the base: an abstract "I" for Integra, books in order.
 * The same geometry is drawn in app/icon.svg, app/apple-icon.tsx and
 * app/opengraph-image.tsx; change all four together.
 */

/** Brand colours as hex, for places that cannot read CSS variables (icons, OG images). */
export const INTEGRA_COLORS = {
  /** Brand blue, equal to --primary oklch(0.49 0.2 262) */
  blue: "#1554CF",
  /** Shell navy, equal to --sidebar oklch(0.24 0.05 262) */
  navy: "#121F37",
  /** Ink, equal to --foreground oklch(0.22 0.03 260) */
  ink: "#121B29",
  /** Canvas, equal to --background oklch(0.975 0.004 255) */
  canvas: "#F5F7F9",
  /** Secondary text, equal to --muted-foreground */
  slate: "#4E5969",
  white: "#FFFFFF",
} as const

/** Mark geometry on a 32 x 32 grid. Bars run top to bottom. */
export const INTEGRA_MARK = {
  size: 32,
  radius: 7,
  barHeight: 4,
  barRadius: 1.5,
  bars: [
    { x: 11, y: 7, width: 10 },
    { x: 9, y: 14, width: 14 },
    { x: 7, y: 21, width: 18 },
  ],
} as const

type IntegraMarkProps = {
  className?: string
  /** Accessible name. Leave empty when the mark sits next to visible text. */
  title?: string
}

export function IntegraMark({ className, title }: IntegraMarkProps) {
  const labelled = Boolean(title)
  return (
    <svg
      viewBox={`0 0 ${INTEGRA_MARK.size} ${INTEGRA_MARK.size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8 shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <rect
        width={INTEGRA_MARK.size}
        height={INTEGRA_MARK.size}
        rx={INTEGRA_MARK.radius}
        fill={INTEGRA_COLORS.blue}
      />
      {INTEGRA_MARK.bars.map((bar) => (
        <rect
          key={bar.y}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={INTEGRA_MARK.barHeight}
          rx={INTEGRA_MARK.barRadius}
          fill={INTEGRA_COLORS.white}
        />
      ))}
    </svg>
  )
}

const SIZES = {
  sm: { gap: "gap-2", mark: "size-7", word: "text-base" },
  md: { gap: "gap-2.5", mark: "size-8", word: "text-lg" },
  lg: { gap: "gap-3", mark: "size-11", word: "text-2xl" },
} as const

const TONES = {
  /** On white or the grey canvas */
  default: {
    word: "text-foreground",
    caption: "border-border text-muted-foreground",
    subtitle: "text-muted-foreground",
  },
  /** Inside the navy sidebar: follows the --sidebar* tokens */
  sidebar: {
    word: "text-sidebar-accent-foreground",
    caption: "border-sidebar-border text-sidebar-foreground/80",
    subtitle: "text-sidebar-foreground/75",
  },
  /** On a dark brand surface outside the sidebar */
  inverse: {
    word: "text-white",
    caption: "border-white/25 text-white/80",
    subtitle: "text-white/75",
  },
} as const

type IntegraLogoProps = {
  /** Small tag after the wordmark, for example "ERP". */
  caption?: string
  /** Second line under the wordmark, for example the company name. */
  subtitle?: React.ReactNode
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  className?: string
  /** Applied to the text block, for example to hide it in the icon-only sidebar. */
  textClassName?: string
}

export function IntegraLogo({
  caption,
  subtitle,
  size = "md",
  tone = "default",
  className,
  textClassName,
}: IntegraLogoProps) {
  const s = SIZES[size]
  const t = TONES[tone]

  return (
    <span className={cn("inline-flex min-w-0 items-center", s.gap, className)}>
      <IntegraMark className={s.mark} />
      <span className={cn("flex min-w-0 flex-col", textClassName)}>
        <span className="flex items-center gap-1.5">
          <span className={cn("font-semibold leading-none tracking-tight", s.word, t.word)}>
            integra
          </span>
          {caption ? (
            <span
              className={cn(
                "rounded-[5px] border px-1.5 text-xs font-semibold leading-[1.15rem]",
                t.caption,
              )}
            >
              {caption}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className={cn("mt-1 truncate text-xs leading-tight", t.subtitle)}>{subtitle}</span>
        ) : null}
      </span>
    </span>
  )
}
