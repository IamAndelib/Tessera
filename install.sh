#!/usr/bin/env bash
#
# install.sh — Build and install Tessera KWin tiling script
# Works on any Linux distro running KDE Plasma 6
#

set -uo pipefail

# --- Colors (disabled when not writing to a terminal) ---
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

info()  { printf "${BLUE}::${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}::${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}:: WARNING:${NC} %s\n" "$*"; }
err()   { printf "${RED}:: ERROR:${NC} %s\n" "$*" >&2; }

die() { err "$@"; exit 1; }

# --- Cleanup trap ---
BUILD_ARTIFACTS=(pkg tessera.kwinscript tessera.mjs)
CLEANUP_ON_FAILURE=false

cleanup() {
    if [[ "$CLEANUP_ON_FAILURE" == true ]]; then
        for f in "${BUILD_ARTIFACTS[@]}"; do
            rm -rf "$f" 2>/dev/null || true
        done
    fi
}
trap cleanup EXIT

# --- Pre-flight checks ---

if [[ $EUID -eq 0 ]]; then
    die "Do not run this script as root." \
        "It uses sudo for package installation, and installs the KWin script to your user directory."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || die "Failed to cd into $SCRIPT_DIR"

if [[ ! -f Makefile ]] || [[ ! -f package.json ]]; then
    die "Cannot find Makefile and package.json in $SCRIPT_DIR"
fi

if [[ ! -f src/index.ts ]]; then
    die "Source file src/index.ts not found. Is this the correct project directory?"
fi

info "Installing Tessera — Hyprland-style dwindle tiling for KDE Plasma 6"
echo

# --- Detect package manager ---

detect_pkg_manager() {
    if command -v pacman &>/dev/null; then
        echo "pacman"
    elif command -v dnf &>/dev/null; then
        echo "dnf"
    elif command -v apt-get &>/dev/null; then
        echo "apt"
    elif command -v zypper &>/dev/null; then
        echo "zypper"
    elif command -v xbps-install &>/dev/null; then
        echo "xbps"
    elif command -v apk &>/dev/null; then
        echo "apk"
    elif command -v emerge &>/dev/null; then
        echo "portage"
    elif command -v nix-env &>/dev/null; then
        echo "nix"
    else
        echo "unknown"
    fi
}

PKG_MANAGER="$(detect_pkg_manager)"
info "Detected package manager: $PKG_MANAGER"

# Map: command name -> distro package name
get_pkg_name() {
    local dep="$1"
    case "$PKG_MANAGER" in
        pacman)
            case "$dep" in
                npm)  echo "npm" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        dnf)
            case "$dep" in
                npm)  echo "npm" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        apt)
            case "$dep" in
                npm)  echo "npm" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        zypper)
            case "$dep" in
                npm)  echo "npm-default" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        xbps)
            case "$dep" in
                npm)  echo "nodejs" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        apk)
            case "$dep" in
                npm)  echo "npm" ;;
                make) echo "make" ;;
                zip)  echo "zip" ;;
                *)    echo "$dep" ;;
            esac ;;
        *)
            echo "$dep" ;;
    esac
}

install_packages() {
    local pkgs=("$@")
    case "$PKG_MANAGER" in
        pacman)  sudo pacman -S --needed --noconfirm "${pkgs[@]}" ;;
        dnf)     sudo dnf install -y "${pkgs[@]}" ;;
        apt)     sudo apt-get update -qq && sudo apt-get install -y "${pkgs[@]}" ;;
        zypper)  sudo zypper install -y "${pkgs[@]}" ;;
        xbps)    sudo xbps-install -Sy "${pkgs[@]}" ;;
        apk)     sudo apk add "${pkgs[@]}" ;;
        portage)
            warn "Gentoo detected. Install these packages manually: ${pkgs[*]}"
            warn "Then re-run this script."
            exit 1 ;;
        nix)
            warn "Nix detected. Install these packages via nix-env or your flake: ${pkgs[*]}"
            warn "Then re-run this script."
            exit 1 ;;
        *)
            err "Could not detect a supported package manager."
            die "Please install the following manually, then re-run: ${pkgs[*]}"
            ;;
    esac
}

# --- Dependency resolution ---

REQUIRED_CMDS=(npm make zip)
MISSING_PKGS=()

for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v "$cmd" &>/dev/null; then
        pkg="$(get_pkg_name "$cmd")"
        if [[ -n "$pkg" ]]; then
            MISSING_PKGS+=("$pkg")
        fi
        warn "'$cmd' not found (need package: $pkg)"
    fi
done

