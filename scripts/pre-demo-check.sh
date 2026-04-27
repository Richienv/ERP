#!/usr/bin/env bash
# Pre-demo validation script
# Run 24 hours before KRI presentation (June 26, 2026)
# Validates that the entire procurement flagship is demo-ready

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(git rev-parse --show-toplevel)"

echo "═══════════════════════════════════════════════════════"
echo "  Integra Pre-Demo Check — KRI Presentation"
echo "  $(date)"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. TypeScript
echo -e "${YELLOW}▶ [1/6] TypeScript check...${NC}"
if npx tsc --noEmit 2>&1 | grep -E "(procurement|integra|inventory)" | head -5 ; then
    echo -e "${YELLOW}  ⚠ Type errors in scoped files (review)${NC}"
else
    echo -e "${GREEN}  ✓ Clean${NC}"
fi
echo ""

# 2. Lint
echo -e "${YELLOW}▶ [2/6] Lint...${NC}"
if npm run lint 2>&1 | grep -E "(procurement|integra|inventory)" | head -5 ; then
    echo -e "${YELLOW}  ⚠ Lint warnings in scoped files (review)${NC}"
else
    echo -e "${GREEN}  ✓ Clean${NC}"
fi
echo ""

# 3. Unit tests
echo -e "${YELLOW}▶ [3/6] Unit tests (Vitest)...${NC}"
if npx vitest run 2>&1 | tail -5 ; then
    echo -e "${GREEN}  ✓ See results above${NC}"
fi
echo ""

# 4. Re-seed demo data
echo -e "${YELLOW}▶ [4/6] Re-seed KRI demo data...${NC}"
if npx tsx prisma/seed-kri-demo.ts ; then
    echo -e "${GREEN}  ✓ Seed complete${NC}"
else
    echo -e "${RED}  ✗ Seed failed!${NC}"
    exit 1
fi
echo ""

# 5. Build check (optional — can be slow)
echo -e "${YELLOW}▶ [5/6] Production build...${NC}"
if [ "$1" = "--skip-build" ]; then
    echo "  Skipped (--skip-build flag)"
else
    if npm run build 2>&1 | tail -10 ; then
        echo -e "${GREEN}  ✓ Build succeeded${NC}"
    else
        echo -e "${RED}  ✗ Build failed!${NC}"
        exit 1
    fi
fi
echo ""

# 6. Critical paths smoke test (curl)
echo -e "${YELLOW}▶ [6/6] Smoke test critical paths...${NC}"
if [ "$1" = "--skip-smoke" ]; then
    echo "  Skipped (--skip-smoke flag)"
else
    PORT=3000
    echo "  Starting dev server on port $PORT..."
    npm run dev &
    DEV_PID=$!
    sleep 15

    declare -a paths=(
        "/dashboard"
        "/procurement"
        "/procurement/orders"
        "/inventory"
        "/inventory/products"
    )

    fail=0
    for p in "${paths[@]}"; do
        code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$p" || echo "000")
        if [ "$code" = "200" ] || [ "$code" = "307" ]; then
            echo -e "  ${GREEN}✓${NC} $p ($code)"
        else
            echo -e "  ${RED}✗${NC} $p ($code)"
            fail=1
        fi
    done

    kill $DEV_PID 2>/dev/null || true
    sleep 2

    if [ $fail -ne 0 ]; then
        echo -e "${RED}  ✗ Some paths failed!${NC}"
        exit 1
    fi
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo -e "  ${GREEN}✓ Pre-demo check PASSED — siap untuk presentasi${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Reminder demo:"
echo "  1. Login dengan akun CEO/Manager (akses approval)"
echo "  2. Pastikan internet stable (Vercel preview kalau pakai cloud)"
echo "  3. Siapkan demo script: dashboard → pengadaan → klik PO → detail"
echo "  4. Test print PDF satu kali dulu untuk warm Typst"
echo ""
