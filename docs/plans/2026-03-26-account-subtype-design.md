# AccountSubType — Detailed Account Classification

**Date:** 2026-03-26
**Status:** Approved
**Approach:** Add `subType` field to GLAccount (keep existing `type` unchanged for zero breaking changes)

## Problem

GLAccount has only 5 types (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE). Reports can't distinguish Current Assets from Fixed Assets, Revenue from Other Income, or COGS from Operating Expenses. ~30 queries depend on `['ASSET', 'EXPENSE'].includes(type)` — changing the enum would break them all.

## Design

Add `AccountSubType` enum with 17 values + `subType` field on GLAccount (default: GENERAL). Auto-assign from code ranges via migration script. Reports use `subType` for finer grouping. All existing code continues using `type` — zero breaking changes.
