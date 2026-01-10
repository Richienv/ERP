# Accountant Role: Database Schema & Data Analysis

This document details the data structure required to power the **Accountant "Financial Command Center"**.

## 1. Functional Analysis
The Accountant needs data structured for **Validation** and **Analysis**, not just storage.
1.  **monitoring**: Real-time aggregated totals (Cash, AR, AP).
2.  **Collections**: Detail view of unpaid invoices with aging logic.
3.  **Reconciliation**: Matching external bank data with internal records.

## 2. Proposed Table Schema

The core elements are the **`invoices`** (Track money owed/owing) and the **`general_ledger`** (The source of truth for reports).

### A. Core Table: `invoices` (AR & AP)
Handles both Customer Invoices (Receivables) and Vendor Bills (Payables).

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Unique Invoice ID (e.g., "INV-2024-001") |
| `type` | `ENUM` | | 'customer_invoice' (AR) or 'vendor_bill' (AP) |
| `partner_id` | `UUID` | FK | Customer or Supplier ID. |
| `date_issued` | `DATE` | | The billing date. |
| `date_due` | `DATE` | | **Critical**: Used to calculate "Aging". |
| `amount_total` | `DECIMAL` | | Total value with Tax. |
| `amount_residual` | `DECIMAL` | | **Critical**: How much is still unpaid? |
| `status` | `ENUM` | | 'draft', 'posted', 'paid', 'overdue' |
| `payment_state` | `ENUM` | | 'not_paid', 'partial', 'paid' |
| `last_reminder_sent` | `DATETIME` | | For the AI Collections Assistant. |

### B. Reconciliation Table: `bank_transaction_lines`
Captures the raw feed from the bank for matching.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Unique Feed ID. |
| `date` | `DATE` | | Transaction date. |
| `description` | `VARCHAR` | | Raw text from Bank (e.g., "TRF FROM PT JAYA"). |
| `amount` | `DECIMAL` | | (+) Income, (-) Expense. |
| `matched_invoice_id`| `UUID` | FK | **The Goal**: Link this to an Invoice. |
| `match_confidence` | `FLOAT` | | **AI Score**: 0.0 to 1.0 (e.g., 0.98). |
| `status` | `ENUM` | | 'pending', 'reconciled' |

### C. Reporting Backbone: `general_ledger`
The "Book of Record". Every valid financial action creates rows here.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | |
| `account_id` | `UUID` | FK | e.g., "101-Cash", "400-Sales". |
| `journal_entry_id` | `UUID` | FK | Grouping for double-entry. |
| `date` | `DATE` | | Reporting date. |
| `debit` | `DECIMAL` | | |
| `credit` | `DECIMAL` | | |
| `balance` | `DECIMAL` | | Computed (Debit - Credit). |

## 3. Explanation of the Schema

### Why this structure?
*   **Aging Analysis**: By querying `invoices` where `status='posted'` and `amount_residual > 0`, calculating `DATEDIFF(NOW(), date_due)` gives us the exact **Invoice Aging** buckets (0-30, 31-60, >60) instantly.
*   **AI Collections**: The `last_reminder_sent` field allows the AI to determine *when* to nag a customer next.
*   **Smart Reconciliation**: The `match_confidence` field in `bank_transaction_lines` is populated by a background AI job. The Accountant Dashboard simply performs `SELECT * WHERE match_confidence > 0.9` to show the "Easy Wins" first.

### Data Flow Example (Reconciliation)
1.  **System** imports Bank Statement -> Inserts into `bank_transaction_lines` (Status: Pending).
2.  **AI Service** scans open `invoices`. Finds a match for amount & name.
    *   Updates `matched_invoice_id` and sets `match_confidence = 0.95`.
3.  **Accountant** sees "95% Match" card on Dashboard.
4.  **Accountant** clicks "Setujui" (Approve).
5.  **System**:
    *   Updates `bank_transaction_lines` -> 'reconciled'.
    *   Updates `invoices` -> `payment_state` = 'paid'.
    *   Writes debit/credit rows to `general_ledger`.
