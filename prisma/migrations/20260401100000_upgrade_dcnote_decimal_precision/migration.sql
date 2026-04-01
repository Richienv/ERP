-- Upgrade DebitCreditNote amount columns from Decimal(15,2) to Decimal(20,2) to support up to Rp 100T+
ALTER TABLE "debit_credit_notes"
  ALTER COLUMN "subtotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "ppnAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "settledAmount" TYPE DECIMAL(20,2);

-- Upgrade DebitCreditNoteItem amount columns
ALTER TABLE "debit_credit_note_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(20,2),
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "amount" TYPE DECIMAL(20,2),
  ALTER COLUMN "ppnAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2);
