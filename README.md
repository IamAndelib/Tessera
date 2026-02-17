<p align="center">
  <img src="res/tessera-logo.png" width="128" alt="Tessera Logo">
</p>

# <p align="center">Tessera</p>

<p align="center">
  <strong>Hyprland-style dwindle tiling for KDE Plasma 6</strong>
</p>

<p align="center">
  <img src="res/demo.gif" alt="Tessera Demo" width="100%">
</p>

<p align="center">
  Tessera is a KWin tiling script that brings the clean, intuitive dwindle tiling behavior of Hyprland to KDE Plasma. Based on Polonium, it has been streamlined and enhanced with Hyprland-specific features.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/KDE_Plasma-6.0+-blue?logo=kde" alt="KDE Plasma">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

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

## Configuration

Access settings via **System Settings > Window Management > KWin Scripts > Tessera (Configure)**

| Option                | Description                                                       | Default                                    |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `InsertionPoint`      | Where new windows appear: Left, Right, or Active                  | Left                                       |
| `TiledWindowStacking` | Stacking order of tiled windows (Normal/Keep Above/Keep Below)    | Normal                                     |
| `MaximizeSingle`      | Maximize when only one window exists                              | Off                                        |
| `FilterProcess`       | Process names to exclude from tiling (comma-separated)            | `krunner, yakuake, kded, polkit, plasmashell` |
| `FilterCaption`       | Window captions to exclude from tiling (comma-separated)          | _(empty)_                                  |
| `TilePopups`          | Include popup/transient windows in tiling                         | Off                                        |
| `ResizeAmount`        | Pixel increment for resize shortcuts                              | 10                                         |
| `SaveOnTileEdit`      | Persist layout changes via DBus                                   | Off                                        |
| `PreserveSplit`       | Keep split directions permanent                                   | Off                                        |
| `ForceSplit`          | Force split direction (Disabled/Left-Top/Right-Bottom)            | Disabled                                   |
| `DefaultSplitRatio`   | Default ratio when splitting (10-90%)                             | 50%                                        |
| `RotateLayout`        | Vertical-first layout (top/bottom splits instead of side-by-side) | Off                                        |
| `AutoRotateLayout`    | Adapt to portrait monitors automatically                          | On                                         |
| `TimerDelay`          | Layout engine responsiveness (lower = snappier)                   | 10ms                                       |
| `Debug`               | Enable debug logging                                              | Off                                        |

## Keyboard Shortcuts

Configure in **System Settings > Shortcuts > Window Management** (search "Tessera"):

| Action                 | Default Shortcut   | Description                                               |
| ---------------------- | ------------------ | --------------------------------------------------------- |
| Tile/Untile Window     | `Meta+Shift+Space` | Toggle tiling for the active window                       |
| Open Settings          | `Meta+\`           | Open Tessera quick settings dialog                        |
| Focus Above            | `Meta+K`           | Move focus to the window above                            |
| Focus Below            | `Meta+J`           | Move focus to the window below                            |
| Focus Left             | `Meta+H`           | Move focus to the window on the left                      |
| Focus Right            | `Meta+L`           | Move focus to the window on the right                     |
| Move Window Up         | `Meta+Shift+K`     | Move the active window up in the layout                   |
| Move Window Down       | `Meta+Shift+J`     | Move the active window down in the layout                 |
| Move Window Left       | `Meta+Shift+H`     | Move the active window left in the layout                 |
| Move Window Right      | `Meta+Shift+L`     | Move the active window right in the layout                |
| Resize Up              | `Meta+Ctrl+K`      | Expand the tile border upward                             |
| Resize Down            | `Meta+Ctrl+J`      | Expand the tile border downward                           |
| Resize Left            | `Meta+Ctrl+H`      | Expand the tile border to the left                        |
| Resize Right           | `Meta+Ctrl+L`      | Expand the tile border to the right                       |
| Swap with Sibling      | `Meta+S`           | Swap the active window with its sibling in the tree       |
| Swap Up                | `Meta+Alt+K`       | Swap the active window with the one above                 |
| Swap Down              | `Meta+Alt+J`       | Swap the active window with the one below                 |
| Swap Left              | `Meta+Alt+H`       | Swap the active window with the one on the left           |
| Swap Right             | `Meta+Alt+L`       | Swap the active window with the one on the right          |
| Swap Halves            | `Meta+Shift+S`     | Swap the two tiling halves of the screen                  |
| Toggle Split Direction | `Meta+T`           | Toggle between horizontal and vertical split              |
| Cycle Windows Next     | `Meta+Tab`         | Cycle focus to the next tiled window                      |
| Cycle Windows Previous | `Meta+Shift+Tab`   | Cycle focus to the previous tiled window                  |
| Toggle Vertical-First  | _(unset)_          | Toggle between horizontal-first and vertical-first layout |

## Credits

Based on [Polonium](https://github.com/zeroxoneafour/polonium) by Vaughan Milliman.

## License

MIT License — see [LICENSE](LICENSE)
