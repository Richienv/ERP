#!/usr/bin/env bash
# ================================
# Provision a new tenant
# ================================
# Usage:
#   ./scripts/provision-tenant.sh \
#     --slug garmen-sejahtera \
#     --name "PT Garmen Sejahtera" \
#     --email admin@garmen.com \
#     --plan PRO
#
# Prerequisites:
#   - Docker Compose running (postgres + nginx)
#   - .env file with POSTGRES_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY

set -euo pipefail

# ---- Parse arguments ----
SLUG=""
NAME=""
EMAIL=""
PLAN="STARTER"
PORT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --slug)   SLUG="$2";  shift 2 ;;
        --name)   NAME="$2";  shift 2 ;;
        --email)  EMAIL="$2"; shift 2 ;;
        --plan)   PLAN="$2";  shift 2 ;;
        --port)   PORT="$2";  shift 2 ;;
        *)        echo "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ -z "$SLUG" || -z "$NAME" || -z "$EMAIL" ]]; then
    echo "Error: --slug, --name, and --email are required"
    echo "Usage: $0 --slug <slug> --name <name> --email <email> [--plan STARTER|PRO|ENTERPRISE] [--port <port>]"
    exit 1
fi

# ---- Load env ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

DB_USER="${POSTGRES_USER:-erp_admin}"
DB_PASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="erp_client_${SLUG//-/_}"

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL must be set}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY must be set}"

# Auto-assign port if not provided (start from 3001, find next available)
if [[ -z "$PORT" ]]; then
    EXISTING_PORTS=$(docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.override.yml" config 2>/dev/null | grep -oP '"\d+:3000"' | grep -oP '^\d+' || echo "3000")
    PORT=3001
    while echo "$EXISTING_PORTS" | grep -q "^${PORT}$"; do
        PORT=$((PORT + 1))
    done
fi

echo "========================================"
echo "  Provisioning Tenant: $NAME"
echo "========================================"
echo "  Slug:     $SLUG"
echo "  Plan:     $PLAN"
echo "  Email:    $EMAIL"
echo "  Database: $DB_NAME"
echo "  Port:     $PORT"
echo "========================================"

# ---- Step 1: Create database ----
echo ""
echo "[1/6] Creating database $DB_NAME..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 && {
    echo "  Database already exists, skipping."
} || {
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
        "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
    # Enable uuid extension
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    echo "  Done."
}

# ---- Step 2: Run Prisma migrations ----
echo ""
echo "[2/6] Running Prisma migrations..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    npx prisma migrate deploy --schema "$PROJECT_DIR/prisma/schema.prisma"
echo "  Done."

# ---- Step 3: Determine enabled modules from plan ----
echo ""
echo "[3/6] Resolving modules for plan: $PLAN..."

case "$PLAN" in
    STARTER)
        MODULES="INVENTORY,SALES,PROCUREMENT"
        MAX_USERS=5
        ;;
    PRO)
        MODULES="INVENTORY,SALES,PROCUREMENT,FINANCE,MANUFACTURING,SUBCONTRACT,CUTTING"
        MAX_USERS=15
        ;;
    ENTERPRISE)
        MODULES="INVENTORY,SALES,PROCUREMENT,FINANCE,MANUFACTURING,SUBCONTRACT,CUTTING,HCM,COSTING"
        MAX_USERS=999
        ;;
    *)
        echo "Error: Unknown plan '$PLAN'. Use STARTER, PRO, or ENTERPRISE."
        exit 1
        ;;
esac
echo "  Modules: $MODULES"

# ---- Step 4: Seed tenant data ----
echo ""
echo "[4/6] Seeding tenant data..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    npx tsx "$PROJECT_DIR/scripts/seed-tenant.ts" \
        --slug "$SLUG" \
        --name "$NAME" \
        --email "$EMAIL" \
        --plan "$PLAN" \
        --modules "$MODULES" \
        --maxUsers "$MAX_USERS"
echo "  Done."

# ---- Step 5: Generate nginx config ----
echo ""
echo "[5/6] Generating nginx config..."
NGINX_CONF_DIR="$PROJECT_DIR/infra/tenants"
mkdir -p "$NGINX_CONF_DIR"
sed "s/__TENANT_SLUG__/$SLUG/g" "$PROJECT_DIR/infra/nginx-tenant.conf.template" \
    > "$NGINX_CONF_DIR/${SLUG}.conf"
echo "  Created: infra/tenants/${SLUG}.conf"

# ---- Step 6: Add docker-compose override ----
echo ""
echo "[6/6] Adding Docker service..."

OVERRIDE_FILE="$PROJECT_DIR/docker-compose.override.yml"

# Create override file if it doesn't exist
if [[ ! -f "$OVERRIDE_FILE" ]]; then
    cat > "$OVERRIDE_FILE" <<YAMLEOF
services:
YAMLEOF
fi

# Append tenant service
cat >> "$OVERRIDE_FILE" <<YAMLEOF

  tenant-${SLUG}:
    build: .
    restart: unless-stopped
    ports:
      - "${PORT}:3000"
    environment:
      - TENANT_SLUG=${SLUG}
      - ENABLED_MODULES=${MODULES}
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
      - DIRECT_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      postgres:
        condition: service_healthy
YAMLEOF

echo "  Added tenant-${SLUG} service on port ${PORT}"

# ---- Summary ----
echo ""
echo "========================================"
echo "  Tenant provisioned successfully!"
echo "========================================"
echo ""
echo "  URL:    http://${SLUG}.erp-indonesia.com"
echo "  Login:  $EMAIL"
echo "  Plan:   $PLAN ($MODULES)"
echo "  Port:   $PORT"
echo ""
echo "  Next steps:"
echo "    1. docker compose -f docker-compose.yml -f docker-compose.override.yml up -d tenant-${SLUG}"
echo "    2. docker compose exec nginx nginx -s reload"
echo "    3. Send credentials to client"
echo ""
