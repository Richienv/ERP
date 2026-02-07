# Database Connection Fix Needed

We are facing connection issues preventing the database migration.

### The Problem
1. **Direct Connection** (`db.qundyzibdhggwhxgtlus.supabase.co`) cannot be used because the environment is IPv4-only (failed with "Not IPv4 compatible").
2. **Pooler Connection** (`aws-0-ap-southeast-1.pooler.supabase.com`) is failing with `FATAL: Tenant or user not found`. This usually means the hostname or username configuration is incorrect for this specific project.

### How to Fix

1. Log in to **[Supabase Dashboard](https://supabase.com/dashboard/project/qundyzibdhggwhxgtlus/settings/database)**.
2. Go to **Settings > Database**.
3. Under **Connection String**, change "Method" to **Transaction Pooler**.
4. Copy the entire connection string. It should look like:
   `postgresql://postgres.qundyzibdhggwhxgtlus:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
5. Paste this connection string into your `.env` file as `DATABASE_URL`.
6. Also copy the **Session Pooler** string (change port to 5432) for `DIRECT_URL`.

Once you have the correct string, run:
```bash
npx prisma db push
```

Alternatively, try resetting the database password again to ensure no special verification issues, though `XiaoRichieMolly123` should be fine.
