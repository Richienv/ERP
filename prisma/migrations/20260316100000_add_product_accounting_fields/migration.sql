-- AlterTable
ALTER TABLE "products" ADD COLUMN "cogsAccountId" UUID;
ALTER TABLE "products" ADD COLUMN "inventoryAccountId" UUID;
ALTER TABLE "products" ADD COLUMN "incomeAccountId" UUID;
ALTER TABLE "products" ADD COLUMN "purchaseAccountId" UUID;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_cogsAccountId_fkey" FOREIGN KEY ("cogsAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_purchaseAccountId_fkey" FOREIGN KEY ("purchaseAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