# kpackagetool6 ships with KDE Plasma 6 — if missing, KDE isn't properly installed
if ! command -v kpackagetool6 &>/dev/null; then
    err "kpackagetool6 not found."
    err "This tool is part of KDE Plasma 6 and should be present on any KDE installation."
    err "Make sure KDE Plasma 6 (and the kwin/kpackage packages) are installed."
    case "$PKG_MANAGER" in
        pacman)  err "Try: sudo pacman -S kwin" ;;
        dnf)     err "Try: sudo dnf install kwin kf6-kpackage" ;;
        apt)     err "Try: sudo apt install kwin-common" ;;
        zypper)  err "Try: sudo zypper install kwin6 kf6-kpackage-tools" ;;
        xbps)    err "Try: sudo xbps-install kwin" ;;
        *)       err "Install kwin / kpackage for your distribution." ;;
    esac
    exit 1
fi

if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
    info "Missing packages: ${MISSING_PKGS[*]}"
    if [[ -t 0 ]]; then
        read -rp "Install them now? [Y/n] " answer
        if [[ "${answer,,}" == "n" ]]; then
            die "Cannot continue without: ${MISSING_PKGS[*]}"
        fi
    else
        info "Non-interactive mode: installing automatically."
    fi
    if ! install_packages "${MISSING_PKGS[@]}"; then
        die "Package installation failed. Check the output above."
    fi
    # Verify commands are now available after install
    for cmd in "${REQUIRED_CMDS[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            die "'$cmd' still not found after package installation. Check your package manager output above."
        fi
    done
    ok "Dependencies installed."
else
    ok "All dependencies are present."
fi

echo

# --- Build ---

CLEANUP_ON_FAILURE=true

info "Cleaning previous build artifacts..."
rm -rf "${BUILD_ARTIFACTS[@]}"

info "Installing npm dependencies..."
if ! npm install --no-fund --no-audit; then
    die "npm install failed. Check the output above."
fi
ok "npm dependencies ready."

info "Bundling TypeScript with esbuild..."
if ! npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral; then
    die "esbuild bundling failed. Check the output above."
fi
ok "Bundle created."

info "Assembling package..."
if ! make res src; then
    die "Package assembly failed. Check the output above."
fi
ok "Package assembled."

info "Creating kwinscript archive..."
if ! zip -rq tessera.kwinscript pkg; then
    die "zip packaging failed."
fi
ok "tessera.kwinscript created."

echo

# --- Install ---

info "Installing KWin script..."
if kpackagetool6 -t KWin/Script -s tessera &>/dev/null; then
    info "Existing installation found, upgrading..."
    if ! kpackagetool6 -t KWin/Script -u tessera.kwinscript; then
        die "kpackagetool6 upgrade failed. Check the output above."
    fi
else
    info "Fresh install..."
    if ! kpackagetool6 -t KWin/Script -i tessera.kwinscript; then
        die "kpackagetool6 install failed. Check the output above."
    fi
fi
ok "Tessera installed successfully."

echo

# --- Clean up build artifacts ---

info "Cleaning up build artifacts..."
rm -rf "${BUILD_ARTIFACTS[@]}"
CLEANUP_ON_FAILURE=false
ok "Clean."

echo

# --- Post-install ---

printf '%b%bTessera has been installed!%b\n' "$GREEN" "$BOLD" "$NC"
echo
echo "Next steps:"
echo "  1. Enable the script:  System Settings > Window Management > KWin Scripts > Tessera"
echo "  2. Configure shortcuts: System Settings > Shortcuts > KWin (search 'Tessera')"
echo "  3. Restart KWin to load the script."
echo

if [[ -t 0 ]]; then
    read -rp "Restart KWin now? [y/N] " answer
    if [[ "${answer,,}" == "y" ]]; then
        info "Restarting KWin..."
        restart_ok=false
        if command -v qdbus6 &>/dev/null; then
            qdbus6 org.kde.KWin /KWin reconfigure && restart_ok=true
        elif command -v qdbus &>/dev/null; then
            qdbus org.kde.KWin /KWin reconfigure && restart_ok=true
        else
            dbus-send --session --dest=org.kde.KWin --type=method_call /KWin org.kde.KWin.reconfigure && restart_ok=true
        fi
        if [[ "$restart_ok" == true ]]; then
            ok "KWin restarted. Tessera should now be active (if enabled in settings)."
        else
            warn "Could not restart KWin. Restart it manually with: qdbus6 org.kde.KWin /KWin reconfigure"
        fi
    else
        echo "You can restart KWin later with: qdbus6 org.kde.KWin /KWin reconfigure"
    fi
else
    info "Non-interactive mode: restart KWin manually with: qdbus6 org.kde.KWin /KWin reconfigure"
fi
