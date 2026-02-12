#!/usr/bin/env bash
#
# test-inner.sh — Runs inside a container to test the build pipeline
#
# This script is called by test-install.sh and should NOT be run directly.
# It replicates the build steps from install.sh (skipping kpackagetool6)
# and validates the resulting package.
#

set -uo pipefail

PASS=0
FAIL=0

if [[ -t 1 ]]; then
    RED='\033[0;31m' GREEN='\033[0;32m'
    BLUE='\033[0;34m' BOLD='\033[1m' NC='\033[0m'
else
    RED='' GREEN='' BLUE='' BOLD='' NC=''
fi

info()    { printf "${BLUE}::${NC} %s\n" "$*"; }
ok()      { printf "${GREEN}  PASS${NC} %s\n" "$*"; ((PASS++)); }
fail()    { printf "${RED}  FAIL${NC} %s\n" "$*" >&2; ((FAIL++)); }

WORKDIR="${1:-/workspace}"
cd "$WORKDIR" || { fail "Cannot cd into $WORKDIR"; exit 1; }

# ── Step 1: Detect package manager (same logic as install.sh) ────

detect_pkg_manager() {
    if command -v pacman &>/dev/null; then echo "pacman"
    elif command -v dnf &>/dev/null; then echo "dnf"
    elif command -v apt-get &>/dev/null; then echo "apt"
    elif command -v zypper &>/dev/null; then echo "zypper"
    else echo "unknown"
    fi
}

PKG_MANAGER="$(detect_pkg_manager)"
info "Detected package manager: $PKG_MANAGER"

# ── Step 2: Install build dependencies ───────────────────────────

info "Installing build dependencies..."
case "$PKG_MANAGER" in
    pacman)
        pacman -Sy --noconfirm npm make zip unzip sed ;;
    dnf)
        dnf install -y npm make zip unzip sed ;;
    apt)
        apt-get update -qq && apt-get install -y npm make zip unzip sed ;;
    zypper)
        zypper mr -d repo-non-oss 2>/dev/null || true
        zypper -n ref 2>/dev/null || true
        zypper install -y npm-default make zip unzip sed ;;
    *)
        fail "Unsupported package manager: $PKG_MANAGER"
        exit 1 ;;
esac
dep_status=$?

if [[ $dep_status -ne 0 ]]; then
    fail "Dependency installation failed"
    exit 1
fi

# Verify required commands
for cmd in npm make zip unzip sed; do
    if command -v "$cmd" &>/dev/null; then
        ok "$cmd is available"
    else
        fail "$cmd not found after installation"
    fi
done

# ── Step 3: Verify install.sh detects the package manager ───────

info "Testing install.sh package manager detection..."
# Source just the detect function from install.sh to verify it works
detected=$(bash -c 'source /dev/stdin <<< "$(sed -n "/^detect_pkg_manager/,/^}/p" install.sh)"; detect_pkg_manager')
if [[ -n "$detected" && "$detected" != "unknown" ]]; then
    ok "install.sh detects package manager: $detected"
else
    fail "install.sh failed to detect package manager (got: '$detected')"
fi

# ── Step 4: Verify project structure ────────────────────────────

info "Checking project structure..."
for f in Makefile package.json src/index.ts res/metadata.json res/main.xml res/config.ui res/main.js; do
    if [[ -f "$f" ]]; then
        ok "Found $f"
    else
        fail "Missing $f"
    fi
done

# ── Step 5: Clean pre-existing build artifacts ──────────────────

info "Cleaning any pre-existing build artifacts..."
rm -rf pkg tessera.kwinscript tessera.mjs

# ── Step 6: npm install ─────────────────────────────────────────

info "Running npm install..."
if npm install --no-fund --no-audit; then
    ok "npm install succeeded"
else
    fail "npm install failed"
    exit 1
fi

# ── Step 7: esbuild bundle ──────────────────────────────────────

info "Bundling TypeScript with esbuild..."
if npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral; then
    ok "esbuild bundle created"
else
    fail "esbuild bundling failed"
    exit 1
fi

if [[ -f tessera.mjs ]]; then
    ok "tessera.mjs exists"
    size=$(stat -c%s tessera.mjs 2>/dev/null || stat -f%z tessera.mjs 2>/dev/null || echo 0)
    if [[ "$size" -gt 0 ]]; then
        ok "tessera.mjs is non-empty (${size} bytes)"
    else
        fail "tessera.mjs is empty"
    fi
else
    fail "tessera.mjs not created"
    exit 1
fi

# ── Step 8: make res src (assemble package directory) ───────────

info "Assembling package with make..."
if make res src; then
    ok "make res src succeeded"
else
    fail "make res src failed"
    exit 1
fi

# ── Step 9: Validate package directory structure ────────────────

info "Validating package directory..."
EXPECTED_FILES=(
    pkg/metadata.json
    pkg/contents/code/main.js
    pkg/contents/code/main.mjs
    pkg/contents/config/main.xml
    pkg/contents/ui/config.ui
    pkg/contents/ui/main.qml
    pkg/contents/ui/shortcuts.qml
    pkg/contents/ui/settings.qml
    pkg/contents/ui/dbus.qml
    pkg/contents/ui/osd.qml
)

for f in "${EXPECTED_FILES[@]}"; do
    if [[ -f "$f" ]]; then
        ok "Package contains $f"
    else
        fail "Package missing $f"
    fi
done

# ── Step 10: Validate metadata.json placeholder replacement ────

info "Checking metadata.json placeholders..."
if [[ -f pkg/metadata.json ]]; then
    if grep -q '%NAME%' pkg/metadata.json; then
        fail "metadata.json still contains %NAME% placeholder"
    else
        ok "%NAME% placeholder replaced"
    fi
    if grep -q '%VERSION%' pkg/metadata.json; then
        fail "metadata.json still contains %VERSION% placeholder"
    else
        ok "%VERSION% placeholder replaced"
    fi
    # Verify the actual values
    if grep -q '"Id": "tessera"' pkg/metadata.json; then
        ok "metadata.json Id is 'tessera'"
    else
        fail "metadata.json Id is not 'tessera'"
    fi
    if grep -q '"Version": "1.0.0"' pkg/metadata.json; then
        ok "metadata.json Version is '1.0.0'"
    else
        fail "metadata.json Version not set correctly"
    fi
else
    fail "pkg/metadata.json does not exist"
fi

# ── Step 11: Create and validate the kwinscript zip ─────────────

info "Creating kwinscript archive..."
if zip -rq tessera.kwinscript pkg; then
    ok "zip created tessera.kwinscript"
else
    fail "zip failed to create tessera.kwinscript"
fi

if [[ -f tessera.kwinscript ]]; then
    # Verify zip contents
    zip_contents=$(unzip -l tessera.kwinscript 2>/dev/null)
    for entry in pkg/metadata.json pkg/contents/code/main.mjs pkg/contents/ui/main.qml; do
        if echo "$zip_contents" | grep -q "$entry"; then
            ok "kwinscript zip contains $entry"
        else
            fail "kwinscript zip missing $entry"
        fi
    done
else
    fail "tessera.kwinscript not created"
fi

# ── Summary ─────────────────────────────────────────────────────

echo
printf '%b━━━ Inner Test Summary ━━━%b\n' "$BOLD" "$NC"
printf '  Passed: %b%s%b   Failed: %b%s%b\n' "$GREEN" "$PASS" "$NC" "$RED" "$FAIL" "$NC"
echo

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
