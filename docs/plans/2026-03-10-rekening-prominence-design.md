# Rekening Prominence Enhancement — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make bank account (rekening) visible, required on manual items, and filterable across the cashflow planning board.

**Architecture:** Three changes to the existing cashflow planning board — no new models, no new API routes. All changes are UI-level plus minor validation in the create dialog.

---

## 1. Manual Item Dialog — Rekening Required

- GL account field becomes **required** (red asterisk, validation blocks submit if empty)
- Filter dropdown to only show bank/cash GL accounts (code starts with "10")
- Short label derived from account name for display

## 2. Item Pills — Show Rekening Badge

- Each item pill in the calendar grid appends a short rekening badge: e.g., `Piutang +5jt [BCA]`
- Derived from `glAccountCode` / `glAccountName` on each `CashflowItem`
- Items without GL account show no badge (e.g., BPJS)

## 3. Rekening Filter Bar

- Filter bar below tabs, above calendar: "Semua | BCA | Mandiri | Cash | ..."
- Buttons fetched from GL accounts where code starts with "10"
- Applies to: calendar grid, running balance table, weekly summary
- State managed in `CashflowPlanningBoard` component
- Default: "Semua" (no filter)

---

## Files Affected

| File | Change |
|------|--------|
| `components/finance/create-cashflow-item-dialog.tsx` | Make GL account required, filter to bank accounts only |
| `components/finance/cashflow-planning-board.tsx` | Add rekening filter bar, show badge on pills, pass filtered items |

## No Changes Needed

- No schema changes (GL account field already exists on CashflowPlanItem)
- No new API routes (bank accounts already fetched from `/api/finance/transactions`)
- No server action changes
