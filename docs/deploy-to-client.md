# Deploy to Client — Checklist Lengkap

> Dokumen ini berisi langkah-langkah lengkap untuk deploy ERP multi-tenant ke production dan onboard client pertama.

---

## Arsitektur Database: Apa yang Berubah dari Development

```
DEVELOPMENT (sekarang):
┌──────────────────────────┐
│  Supabase Project        │
│  ├─ Auth (login/signup)  │
│  └─ PostgreSQL (1 DB)    │  ← Semua data di 1 database Supabase
└──────────────────────────┘

PRODUCTION (multi-tenant):
┌──────────────────────────┐     ┌─────────────────────────────────┐
│  Supabase Project        │     │  PostgreSQL di VPS (Docker)     │
│  └─ Auth SAJA            │     │  ├─ erp_client_garmen           │
│     (shared semua tenant)│     │  ├─ erp_client_konveksi         │
└──────────────────────────┘     │  ├─ erp_client_tekstil          │
                                 │  └─ ... (1 DB per client)       │
                                 └─────────────────────────────────┘
                                   ↑ Jalan di VPS yang sama, $0 extra
```

### Kenapa Tidak Pakai Supabase untuk Database?
- Supabase free tier = max 2 project (2 database)
- Supabase Pro = $25/bulan **per project** → 10 client = $250/bulan (mahal!)
- Self-hosted PostgreSQL di VPS = $0 tambahan, unlimited database

### Kenapa Supabase Auth Tetap Dipakai?
- Auth is hard — Supabase Auth gratis sampai 50K MAU
- Sudah terintegrasi di seluruh codebase (middleware, login, session)
- Tidak perlu refactor apa-apa — cuma database yang pindah

### Apa yang Perlu Diubah di Code?
**TIDAK ADA.** Cuma beda environment variable:
```
# Development (.env sekarang):
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres     ← Supabase DB

# Production (per tenant container):
DATABASE_URL=postgresql://erp_admin:xxx@postgres:5432/erp_client_garmen  ← Local PostgreSQL
```
Prisma tidak peduli database-nya di mana — yang penting connection string-nya benar.

---

## Perbandingan Opsi Database

| Opsi | Cost/bulan | Pro | Kontra |
|------|-----------|-----|--------|
| **PostgreSQL di VPS (Docker)** | $0 (sudah include VPS) | Paling murah, unlimited DB, full control | Harus manage sendiri (backup, update) |
| Supabase (1 project per tenant) | $25 x N client | Managed, dashboard | Mahal, overkill |
| Neon (serverless PG) | Free tier 1 project, $19/project | Serverless, auto-scale | Mahal untuk multi-DB |
| DigitalOcean Managed DB | $15/bulan (1 server) | Managed, auto-backup | Lebih mahal dari self-host |
| PlanetScale / CockroachDB | Varies | Scalable | Bukan PostgreSQL, perlu migrasi |

**Rekomendasi: PostgreSQL di VPS** — $0 tambahan, sudah dikonfigurasi di `docker-compose.yml`.

---

## Phase 1: Persiapan VPS (1x saja)

### 1.1 Sewa VPS
- [ ] Pilih provider (urutkan dari termurah):

| Provider | Spec | Harga |
|----------|------|-------|
| **Contabo** (Jerman) | 8GB RAM, 4 vCPU, 200GB SSD | €5.99/bulan (~$6.50) |
| **Hetzner** (Jerman/Finland) | 8GB RAM, 4 vCPU, 160GB | €7.59/bulan (~$8.20) |
| **DigitalOcean** (Singapore) | 8GB RAM, 4 vCPU, 160GB | $48/bulan |
| **Vultr** (Singapore/Tokyo) | 8GB RAM, 4 vCPU, 200GB | $48/bulan |

