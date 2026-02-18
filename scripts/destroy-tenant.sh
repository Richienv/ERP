#!/usr/bin/env bash
# ================================
# Destroy a tenant (remove container, database, nginx config)
# ================================
# Usage:
#   ./scripts/destroy-tenant.sh --slug garmen-sejahtera
#
# WARNING: This permanently deletes the tenant's database!

set -euo pipefail

SLUG=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --slug)   SLUG="$2";  shift 2 ;;
        --force)  FORCE=true;  shift ;;
        *)        echo "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ -z "$SLUG" ]]; then
    echo "Error: --slug is required"
    echo "Usage: $0 --slug <slug> [--force]"
    exit 1
fi

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

echo "========================================"
echo "  Destroying Tenant: $SLUG"
echo "========================================"
echo "  Database: $DB_NAME"
echo "========================================"

if [[ "$FORCE" != true ]]; then
    echo ""
    read -p "  Are you sure? This will DELETE the database permanently. [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "  Aborted."
        exit 0
    fi
fi

# ---- Step 1: Stop Docker container ----
echo ""
echo "[1/3] Stopping Docker container..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.override.yml" \
    stop "tenant-${SLUG}" 2>/dev/null || echo "  Container not found or already stopped."
docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.override.yml" \
    rm -f "tenant-${SLUG}" 2>/dev/null || true

# ---- Step 2: Drop database ----
echo ""
echo "[2/3] Dropping database $DB_NAME..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$DB_NAME\";"
echo "  Done."

# ---- Step 3: Remove nginx config ----
echo ""
echo "[3/3] Removing nginx config..."
rm -f "$PROJECT_DIR/infra/tenants/${SLUG}.conf"
echo "  Done."

echo ""
echo "========================================"
echo "  Tenant $SLUG destroyed."
echo "========================================"
echo ""
echo "  Next steps:"
echo "    1. Remove tenant-${SLUG} section from docker-compose.override.yml"
echo "    2. docker compose exec nginx nginx -s reload"
echo ""
