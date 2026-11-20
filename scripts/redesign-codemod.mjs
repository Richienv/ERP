#!/usr/bin/env node
/**
 * Integra Pro redesign codemod (2026-11-21).
 *
 * Rewrites the neo-brutalist utility classes (thick black borders, hard offset shadows, square
 * corners, black/uppercase/tracked labels, 10–11 px text, orange accents) into the professional
 * system described in docs/plans/2026-11-21-erp-redesign-and-one-import-design.md.
 *
 * Only Tailwind class tokens are touched; no logic. Idempotent: running it twice changes nothing.
 *   node scripts/redesign-codemod.mjs            # rewrite
 *   node scripts/redesign-codemod.mjs --dry      # count only
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const ROOTS = ["app", "components", "lib", "hooks"]
const DRY = process.argv.includes("--dry")

// Boundaries for a class token inside a string: start/end, whitespace, quotes, backtick, ${ }.
const L = "(?<=^|[\\s\"'`{}])"
const R = "(?=$|[\\s\"'`{}])"
const V = "((?:[a-z0-9-]+:)*)" // variant prefixes like hover: dark: md:

const RULES = [
    // Hard offset shadows → soft elevation
    [new RegExp(`${L}${V}shadow-\\[-?\\d+px_-?\\d+px_0(?:px)?(?:_0(?:px)?)?_(?:rgba?\\([^\\]]*\\)|#[0-9a-fA-F]+|black)\\]${R}`, "g"), (_m, v) => `${v}shadow-sm`],
    // Brutalist press effects
    [new RegExp(`${L}(?:[a-z0-9-]+:)*-?translate-[xy]-\\[\\d+px\\]${R}`, "g"), () => ""],
    // Thick borders → hairlines
    [new RegExp(`${L}${V}border-([trblxy]-)?(?:2|\\[3px\\]|4)${R}`, "g"), (_m, v, side = "") => `${v}border${side ? "-" + side.slice(0, -1) : ""}`],
    [new RegExp(`${L}${V}border-black${R}`, "g"), (_m, v) => `${v}border-border`],
    [new RegExp(`${L}${V}divide-black${R}`, "g"), (_m, v) => `${v}divide-border`],
    // Square → softly rounded
    [new RegExp(`${L}${V}rounded-none${R}`, "g"), (_m, v) => `${v}rounded-md`],
    // Shouting labels → calm ones
    [new RegExp(`${L}${V}font-(?:black|extrabold)${R}`, "g"), (_m, v) => `${v}font-semibold`],
    [new RegExp(`${L}(?:[a-z0-9-]+:)*uppercase${R}`, "g"), () => ""],
    [new RegExp(`${L}(?:[a-z0-9-]+:)*tracking-(?:wide|wider|widest|\\[[^\\]]+\\])${R}`, "g"), () => ""],
    // Tiny text → readable minimum
    [new RegExp(`${L}${V}text-\\[(?:8|9|10|11)px\\]${R}`, "g"), (_m, v) => `${v}text-xs`],
    // Black slabs → deep slate
    [new RegExp(`${L}${V}bg-black${R}`, "g"), (_m, v) => `${v}bg-slate-900`],
    // Brand accent: orange → blue (amber/red/green keep their meaning)
    [new RegExp(`${L}${V}(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|accent|caret|placeholder|shadow)-orange-(\\d{2,3}(?:\\/\\d{1,3})?)${R}`, "g"), (_m, v, kind, shade) => `${v}${kind}-blue-${shade}`],
]

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name.startsWith(".") || name.startsWith("._") || name === "node_modules") continue
        const full = path.join(dir, name)
        const st = statSync(full)
        if (st.isDirectory()) walk(full, out)
        else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(name)) out.push(full)
    }
    return out
}

let files = 0
let edits = 0
for (const root of ROOTS) {
    for (const file of walk(root)) {
        if (file.startsWith(path.join("lib", "actions"))) continue // server code, no classes
        const before = readFileSync(file, "utf8")
        let after = before
        let n = 0
        for (const [re, fn] of RULES) {
            after = after.replace(re, (...args) => {
                n++
                return fn(...args)
            })
        }
        // Tidy the double spaces removals leave inside class strings (never touches indentation).
        after = after.replace(/(["'`])([^"'`\n]*?)\1/g, (m, q, body) => (/\S {2,}\S/.test(body) && /\b(?:text|bg|border|flex|px|py|font)-/.test(body) ? q + body.replace(/(\S) {2,}(?=\S)/g, "$1 ").trim() + q : m))
        if (after !== before) {
            files++
            edits += n
            if (!DRY) writeFileSync(file, after)
        }
    }
}
console.log(`${DRY ? "[dry] " : ""}${files} files, ${edits} class rewrites`)
