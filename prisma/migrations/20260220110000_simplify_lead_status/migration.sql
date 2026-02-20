-- Simplify LeadStatus: 7 stages → 4 stages
-- Map: CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION → FOLLOW_UP

-- Step 1: Add FOLLOW_UP to the enum
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';

-- Step 2: Migrate existing data (old statuses → FOLLOW_UP)
UPDATE "Lead" SET status = 'FOLLOW_UP' WHERE status IN ('CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION');
