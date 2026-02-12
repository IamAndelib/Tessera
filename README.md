![Tessera Logo](res/tessera-logo.png)

# Tessera

**Hyprland-style dwindle tiling for KDE Plasma 6**

Tessera is a KWin tiling script that brings the clean, intuitive dwindle tiling behavior of Hyprland to KDE Plasma. Based on Polonium, it has been streamlined and enhanced with Hyprland-specific features.

![Tessera Tiling](https://img.shields.io/badge/KDE_Plasma-6.0+-blue?logo=kde)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

-   **Dwindle Layout** — Windows tile in a spiral pattern, alternating split direction by depth
-   **Active Insertion** — New windows open next to the currently focused window
-   **Hyprland-style Options:**
    -   `PreserveSplit` — Remember split directions permanently
    -   `ForceSplit` — Force all splits to a specific direction (left/top or right/bottom)
    -   `DefaultSplitRatio` — Set custom ratio for new splits (default 50%)
-   **Tiled Window Stacking** — Control z-order: keep tiled windows above or below floating ones
-   **Clean Focus Behavior** — Click any window to focus, no stacking restrictions
-   **Keyboard Shortcuts** — Focus navigation, resizing, window insertion, layout rotation

## Installation

### Quick Install (Recommended)

The install script automatically detects your distro, installs build dependencies, builds Tessera from source, and installs it as a KWin script. It works on any Linux distribution running KDE Plasma 6.

```bash
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
./install.sh
```

The script will:
1. Detect your package manager and install missing dependencies (`npm`, `make`, `zip`)
2. Bundle the TypeScript source with esbuild
3. Assemble and install the KWin script package via `kpackagetool6`
4. Optionally restart KWin to activate Tessera immediately

> **Note:** Do not run `install.sh` as root. It uses `sudo` internally only for package installation.

---

### Manual Install (Per-Distro)

If you prefer to install dependencies manually, follow the instructions for your distribution below, then run the build and install steps.

#### Arch Linux / Manjaro / EndeavourOS

```bash
# Install dependencies
sudo pacman -S --needed npm make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

#### Fedora / RHEL / CentOS Stream

```bash
# Install dependencies
sudo dnf install npm make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

#### Ubuntu / Kubuntu / Debian / Linux Mint

```bash
# Install dependencies
sudo apt update && sudo apt install npm make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

#### openSUSE Tumbleweed / Leap

```bash
# Install dependencies
sudo zypper install npm-default make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

#### Void Linux

```bash
# Install dependencies
sudo xbps-install -S nodejs make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

#### Alpine Linux

```bash
# Install dependencies
sudo apk add npm make zip git

# Clone and install
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
npm install
npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral
make res src
zip -r tessera.kwinscript pkg
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

---

### Upgrading

To upgrade an existing installation, pull the latest changes and re-run the install script:

```bash
cd Tessera
git pull
./install.sh
```

The script automatically detects the existing installation and upgrades it.

### Uninstall

```bash
kpackagetool6 -t KWin/Script -r tessera
```

### Post-Install

1. **Enable the script:** System Settings > Window Management > KWin Scripts > Tessera
2. **Configure shortcuts:** System Settings > Shortcuts > KWin (search "Tessera")
3. **Restart KWin** to load the script:
   ```bash
   qdbus6 org.kde.KWin /KWin reconfigure
   ```

## Configuration

Access settings via **System Settings > Window Management > KWin Scripts > Tessera (Configure)**

| Option              | Description                                            | Default  |
| ------------------- | ------------------------------------------------------ | -------- |
| `InsertionPoint`    | Where new windows appear: Left, Right, or Active       | Left     |
| `TiledWindowStacking` | Stacking order of tiled windows (Normal/Keep Above/Keep Below) | Normal |
| `MaximizeSingle`    | Maximize when only one window exists                   | Off      |
| `PreserveSplit`     | Keep split directions permanent                        | Off      |
| `ForceSplit`        | Force split direction (Disabled/Left-Top/Right-Bottom) | Disabled |
| `DefaultSplitRatio` | Default ratio when splitting (10-90%)                  | 50%      |
| `RotateLayout`      | Vertical-first layout (top/bottom splits instead of side-by-side) | Off      |
| `AutoRotateLayout`  | Adapt to portrait monitors automatically               | On       |
| `TimerDelay`        | Layout engine responsiveness (lower = snappier)        | 10ms     |

## Keyboard Shortcuts

Configure in **System Settings > Shortcuts > KWin**:

-   **Tessera: Tile/Untile Window** — Toggle tiling for active window
-   **Tessera: Focus Above/Below/Left/Right** — Navigate between tiles
-   **Tessera: Insert Above/Below/Left/Right** — Move window to adjacent tile
-   **Tessera: Resize Above/Below/Left/Right** — Resize tile borders
-   **Tessera: Rotate Layout** — Toggle layout rotation

## Recommended KWin Effects

For smooth animations, enable in **System Settings > Desktop Effects**:

1. **Geometry Change** — Essential for smooth tile resizing
2. **Magic Lamp** or **Scale** — Window open/close animations
3. **Slide** — Virtual desktop switching

## Credits

Based on [Polonium](https://github.com/zeroxoneafour/polonium) by Vaughan Milliman.

## License

MIT License — see [LICENSE](LICENSE)
