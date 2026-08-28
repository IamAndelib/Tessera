#!/usr/bin/env bash
#
# install.sh — Build and install Tessera KWin tiling script
#
# Works on any Linux distro running KDE Plasma 6. Detects your package
# manager, installs missing build dependencies, builds Tessera from source
# via the Makefile, and installs it as a KWin script.
#
# Usage:
#   ./install.sh                 # build and install
#   ./install.sh --restart       # restart KWin after installing
#   ./install.sh --skip-deps     # skip dependency checks/installation
#   ./install.sh --uninstall     # remove Tessera from KWin
#   ./install.sh --help          # show this help
#
# Note: functions are kept sourceable (no side effects at import time)
# so dev/test-inner.sh can reuse them.

set -euo pipefail

info() { printf ':: %s\n' "$*"; }
ok()   { printf ':: %s\n' "$*"; }
warn() { printf ':: WARNING: %s\n' "$*"; }
err()  { printf ':: ERROR: %s\n' "$*" >&2; }
die()  { err "$@"; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./install.sh [options]

Build and install Tessera as a KWin script.

Options:
  --restart       Restart KWin after installing
  --skip-deps     Skip build dependency checks and installation
  --uninstall     Remove Tessera from KWin
  --help, -h      Show this help
EOF
}

cmd_exists() { command -v "$1" &>/dev/null; }

# node may be installed as `nodejs` on Debian-based distros
dep_present() {
    local cmd="$1"
    if [[ "$cmd" == node ]]; then
        cmd_exists node || cmd_exists nodejs
    else
        cmd_exists "$cmd"
    fi
}

# --- Uninstall ---------------------------------------------------------

uninstall_script() {
    if kpackagetool6 -t KWin/Script -s tessera &>/dev/null; then
        info "Removing Tessera..."
        kpackagetool6 -t KWin/Script -r tessera
        ok "Tessera uninstalled."
    else
        info "Tessera is not installed — nothing to do."
    fi
}

# --- Dependency resolution ---------------------------------------------

REQUIRED_CMDS=(node npm make zip kpackagetool6)

detect_pkg_manager() {
    if cmd_exists pacman; then          echo "pacman"
    elif cmd_exists dnf; then           echo "dnf"
    elif cmd_exists apt-get; then       echo "apt"
    elif cmd_exists zypper; then        echo "zypper"
    elif cmd_exists xbps-install; then  echo "xbps"
    elif cmd_exists apk; then           echo "apk"
    else                                echo "unknown"
    fi
}

get_pkg_name() {
    local dep="$1"
    case "$dep" in
        node)            echo "nodejs" ;;
        npm)             # zypper ships npm as npm-default
                         [[ "$PKG_MANAGER" == "zypper" ]] && echo "npm-default" || echo "npm" ;;
        make)            echo "make" ;;
        zip)             echo "zip" ;;
        kpackagetool6)   echo "" ;; # ships with Plasma 6
        *)               echo "$dep" ;;
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
        *)
            die "Unsupported package manager. Please install manually and re-run: ${pkgs[*]}"
            ;;
    esac
}

resolve_deps() {
    [[ "$SKIP_DEPS" == true ]] && return 0

    PKG_MANAGER="$(detect_pkg_manager)"
    if [[ "$PKG_MANAGER" == "unknown" ]]; then
        warn "Could not detect a supported package manager — assuming build dependencies are installed."
    fi

    local missing=() pkg_name
    for cmd in "${REQUIRED_CMDS[@]}"; do
        if dep_present "$cmd"; then
            continue
        fi
        pkg_name="$(get_pkg_name "$cmd")"
        if [[ -n "$pkg_name" ]]; then
            missing+=("$pkg_name")
        else
            warn "'$cmd' is missing and has no auto-install package — install it manually."
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        ok "All dependencies are present."
        return 0
    fi

    if ! cmd_exists sudo; then
        die "sudo is required to install: ${missing[*]}"
    fi

    info "Installing missing packages: ${missing[*]}"
    install_packages "${missing[@]}"

    for cmd in "${REQUIRED_CMDS[@]}"; do
        if ! dep_present "$cmd"; then
            die "'$cmd' still not found after package installation."
        fi
    done
    ok "Dependencies installed."
}

