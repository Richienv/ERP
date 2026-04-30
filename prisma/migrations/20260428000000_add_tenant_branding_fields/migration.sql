-- Extend TenantConfig with brand fields used by document templates.
-- Also align primaryColor default with design system (neutral-900 #18181b).

ALTER TABLE "tenant_config"
    ADD COLUMN "companyAddress" TEXT,
    ADD COLUMN "companyNpwp"    TEXT,
    ADD COLUMN "companyEmail"   TEXT,
    ADD COLUMN "companyPhone"   TEXT,
    ADD COLUMN "logoStorageKey" TEXT;

ALTER TABLE "tenant_config"
    ALTER COLUMN "primaryColor" SET DEFAULT '#18181b';