- [ ] OS: Ubuntu 22.04 LTS
- [ ] Region: Singapore atau Tokyo (terdekat ke Indonesia)
- [ ] **Catatan**: Contabo/Hetzner jauh lebih murah tapi server di Eropa. Untuk target user Indonesia, latency ~150-200ms. Kalau budget ketat, tetap bisa dipakai. Kalau mau low-latency, pilih DigitalOcean/Vultr Singapore.

### 1.2 Install Dependencies di VPS
```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Certbot untuk SSL
sudo apt install certbot python3-certbot-dns-cloudflare -y

# PostgreSQL client (untuk manual debug & backup)
sudo apt install postgresql-client -y
```

### 1.3 Setup Domain & DNS
- [ ] Beli domain `erp-indonesia.com` (atau nama lain) — ~$12/tahun di Namecheap/Cloudflare
- [ ] Setup di Cloudflare (free plan cukup)
- [ ] Tambah DNS records:
  ```
  A     erp-indonesia.com       → [IP VPS]
  A     *.erp-indonesia.com     → [IP VPS]   (wildcard)
  ```
- [ ] Pastikan Cloudflare proxy OFF (DNS only) untuk wildcard — biar SSL kita yang handle

### 1.4 Setup Wildcard SSL (Let's Encrypt)
```bash
# Buat Cloudflare API token: My Profile → API Tokens → Create Token
# Template: "Edit zone DNS" → Zone = erp-indonesia.com
# Simpan di /root/.cloudflare.ini:
echo "dns_cloudflare_api_token = YOUR_TOKEN_HERE" > /root/.cloudflare.ini
chmod 600 /root/.cloudflare.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d "erp-indonesia.com" \
  -d "*.erp-indonesia.com"

# Copy cert ke project
mkdir -p /opt/erp/infra/ssl/erp-indonesia.com
cp /etc/letsencrypt/live/erp-indonesia.com/fullchain.pem /opt/erp/infra/ssl/erp-indonesia.com/
cp /etc/letsencrypt/live/erp-indonesia.com/privkey.pem /opt/erp/infra/ssl/erp-indonesia.com/
```

### 1.5 Auto-Renew SSL (cron)
```bash
cat > /etc/cron.d/ssl-renew << 'EOF'
0 3 * * * root certbot renew --quiet && cp /etc/letsencrypt/live/erp-indonesia.com/*.pem /opt/erp/infra/ssl/erp-indonesia.com/ && docker compose -f /opt/erp/docker-compose.yml exec nginx nginx -s reload
EOF
```

---

## Phase 2: Deploy Aplikasi ke VPS

### 2.1 Clone & Setup Project
```bash
git clone [REPO_URL] /opt/erp
cd /opt/erp
```

### 2.2 Buat .env Production
```bash
cat > .env << 'EOF'
# ==============================
# PostgreSQL (self-hosted di Docker)
# ==============================
POSTGRES_USER=erp_admin
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_32_KARAKTER
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Database URL untuk development/default (tidak dipakai per-tenant, tapi Prisma butuh)
DATABASE_URL=postgresql://erp_admin:GANTI_DENGAN_PASSWORD_KUAT@postgres:5432/erp_default
DIRECT_URL=postgresql://erp_admin:GANTI_DENGAN_PASSWORD_KUAT@postgres:5432/erp_default

# ==============================
# Supabase Auth (HANYA untuk auth, bukan database)
# ==============================
# Pakai project Supabase yang sama dengan development
# Auth tetap di Supabase, database pindah ke VPS
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxx

# ==============================
# Domain
# ==============================
DOMAIN=erp-indonesia.com
EOF
```

> **PENTING:** Generate password kuat: `openssl rand -base64 32`

### 2.3 Enable SSL di Nginx Template
```bash
# Edit infra/nginx-tenant.conf.template — uncomment SSL lines:
sed -i 's/# listen 443 ssl;/listen 443 ssl;/' infra/nginx-tenant.conf.template
sed -i 's/# ssl_certificate /ssl_certificate /' infra/nginx-tenant.conf.template
sed -i 's/# ssl_certificate_key /ssl_certificate_key /' infra/nginx-tenant.conf.template
sed -i 's/# if ($scheme/if ($scheme/' infra/nginx-tenant.conf.template
```

### 2.4 Build & Start Base Services
```bash
# Build Docker image (1x, dipakai semua tenant)
docker compose build

# Start PostgreSQL + Nginx
docker compose up -d postgres nginx

# Verifikasi PostgreSQL ready
docker compose logs -f postgres
# Tunggu sampai muncul: "database system is ready to accept connections"
# Ctrl+C untuk keluar dari logs

# Test koneksi
docker compose exec postgres psql -U erp_admin -d postgres -c "SELECT version();"
```

---

## Phase 3: Onboard Client Baru (< 5 menit per client)

### 3.1 Provision Tenant
```bash
./scripts/provision-tenant.sh \
  --slug garmen-sejahtera \
  --name "PT Garmen Sejahtera" \
  --email admin@garmen.com \
  --plan PRO
```

Script ini otomatis:
1. Buat PostgreSQL database baru di VPS: `erp_client_garmen_sejahtera`
2. Jalankan semua Prisma migrations (57 tabel langsung ada)
3. Seed data awal:
   - 1 gudang default (WH-UTAMA)
   - 4 kategori produk (Kain, Trim, Barang Jadi, Packaging)
   - 14 akun COA dasar
   - 3 system role (Admin, Manager, Staff)
   - 1 admin user record
4. Generate nginx config untuk subdomain
5. Tambah Docker service ke docker-compose.override.yml

### 3.2 Start Container & Reload Nginx
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d tenant-garmen-sejahtera
docker compose exec nginx nginx -s reload
```

### 3.3 Buat User di Supabase Auth
Ini tetap di Supabase karena auth shared:
- [ ] Buka https://supabase.com → Project → Authentication → Users
- [ ] Klik "Add User" → "Create User"
- [ ] Email: `admin@garmen.com`, Password: `[temporary]`
- [ ] Setelah user dibuat, klik user → Edit → User Metadata:
  ```json
  {
    "role": "ROLE_CEO",
    "name": "Admin PT Garmen Sejahtera"
  }
  ```

> **Catatan:** Email harus unique across semua tenant. Kalau 1 orang punya akun di 2 tenant, perlu email berbeda (misal `admin+garmen@gmail.com`).

### 3.4 Test Akses
- [ ] Buka `https://garmen-sejahtera.erp-indonesia.com`
- [ ] Login dengan credentials di atas
- [ ] Pastikan sidebar hanya tampil modul sesuai plan (PRO = 7 modul)
- [ ] Pastikan nama "PT Garmen Sejahtera" muncul di sidebar & login page
- [ ] Test buat 1 produk, 1 customer — pastikan data masuk ke database tenant

### 3.5 Kirim Credentials ke Client
```
Halo Pak/Bu,

ERP Anda sudah siap digunakan:

URL:      https://garmen-sejahtera.erp-indonesia.com
Email:    admin@garmen.com
Password: [temporary password]

Silakan login dan segera ganti password melalui menu profil.
Plan Anda: PRO (Inventori, Penjualan, Pengadaan, Keuangan, Manufaktur, CMT, Cutting)

Terima kasih,
Tim ERP Indonesia
```

---

## Phase 4: Operasional Harian

### Backup Database (Otomatis)
```bash
# Buat folder backup
mkdir -p /backups

# Tambah cron: backup semua tenant databases setiap hari jam 2 pagi
cat > /etc/cron.d/erp-backup << 'CRON'
0 2 * * * root docker compose -f /opt/erp/docker-compose.yml exec -T postgres bash -c 'for db in $(psql -U erp_admin -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE '"'"'erp_client_%'"'"'"); do pg_dump -U erp_admin $db | gzip > /backups/$(date +\%Y\%m\%d)_${db}.sql.gz; done'
CRON

# Hapus backup lebih dari 30 hari
cat >> /etc/cron.d/erp-backup << 'CRON'
0 3 * * * root find /backups -name "*.sql.gz" -mtime +30 -delete
CRON
```