# --- Build -------------------------------------------------------------

verify_package() {
    if [[ ! -f tessera.kwinscript || ! -s tessera.kwinscript ]]; then
        die "Build did not produce tessera.kwinscript."
    fi
    if grep -q '%VERSION%\|%NAME%' pkg/metadata.json; then
        die "metadata.json placeholders were not resolved — build is broken."
    fi
    if ! cmd_exists unzip; then
        warn "unzip not available — skipping package structure check."
        return 0
    fi
    local contents entry
    contents="$(unzip -l tessera.kwinscript 2>/dev/null)" || contents=""
    for entry in pkg/metadata.json pkg/contents/code/main.mjs pkg/contents/ui/main.qml; do
        if ! printf '%s\n' "$contents" | grep -qF "$entry"; then
            die "Package is missing expected entry: $entry"
        fi
    done
}

build() {
    info "Building Tessera..."
    rm -rf pkg tessera.kwinscript
    if ! make build; then
        die "Build failed. Check the output above."
    fi
    verify_package
    ok "Build complete."
}

# --- Install -----------------------------------------------------------

install_script() {
    if kpackagetool6 -t KWin/Script -s tessera &>/dev/null; then
        info "Existing installation found, upgrading..."
        kpackagetool6 -t KWin/Script -u tessera.kwinscript
        ok "Tessera upgraded."
    else
        info "Installing Tessera..."
        kpackagetool6 -t KWin/Script -i tessera.kwinscript
        ok "Tessera installed."
    fi
}

# --- Post-install ------------------------------------------------------

restart_kwin() {
    if cmd_exists qdbus6; then
        qdbus6 org.kde.KWin /KWin reconfigure
    elif cmd_exists qdbus; then
        qdbus org.kde.KWin /KWin reconfigure
    else
        dbus-send --session --dest=org.kde.KWin --type=method_call /KWin org.kde.KWin.reconfigure
    fi
}

post_install() {
    echo
    printf 'Tessera has been installed!\n'
    echo
    echo "Next steps:"
    echo "  1. Enable it:     System Settings > Window Management > KWin Scripts > Tessera"
    echo "  2. Shortcuts:     System Settings > Shortcuts > Window Management (search 'Tessera')"
    echo
    if [[ "$RESTART" == true ]]; then
        info "Restarting KWin..."
        if restart_kwin; then
            ok "KWin reconfigured."
        else
            warn "Could not restart KWin. Run: qdbus6 org.kde.KWin /KWin reconfigure"
        fi
    else
        info "Restart KWin when ready with: qdbus6 org.kde.KWin /KWin reconfigure"
    fi
}

# --- Main --------------------------------------------------------------

cleanup() {
    rm -rf pkg tessera.mjs tessera.kwinscript
}

main() {
    local arg

    RESTART=false
    SKIP_DEPS=false
    UNINSTALL=false

    for arg in "$@"; do
        case "$arg" in
            --restart)     RESTART=true ;;
            --skip-deps)   SKIP_DEPS=true ;;
            --uninstall)   UNINSTALL=true ;;
            --help|-h)     usage; return 0 ;;
            *)
                err "Unknown option: $arg"
                usage >&2
                return 1
                ;;
        esac
    done

    trap cleanup EXIT

    # --- Pre-flight ---
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"

    if [[ $EUID -eq 0 ]]; then
        die "Do not run this script as root." \
            "It uses sudo for package installation, and installs the KWin script to your user directory."
    fi

    for f in Makefile package.json src/index.ts res/metadata.json; do
        if [[ ! -f "$f" ]]; then
            die "Missing required file $f — run this from the Tessera source directory."
        fi
    done

    if [[ "$UNINSTALL" == true ]]; then
        uninstall_script
        return 0
    fi

    resolve_deps
    build
    install_script
    post_install
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi