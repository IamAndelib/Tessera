<p align="center">
  <img src="res/tessera-logo.png" width="128" alt="Tessera Logo">
</p>

# <p align="center">Tessera</p>

<p align="center">
  <strong>Hyprland-style dwindle tiling for KDE Plasma 6</strong>
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
-   **Tiled Window Stacking** — Control z-order: keep tiled windows above or below floating ones
-   **Clean Focus Behavior** — Click any window to focus, no stacking restrictions
-   **Keyboard Shortcuts** — Focus navigation, resizing, window insertion, layout rotation

## Installation

### Quick Install (Recommended)

The install script detects your package manager, installs missing build dependencies, builds Tessera from source, and installs it as a KWin script. It works on any Linux distribution running KDE Plasma 6.

```bash
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
./install.sh
```

> **Note:** Do not run `install.sh` as root. It uses `sudo` internally only for package installation.

To upgrade later, `git pull` and re-run `./install.sh`.

### Manual Install

If you prefer to install the build dependencies yourself:

| Distribution | Install build dependencies |
| ----------- | -------------------------- |
| Arch / Manjaro / EndeavourOS | `sudo pacman -S --needed npm make zip git` |
| Fedora / RHEL / CentOS Stream | `sudo dnf install npm make zip git` |
| Ubuntu / Kubuntu / Debian / Linux Mint | `sudo apt update && sudo apt install npm make zip git` |
| openSUSE Tumbleweed / Leap | `sudo zypper install npm-default make zip git` |

Then build and install:

```bash
git clone https://github.com/IamAndelib/Tessera.git
cd Tessera
make build
kpackagetool6 -t KWin/Script -i tessera.kwinscript
```

### Uninstall

```bash
./install.sh --uninstall
```

or manually: `kpackagetool6 -t KWin/Script -r tessera`

## Requirements

| Component | Minimum Version |
| --------- | --------------- |
| KDE Plasma | 6.0 |
| Qt | 6.6 |
| KDE Frameworks | 6.0 |
| `kpackagetool6` | Ships with Plasma 6 |

### Distro Notes

- **Arch / Manjaro / EndeavourOS** — Rolling release; always has Plasma 6.
- **Fedora 41+** — Ships Plasma 6.0+.
- **openSUSE Tumbleweed** — Rolling release; always has Plasma 6.
- **Kubuntu 25.04+** — Ships Plasma 6. **Kubuntu 24.04 LTS ships Plasma 5** and is not supported. Upgrade to 25.04+ or use the Kubuntu Backports PPA.
- **Debian 13 (Trixie)** — First Debian release with Plasma 6. Debian 12 (Bookworm) is Plasma 5 only.

## Compatibility

### Conflicting Scripts

**Disable any "Remember Window Position" scripts.** These scripts save and restore window geometry on launch, which directly conflicts with Tessera's tiling layout. Both scripts attempt to set `window.frameGeometry`, causing unpredictable window placement.

This includes:
- [Remember Window Positions](https://github.com/rxappdev/RememberWindowPositions) (and similar variants)

### Conflicting KWin Settings

- **"Ignore requested geometry"** window rules prevent Tessera from controlling tiled window positions. Do not apply this rule to tiled windows.
- **Native Plasma tiling** (Plasma 6.4+, `Meta+T`) should be disabled if using Tessera, as both attempt to tile windows simultaneously.

## Configuration

Access settings via **System Settings > Window Management > KWin Scripts > Tessera (Configure)**

| Option                | Description                                                       | Default                                       |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| `InsertionPoint`      | Where new windows appear: Left, Right, or Active                  | Left                                          |
| `TiledWindowStacking` | Stacking order of tiled windows (Normal/Keep Above/Keep Below)    | Normal                                        |
| `MaximizeSingle`      | Maximize when only one window exists                              | Off                                           |
| `FilterProcess`       | Process names to exclude from tiling (comma-separated)            | `krunner, yakuake, kded, polkit, plasmashell` |
| `FilterCaption`       | Window captions to exclude from tiling (comma-separated)          | _(empty)_                                     |
| `TilePopups`          | Include popup/transient windows in tiling                         | Off                                           |
| `PreserveSplit`       | Keep split directions permanent                                   | Off                                           |
| `ForceSplit`          | Force split direction (Disabled/Left-Top/Right-Bottom)            | Disabled                                      |
| `RotateLayout`        | Vertical-first layout (top/bottom splits instead of side-by-side) | Off                                           |
| `AutoRotateLayout`    | Adapt to portrait monitors automatically                          | On                                            |

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
