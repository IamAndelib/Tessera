#!/usr/bin/env bash
#
# test-install.sh — Test the install.sh build pipeline across distros using podman
#
# Usage:
#   ./test-install.sh              # Test all distros
#   ./test-install.sh arch fedora  # Test specific distros
#   ./test-install.sh --host       # Test on the host (full end-to-end with kpackagetool6)
#
# Container tests cover: dependency detection, installation, build, package validation.
# Host test covers everything including kpackagetool6 install and KWin restart.
#

set -uo pipefail

if [[ -t 1 ]]; then
    RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
    BLUE='\033[0;34m' BOLD='\033[1m' NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

info()    { printf "${BLUE}::${NC} %s\n" "$*"; }
ok()      { printf "${GREEN}::${NC} %s\n" "$*"; }
warn()    { printf "${YELLOW}:: WARNING:${NC} %s\n" "$*"; }
err()     { printf "${RED}:: ERROR:${NC} %s\n" "$*" >&2; }
header()  { printf "\n${BOLD}━━━ %s ━━━${NC}\n\n" "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INNER_SCRIPT="$SCRIPT_DIR/test-inner.sh"

if [[ ! -f "$SCRIPT_DIR/install.sh" ]]; then
    err "install.sh not found in $SCRIPT_DIR"; exit 1
fi
if [[ ! -f "$INNER_SCRIPT" ]]; then
    err "test-inner.sh not found in $SCRIPT_DIR"; exit 1
fi

# ── Distro definitions ────────────────────────────────────────────
# image | display name | command to bootstrap bash+sudo inside a minimal container

declare -A DISTROS=(
    [arch]="docker.io/library/archlinux:latest|Arch Linux|pacman -Sy --noconfirm sudo"
    [fedora]="docker.io/library/fedora:latest|Fedora|dnf install -y sudo"
    [ubuntu]="docker.io/library/ubuntu:latest|Ubuntu/Kubuntu|apt-get update -qq && apt-get install -y sudo"
    [opensuse]="docker.io/opensuse/tumbleweed:latest|openSUSE Tumbleweed|zypper mr -d repo-non-oss 2>/dev/null || true; zypper -n ref 2>/dev/null || true; zypper install -y sudo"
)
DISTRO_ORDER=(arch fedora ubuntu opensuse)

PASS=0; FAIL=0
RESULTS=()

# ── Container test ────────────────────────────────────────────────

run_distro_test() {
    local key="$1"
    local entry="${DISTROS[$key]}"
    local image label setup
    IFS='|' read -r image label setup <<< "$entry"

    header "Testing: $label"

    info "Pulling $image..."
    if ! podman pull "$image" 2>&1 | tail -1; then
        err "Failed to pull $image"
        RESULTS+=("FAIL  $label  (image pull failed)")
        ((FAIL++))
        return
    fi

    info "Running build test in container..."
    if podman run --rm \
        -v "$SCRIPT_DIR:/mnt/project:ro,Z" \
        "$image" \
        bash -c "$setup && rm -rf /workspace && cp -r /mnt/project /workspace && rm -rf /workspace/node_modules /workspace/.git /workspace/pkg /workspace/tessera.kwinscript /workspace/tessera.mjs && bash /workspace/test-inner.sh"; then
        ok "$label — all checks passed"
        RESULTS+=("PASS  $label")
        ((PASS++))
    else
        err "$label — checks failed (see output above)"
        RESULTS+=("FAIL  $label")
        ((FAIL++))
    fi
}

# ── Host test ─────────────────────────────────────────────────────

run_host_test() {
    header "Testing: Host (live KDE session)"

    if ! command -v kpackagetool6 &>/dev/null; then
        err "kpackagetool6 not found — is KDE Plasma 6 installed?"
        RESULTS+=("FAIL  Host (no kpackagetool6)")
        ((FAIL++))
        return
    fi

    info "Running install.sh on host (non-interactive)..."
    # Pipe to stdin so [[ -t 0 ]] is false, triggering non-interactive mode
    if echo "" | bash "$SCRIPT_DIR/install.sh"; then
        ok "install.sh completed successfully on host"
    else
        err "install.sh failed on host"
        RESULTS+=("FAIL  Host")
        ((FAIL++))
        return
    fi

    # Verify installation
    if kpackagetool6 -t KWin/Script -s tessera &>/dev/null; then
        ok "tessera is installed in KWin"
    else
        err "tessera NOT found in KWin after install"
        RESULTS+=("FAIL  Host (not installed)")
        ((FAIL++))
        return
    fi

    RESULTS+=("PASS  Host (end-to-end)")
    ((PASS++))

    echo
    info "Cleaning up: removing tessera from KWin..."
    kpackagetool6 -t KWin/Script -r tessera &>/dev/null || true
    ok "Cleaned up"
}

# ── Main ──────────────────────────────────────────────────────────

HOST_TEST=false
SELECTED=()

for arg in "$@"; do
    case "$arg" in
        --host)
            HOST_TEST=true ;;
        --help|-h)
            echo "Usage: $0 [--host] [arch|fedora|ubuntu|opensuse ...]"
            echo ""
            echo "  (no args)     Test all container distros"
            echo "  --host        Run end-to-end test on the host with kpackagetool6"
            echo "  arch fedora   Test specific distros only"
            exit 0 ;;
        *)
            if [[ -v "DISTROS[$arg]" ]]; then
                SELECTED+=("$arg")
            else
                err "Unknown distro: $arg (available: ${DISTRO_ORDER[*]})"
                exit 1
            fi ;;
    esac
done

# Default: all container distros if none specified
if [[ ${#SELECTED[@]} -eq 0 ]] && [[ "$HOST_TEST" == false ]]; then
    SELECTED=("${DISTRO_ORDER[@]}")
fi

header "Tessera install.sh — Test Suite"
info "Project: $SCRIPT_DIR"
if [[ ${#SELECTED[@]} -gt 0 ]]; then
    info "Container tests: ${SELECTED[*]}"
fi
if [[ "$HOST_TEST" == true ]]; then
    info "Host test: enabled"
fi

# Need podman for container tests
if [[ ${#SELECTED[@]} -gt 0 ]]; then
    if ! command -v podman &>/dev/null; then
        err "podman is required for container tests. Install with: sudo pacman -S podman"
        exit 1
    fi
    for distro in "${SELECTED[@]}"; do
        run_distro_test "$distro"
    done
fi

if [[ "$HOST_TEST" == true ]]; then
    run_host_test
fi

# ── Summary ───────────────────────────────────────────────────────

header "Summary"
for r in "${RESULTS[@]}"; do
    case "$r" in
        PASS*) printf "  ${GREEN}%s${NC}\n" "$r" ;;
        FAIL*) printf "  ${RED}%s${NC}\n" "$r" ;;
    esac
done
echo
printf '  Passed: %b%s%b   Failed: %b%s%b\n' "$GREEN" "$PASS" "$NC" "$RED" "$FAIL" "$NC"
echo

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
