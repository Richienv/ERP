# Accountant User Flow

This document outlines the user flow for the **Accountant** role.

## 1. High-Level Overview

The Accountant interface is built as a **"Financial Command Center"**. Unlike the Staff role which is transactional, this role is **analytical and action-oriented** (Validation & Decision Making).

**Primary Goal**: Monitor financial health, accelerate collections (AR), and ensure data accuracy (Reconciliation).

## 2. Detailed User Flow (Mermaid)

```mermaid
graph TD
    A[Start] --> B(Login Page /login)
    B --> C{Select Role}
    C -->|Accountant| D[Login as 'Akuntan / Finance']
    D --> E[Redirect to /accountant]
    
    subgraph "Financial Command Center"
        E --> F[Pusat Kendali Keuangan]
        
        subgraph "1. Monitoring (Top Level)"
            F --> G[View Real-time Metrics]
            G --> H{Detailed Drill-down}
            H -->|Cash| I[Cash Position & Runway]
            H -->|AR| J[Accounts Receivable Summary]
            H -->|AP| K[Accounts Payable Summary]
            H -->|Profit| L[Profitability Trends]
        end

        subgraph "2. Collections (Invoice Aging)"
            F --> M[Invoice Aging Assistant]
            M --> N[View Overdue Invoices]
            N --> O[Select High Priority Invoice]
            
            O --> P{AI Recommendation}
            P -->|Strategy| Q[View 'Soft Reminder' Draft]
            Q --> R[Edit & Send Email]
            R --> S[Log: Action Taken]
        end

        subgraph "3. Reconciliation (Bank Check)"
            F --> T[Smart Reconciliation]
            T --> U[View Transaction Match]
            
            U --> V{Review AI Confidence}
            V -->|High Score| W[Click 'Setujui' / Accept]
            V -->|Low Score| X[Click 'Tolak' / Reject]
            
            W --> Y[Post to General Ledger]
            X --> Z[Flag for Manual Review]
        end
    end

    S --> F
    Y --> F
```

## 3. Key Use Cases

### Scenario A: Morning Health Check
1.  **Login**: User logs in as Accountant.
2.  **Overview**: Immediately sees the "Cash Position" (Is it low?) and "Receivables" (Who owes us?).
3.  **Insight**: Notices Profitability is down due to a spike in COGS (implied context).

### Scenario B: AI-Assisted Collections (The "Hustle")
1.  **Trigger**: Sees "Total Receivables" is high.
2.  **Action**: Moves to **Invoice Aging** Card.
3.  **Selection**: Clicks on "PT. Retail Besar" (Overdue 15 Days).
4.  **AI Assist**: System generates a friendly but firm email draft.
5.  **Execution**: User clicks "Kirim" (Send) to trigger the collection process.

### Scenario C: Fast-Path Reconciliation
1.  **Trigger**: A payment notification comes in.
2.  **Action**: Moves to **Bank Reconciliation** Card.
3.  **Validation**: Sees "Incoming Rp 150M" matched with "Invoice INV-001" (98% Confidence).
4.  **Execution**: Clicks **Setujui**. The ledger is updated instantly.
