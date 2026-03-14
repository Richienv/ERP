-- ============================================================
-- TRUNCATE ALL DATA (keep schema + auth tables)
-- Run in: Supabase SQL Editor
-- Keeps: users, accounts, sessions, verification_tokens
-- Deletes: everything else
-- ============================================================

-- Build one big TRUNCATE statement with all non-auth tables
DO $$
DECLARE
    tbl_list TEXT;
    skip_tables TEXT[] := ARRAY['users', 'accounts', 'sessions', 'verificationtokens', '_prisma_migrations'];
BEGIN
    SELECT string_agg('public.' || quote_ident(tablename), ', ')
    INTO tbl_list
    FROM pg_tables
    WHERE schemaname = 'public'
      AND NOT (tablename = ANY(skip_tables));

    IF tbl_list IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tbl_list || ' CASCADE';
    END IF;

    RAISE NOTICE 'All data truncated. Skipped: users, accounts, sessions, verificationtokens, _prisma_migrations';
END $$;
