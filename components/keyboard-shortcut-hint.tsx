import { cn } from "@/lib/utils"

interface KeyboardShortcutHintProps {
  keys: string[]
  className?: string
}

/**
 * Display keyboard shortcut hint.
 *
 * @example
 * <KeyboardShortcutHint keys={["⌘", "Enter"]} />
 * <KeyboardShortcutHint keys={["⌘", "N"]} />
 * <KeyboardShortcutHint keys={["Esc"]} />
 */
export function KeyboardShortcutHint({ keys, className }: KeyboardShortcutHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="pointer-events-none inline-flex h-5 select-none items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1 font-mono text-[10px] font-medium text-muted-foreground min-w-5"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
