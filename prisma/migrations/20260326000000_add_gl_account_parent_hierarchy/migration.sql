-- AlterTable: add parentId self-referential FK to gl_accounts for COA hierarchy
ALTER TABLE "gl_accounts" ADD COLUMN "parentId" UUID;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
