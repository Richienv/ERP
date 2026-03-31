-- Step 1: Rename the existing enum type
ALTER TYPE "PaymentTerm" RENAME TO "PaymentTermLegacy";

-- Step 2: Create payment_terms table
CREATE TABLE "payment_terms" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 30,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create payment_term_lines table
CREATE TABLE "payment_term_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "paymentTermId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "payment_term_lines_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create indexes and constraints
CREATE UNIQUE INDEX "payment_terms_code_key" ON "payment_terms"("code");
CREATE INDEX "payment_term_lines_paymentTermId_idx" ON "payment_term_lines"("paymentTermId");

-- Step 5: Add foreign key
ALTER TABLE "payment_term_lines" ADD CONSTRAINT "payment_term_lines_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "payment_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
