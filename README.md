<p align="center">
  <img src="res/tessera-logo.png" width="128" alt="Tessera Logo">
</p>

# <p align="center">Tessera</p>

<p align="center">
  <strong>Hyprland-style dwindle tiling for KDE Plasma 6</strong>
</p>

<p align="center">
  Tessera does one thing: real Hyprland-style dwindle tiling on KDE Plasma.
  Windows tile by the dwindle rule — every split follows the longer axis of
  the tile — new windows split from the window you are focused on, and the
  classic cascade emerges from your focus. A sane cap keeps the layout
  readable: once a half is full, new windows float above the tiled layer and
  the oldest floater takes the next freed slot. Grab a tiled window and it
  floats; snap it to a screen edge and it tiles again — with an on-screen
  indicator for every switch.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/KDE_Plasma-6.0+-blue?logo=kde" alt="KDE Plasma">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

## Features

-   **True dwindle layout** — splits follow the real aspect ratio of each tile
    (Hyprland behavior), not a fixed alternation, so ultrawide, portrait and
    resized monitors all produce sensible layouts
-   **Focus-driven insertion** — new windows split from the focused window,
    like Hyprland; fixed left/right pile insertion remains as an option
-   **Tiled window cap** — at most N tiled windows per layout half (default 4);
    overflow windows float above the tiled layer and are promoted FIFO when a
    slot frees up on the half they target
-   **Float/tile duality with feedback** — drag a tiled window out and it
    floats; snap it to an edge and it tiles; every switch shows an OSD pill
    (COSMIC-style), including the master tiling toggle
-   **Hyprland split controls** — `PreserveSplit` remembers split directions,
    `ForceSplit` pins them, and Toggle Split (`Meta+T`) pins the focused
    split on demand without any option
-   **Keyboard navigation** — directional focus, move and resize shortcuts
    that cross monitor boundaries at screen edges
-   **Native-first design** — animations, notifications, OSD, edge snapping
    and workspace handling come from KWin/Plasma; Tessera only implements
    what KWin lacks

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
- **Native Plasma tiling** (Plasma 6.4+, `Meta+T` region tiling) should be disabled if using Tessera, as both attempt to tile windows simultaneously.

## Configuration

Access settings via **System Settings > Window Management > KWin Scripts > Tessera (Configure)**

> **Enabling / disabling:** Use the **Toggle Tiling** shortcut (`Meta+Shift+E`) to
> switch tiling on and off mid-session — it restores every window to its
> pre-tiling state and back. Using the checkbox in System Settings also works
> for the first enable and for disabling; however on some KWin versions
> (6.6–6.8), re-enabling from System Settings without a full log out/log in does
> nothing because the script is reloaded into a stale QML context (upstream KWin
> limitation). Tessera shows a notification when you disable it via System
> Settings to remind you of this.

| Option                | Description                                                       | Default                                       |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| `InsertionPoint`      | Where new windows appear: Left, Right, or Active (focused window) | Active                                        |
| `MaxTiledWindowsPerHalf` | Max tiled windows per layout half before new windows float (0 = unlimited) | 4                                  |
| `TiledWindowStacking` | Stacking order of tiled windows (Normal/Keep Above/Keep Below)    | Keep Below                                    |
| `MaximizeSingle`      | Maximize when only one window exists                              | Off                                           |
| `FilterProcess`       | Process names to exclude from tiling (comma-separated)            | `krunner, yakuake, kded, polkit, plasmashell` |
| `FilterCaption`       | Window captions to exclude from tiling (comma-separated)          | _(empty)_                                     |
| `TilePopups`          | Include popup/transient windows in tiling                         | Off                                           |
| `PreserveSplit`       | Keep split directions permanent                                   | Off                                           |
| `ForceSplit`          | Force split direction (Disabled/Left-Top/Right-Bottom)            | Disabled                                      |
| `PersistentDirectionOverride` | Make Preselect shortcuts persistent instead of one-shot (Hyprland `permanent_direction_override`) | Off |
| `SplitWidthMultiplier` | Bias the aspect rule: >1 favors top/bottom splits, <1 favors side-by-side (Hyprland `split_width_multiplier`) | 1.0 |
| `RotateLayout`        | Transpose the aspect-based split decision (vertical-first on landscape) | Off                                     |
| `Debug`               | Enable debug logging                                              | Off                                           |

