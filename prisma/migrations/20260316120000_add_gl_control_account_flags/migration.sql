-- AlterTable
ALTER TABLE "gl_accounts" ADD COLUMN "isControlAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gl_accounts" ADD COLUMN "allowDirectPosting" BOOLEAN NOT NULL DEFAULT true;

-- Set control accounts: AR (1200), AP (2000), Inventory (1300)
UPDATE "gl_accounts" SET "isControlAccount" = true, "allowDirectPosting" = false WHERE "code" IN ('1200', '2000', '1300');
