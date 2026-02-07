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
-   **Clean Focus Behavior** — Click any window to focus, no stacking restrictions
-   **Keyboard Shortcuts** — Focus navigation, resizing, window insertion, layout rotation

## How Tessera Differs from Polonium

| Feature             | Polonium                                            | Tessera                                                                |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| **Layout Engines**  | Multiple (BTree, Half, Three Column, Monocle, KWin) | Focused: Dwindle (BTree) only                                          |
| **Split Behavior**  | Standard alternating                                | Hyprland-style with `preserveSplit`, `forceSplit`, `defaultSplitRatio` |
| **Border Handling** | Script-controlled (4 modes)                         | Delegated to system decorations                                        |
| **Focus Behavior**  | Tiled windows kept below (blocks mouse focus)       | Standard focus — click any window                                      |
| **Codebase**        | Feature-rich, complex                               | Streamlined, ~100 lines removed                                        |

### Why Tessera?

-   **Hyprland Users** — Familiar dwindle behavior if you're coming from Hyprland
-   **Simpler** — One layout engine, no border mode complexity
-   **No Focus Issues** — Removed `keepTiledBelow` that prevented clicking tiled windows
-   **System Integration** — Relies on KDE's window decoration settings for corners/borders

## Installation

### From Source

1. **Dependencies:** `npm`, `git`, `kpackagetool6`

2. **Clone and build:**

    ```bash
    git clone https://github.com/mimisriz/tessera.git
    cd tessera
    make build
    ```

3. **Install:**

    ```bash
    make install
    ```

4. **Enable:** Go to **System Settings > Window Management > KWin Scripts** and enable Tessera

### Uninstall

```bash
make uninstall
```

## Configuration

Access settings via **System Settings > Window Management > KWin Scripts > Tessera (Configure)**

| Option              | Description                                            | Default  |
| ------------------- | ------------------------------------------------------ | -------- |
| `InsertionPoint`    | Where new windows appear: Left, Right, or Active       | Left     |
| `MaximizeSingle`    | Maximize when only one window exists                   | Off      |
| `PreserveSplit`     | Keep split directions permanent                        | Off      |
| `ForceSplit`        | Force split direction (Disabled/Left-Top/Right-Bottom) | Disabled |
| `DefaultSplitRatio` | Default ratio when splitting (10-90%)                  | 50%      |
| `RotateLayout`      | Rotate the base layout direction                       | Off      |
| `AutoRotateLayout`  | Auto-rotate on portrait monitors                       | On       |
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
