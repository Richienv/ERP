-- CreateEnum
CREATE TYPE "DCNoteType" AS ENUM ('SALES_CN', 'SALES_DN', 'PURCHASE_DN', 'PURCHASE_CN');

-- CreateEnum
CREATE TYPE "DCNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'APPLIED', 'PARTIAL', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DCNoteReasonCode" AS ENUM ('RET_DEFECT', 'RET_WRONG', 'RET_QUALITY', 'RET_EXCESS', 'RET_EXPIRED', 'ADJ_OVERCHARGE', 'ADJ_DISCOUNT', 'ADJ_UNDERCHARGE', 'ADJ_ADDCHARGE', 'SVC_CANCEL', 'SVC_SHORT', 'ORD_CANCEL', 'ADJ_PENALTY', 'ADJ_REBATE', 'ADJ_GOODWILL');

-- DropForeignKey
ALTER TABLE "public"."credit_notes" DROP CONSTRAINT "credit_notes_customerId_fkey";

-- DropTable
DROP TABLE "public"."credit_notes";

-- DropEnum
DROP TYPE "public"."CreditNoteStatus";

-- DropEnum
DROP TYPE "public"."CreditReason";

-- CreateTable
CREATE TABLE "debit_credit_notes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "number" TEXT NOT NULL,
    "type" "DCNoteType" NOT NULL,
    "status" "DCNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reasonCode" "DCNoteReasonCode" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "originalInvoiceId" UUID,
    "originalReference" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "ppnAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "settledAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postingDate" TIMESTAMP(3),
    "notes" TEXT,
    "description" TEXT,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_credit_note_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "noteId" UUID NOT NULL,
    "productId" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "ppnAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_credit_note_settlements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "noteId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_credit_note_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debit_credit_notes_number_key" ON "debit_credit_notes"("number");

-- CreateIndex
CREATE UNIQUE INDEX "debit_credit_notes_journalEntryId_key" ON "debit_credit_notes"("journalEntryId");

-- CreateIndex
CREATE INDEX "debit_credit_notes_type_idx" ON "debit_credit_notes"("type");

-- CreateIndex
CREATE INDEX "debit_credit_notes_status_idx" ON "debit_credit_notes"("status");

-- CreateIndex
CREATE INDEX "debit_credit_notes_customerId_idx" ON "debit_credit_notes"("customerId");

-- CreateIndex
CREATE INDEX "debit_credit_notes_supplierId_idx" ON "debit_credit_notes"("supplierId");

-- AddForeignKey
ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_note_items" ADD CONSTRAINT "debit_credit_note_items_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "debit_credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_note_items" ADD CONSTRAINT "debit_credit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_note_settlements" ADD CONSTRAINT "debit_credit_note_settlements_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "debit_credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_credit_note_settlements" ADD CONSTRAINT "debit_credit_note_settlements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