### Per-app exceptions

**Keep an app out of the layout** (it always floats): use Tessera's own
`FilterProcess` / `FilterCaption` options — add the app's window class
(`qdbus6 org.kde.KWin /KWin org.kde.KWin.queryWindowInfo` while the window is
focused shows `resourceClass`) or a caption substring, comma-separated. This
is the reliable mechanism for per-app floating; the windows are then
completely ignored by the layout.

**KWin window rules** (System Settings > Window Management > Window Rules)
remain fully native and useful for geometry defaults, but note they cannot
exempt a window from a tiling script: a rule cannot say "don't tile". Worse,
the **"Ignore requested geometry"** rule actively conflicts with Tessera
(see Compatibility above). Use Tessera's filters for tilability, KWin rules
for everything else.

## Keyboard Shortcuts

Configure in **System Settings > Shortcuts > Window Management** (search "Tessera"):

| Action                 | Default Shortcut   | Hyprland analog  | Description                                               |
| ---------------------- | ------------------ | ---------------- | --------------------------------------------------------- |
| Toggle Tiling          | `Meta+Shift+E`     | —                | Enable/disable tiling on the fly: restore all windows and stop, or start tiling again |
| Tile/Untile Window     | `Meta+Shift+Space` | `togglefloating` | Toggle tiling for the active window                       |
| Focus Above            | `Meta+K`           | `movefocus`      | Move focus to the window above (crosses displays)         |
| Focus Below            | `Meta+J`           | `movefocus`      | Move focus to the window below (crosses displays)         |
| Focus Left             | `Meta+H`           | `movefocus`      | Move focus to the window on the left (crosses displays)   |
| Focus Right            | `Meta+L`           | `movefocus`      | Move focus to the window on the right (crosses displays)  |
| Move Window Up         | `Meta+Shift+K`     | `movewindow`     | Move the active window up in the layout (crosses displays) |
| Move Window Down       | `Meta+Shift+J`     | `movewindow`     | Move the active window down in the layout (crosses displays) |
| Move Window Left       | `Meta+Shift+H`     | `movewindow`     | Move the active window left in the layout (crosses displays) |
| Move Window Right      | `Meta+Shift+L`     | `movewindow`     | Move the active window right in the layout (crosses displays) |
| Resize Up              | `Meta+Ctrl+K`      | `resizeactive`   | Expand the tile border upward                             |
| Resize Down            | `Meta+Ctrl+J`      | `resizeactive`   | Expand the tile border downward                           |
| Resize Left            | `Meta+Ctrl+H`      | `resizeactive`   | Expand the tile border to the left                        |
| Resize Right           | `Meta+Ctrl+L`      | `resizeactive`   | Expand the tile border to the right                       |
| Toggle Split Direction | `Meta+T`           | `togglesplit`    | Toggle the focused window's parent split; the direction stays pinned across relayouts |
| Swap Halves            | `Meta+Shift+S`     | —                | Swap the two tiling halves of the screen; the dwindle pile regrows on the freed side |
| Toggle Layout Orientation | `Meta+Shift+O`  | —                | Transpose the layout: side-by-side windows become top/bottom and back |
| Preselect Split Left   | _(unbound)_        | `preselect l`    | Next window opens to the left of the focused tile          |
| Preselect Split Right  | _(unbound)_        | `preselect r`    | Next window opens to the right of the focused tile         |
| Preselect Split Top    | _(unbound)_        | `preselect u`    | Next window opens on top of the focused tile               |
| Preselect Split Bottom | _(unbound)_        | `preselect d`    | Next window opens on the bottom of the focused tile        |
| Cycle Windows Next     | `Meta+Tab`         | `cyclenext`      | Cycle focus to the next tiled window                      |
| Cycle Windows Previous | `Meta+Shift+Tab`   | `cycleprev`      | Cycle focus to the previous tiled window                  |

## Credits

-   Based on [Polonium](https://github.com/zeroxoneafour/polonium) by Vaughan Milliman.
-   Dwindle behavior and keybind philosophy modeled on [Hyprland](https://hyprland.org).
-   Tiled/floating duality and toggle feedback modeled on [COSMIC DE](https://system76.com/cosmic).

## License

MIT License — see [LICENSE](LICENSE)
