# Payment Terms Model — Replace Enum with Table

**Date:** 2026-03-26
**Status:** Approved

## Problem

PaymentTerm is a 7-value enum (CASH, NET_15/30/45/60/90, COD). Can't add custom terms, no installment support, due date mapping hardcoded in 2 places, supplier term ignored in AP.

## Design

### New Models

PaymentTerm table with PaymentTermLine for installment support. Seed 7 default terms matching current enum. Add paymentTermId FK to Customer, Supplier, Quotation, SalesOrder.

### Migration

1. Create tables, seed defaults
2. Add nullable paymentTermId FK to 4 models
3. Backfill FK from existing enum values
4. Create termToDays() helper
5. Keep enum temporarily for backwards compat

### What stays the same

- Invoice.dueDate is explicit (calculated at creation)
- Payment model unchanged
- UI swaps enum Select for DB-backed Select