### Restore Database (Kalau Perlu)
```bash
# Restore backup tertentu
gunzip -c /backups/20260301_erp_client_garmen_sejahtera.sql.gz | \
  docker compose exec -T postgres psql -U erp_admin -d erp_client_garmen_sejahtera
```

### Upgrade Plan Client
```bash
# 1. Edit docker-compose.override.yml → ubah ENABLED_MODULES
#    Sebelum: ENABLED_MODULES=INVENTORY,SALES,PROCUREMENT
#    Sesudah: ENABLED_MODULES=INVENTORY,SALES,PROCUREMENT,FINANCE,MANUFACTURING,SUBCONTRACT,CUTTING

# 2. Update TenantConfig di database:
docker compose exec postgres psql -U erp_admin -d erp_client_garmen_sejahtera -c \
  "UPDATE tenant_config SET \"planType\" = 'PRO', \"enabledModules\" = '{INVENTORY,SALES,PROCUREMENT,FINANCE,MANUFACTURING,SUBCONTRACT,CUTTING}', \"maxUsers\" = 15 WHERE \"tenantSlug\" = 'garmen-sejahtera';"

# 3. Restart container
docker compose -f docker-compose.yml -f docker-compose.override.yml restart tenant-garmen-sejahtera
```

### Hapus Tenant (Churn)
```bash
./scripts/destroy-tenant.sh --slug garmen-sejahtera
# Manual: hapus entry tenant-garmen-sejahtera dari docker-compose.override.yml
docker compose exec nginx nginx -s reload
```

### Monitor
```bash
# Semua container status
docker compose -f docker-compose.yml -f docker-compose.override.yml ps

# Logs tenant tertentu
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f tenant-garmen-sejahtera

# Disk usage per database
docker compose exec postgres psql -U erp_admin -d postgres -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datname LIKE 'erp_client_%' ORDER BY pg_database_size(datname) DESC;"

# Total disk VPS
df -h /

# Memory usage
docker stats --no-stream
```

### Update Aplikasi (Deploy Versi Baru)
```bash
cd /opt/erp
git pull origin main

# Rebuild image
docker compose build

# Run migration di SEMUA tenant databases dulu
docker compose exec postgres psql -U erp_admin -d postgres -t -c \
  "SELECT datname FROM pg_database WHERE datname LIKE 'erp_client_%'" | \
  while read db; do
    echo "Migrating $db..."
    DATABASE_URL="postgresql://erp_admin:PASSWORD@localhost:5432/$db" npx prisma migrate deploy
  done

# Restart semua tenant
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

---

## Estimasi Biaya (Opsi Termurah)

### Pakai Contabo/Hetzner (Termurah)

| Komponen | Biaya |
|----------|-------|
| VPS Hetzner 8GB RAM (1-10 client) | ~€7.59/bulan (~Rp 130K) |
| Domain (Cloudflare Registrar) | ~$10/tahun (~Rp 13K/bulan) |
| SSL (Let's Encrypt) | $0 |
| Supabase Auth (free tier, 50K MAU) | $0 |
| PostgreSQL (di VPS, Docker) | $0 (included) |
| **Total** | **~Rp 143K/bulan** |

### Pakai DigitalOcean Singapore (Low Latency)

| Komponen | Biaya |
|----------|-------|
| VPS DO 8GB RAM (1-10 client) | $48/bulan (~Rp 770K) |
| Domain | ~Rp 13K/bulan |
| SSL + Supabase Auth + PostgreSQL | $0 |
| Backup (DO Spaces 50GB) | $5/bulan (~Rp 80K) |
| **Total** | **~Rp 863K/bulan** |

### Proyeksi Revenue vs Cost

| Skenario | Revenue/bulan | Cost/bulan | Profit | Margin |
|----------|---------------|------------|--------|--------|
| 3 client STARTER (Hetzner) | Rp 3.0M | Rp 143K | Rp 2.86M | 95% |
| 5 client STARTER (DO) | Rp 5.0M | Rp 863K | Rp 4.14M | 83% |
| 3 STARTER + 5 PRO | Rp 13.0M | Rp 1.5M | Rp 11.5M | 88% |

---

## Resource Usage per Tenant

| Resource | Per Tenant | 10 Tenant | Notes |
|----------|-----------|-----------|-------|
| RAM | ~300-500MB | ~4GB | Next.js standalone + Node.js |
| Disk (DB) | ~50-200MB | ~1.5GB | Depends on transaction volume |
| CPU | Idle: ~0.5%, Active: ~5-15% | Peaks shared | Mostly idle for SME |

### Kapan Harus Upgrade VPS?

| Jumlah Client | VPS Spec | Est. Cost |
|---------------|----------|-----------|
| 1-10 | 8GB RAM, 4 vCPU | $8-48/bulan |
| 10-20 | 16GB RAM, 6 vCPU | $16-96/bulan |
| 20-40 | 32GB RAM, 8 vCPU | $32-192/bulan |
| 40+ | 2 VPS + load balancer, atau pindah ke shared-DB | Varies |

---

## Troubleshooting

### Container tidak start
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml logs tenant-[slug]
# Biasanya: DATABASE_URL salah, atau postgres belum ready
```

### Subdomain tidak bisa diakses
```bash
# 1. Cek nginx config valid
docker compose exec nginx nginx -t

# 2. Cek DNS resolve
dig garmen-sejahtera.erp-indonesia.com

# 3. Cek container running & port
docker compose -f docker-compose.yml -f docker-compose.override.yml ps

# 4. Test direct access (bypass nginx)
curl http://localhost:3001  # port tenant
```

### Migration gagal di tenant baru
```bash
DATABASE_URL="postgresql://erp_admin:PASSWORD@localhost:5432/erp_client_xxx" npx prisma migrate deploy
```

### User tidak bisa login
1. Cek user ada di Supabase Auth Dashboard
2. Cek `user_metadata.role` sudah di-set (ROLE_CEO, ROLE_MANAGER, dll)
3. Cek user record ada di database tenant:
```bash
docker compose exec postgres psql -U erp_admin -d erp_client_garmen_sejahtera -c \
  "SELECT * FROM \"User\" WHERE email = 'admin@garmen.com';"
```

### Database penuh / VPS disk habis
```bash
# Cek ukuran semua databases
docker compose exec postgres psql -U erp_admin -d postgres -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY pg_database_size(datname) DESC;"

# Hapus backup lama
find /backups -name "*.sql.gz" -mtime +7 -delete

# Vacuum database (reclaim space)
docker compose exec postgres psql -U erp_admin -d erp_client_garmen_sejahtera -c "VACUUM FULL;"
```

---

## FAQ

**Q: Data development di Supabase bagaimana?**
A: Tetap di sana untuk development. Production pakai PostgreSQL sendiri. Dua environment terpisah.

**Q: Kalau Supabase Auth down, semua tenant down?**
A: Ya, karena auth shared. Tapi Supabase uptime 99.9%. Kalau mau eliminasi risiko ini, bisa migrasi ke self-hosted auth (NextAuth/Lucia) nanti.

**Q: Bisa pakai 1 Supabase project untuk dev + prod?**
A: Bisa. Auth user di Supabase shared, tapi database per tenant di VPS sendiri. User yang sama bisa login ke tenant manapun (selama email terdaftar di database tenant tersebut).

**Q: Bagaimana kalau client minta custom domain (bukan subdomain)?**
A: Butuh development tambahan. Perlu: (1) nginx config per custom domain, (2) SSL cert per domain, (3) mapping custom domain → tenant slug. Bisa dijual sebagai add-on.
