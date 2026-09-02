# Tessera Keyboard Shortcuts

Quick reference for all Tessera tiling shortcuts. Configure in **System Settings → Shortcuts → KWin**.

## Cheat Sheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TESSERA SHORTCUTS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FOCUS (navigate)               MOVE (relocate)                     │
│  ────────────────               ────────────────                    │
│        Meta+K                       Meta+Shift+K                    │
│           ↑                             ↑                           │
│  Meta+H ← · → Meta+L       Meta+Shift+H ← · → Meta+Shift+L          │
│           ↓                             ↓                           │
│        Meta+J                       Meta+Shift+J                    │
│                                                                     │
│  RESIZE (borders)                                                   │
│  ────────────────                                                   │
│      Meta+Ctrl+K                                                    │
│          ↑                                                          │
│ Meta+Ctrl+H ← · → Meta+Ctrl+L                                       │
│          ↓                                                          │
│      Meta+Ctrl+J                                                    │
│                                                                     │
│  ACTIONS                                                            │
│  ───────                                                            │
│  Meta+Shift+E        Toggle tiling on/off (restores all windows)    │
│  Meta+Shift+Space    Tile/Untile focused window                     │
│  Meta+T              Toggle split direction (pinned)                │
│  Meta+Shift+S        Swap screen halves                             │
│  Meta+Shift+O        Toggle layout orientation (H↔V)                │
│  Meta+Tab            Cycle to next window                           │
│  Meta+Shift+Tab      Cycle to previous window                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## All Shortcuts

### Core Actions

| Action                 | Shortcut           | Description                                            |
| ---------------------- | ------------------ | ------------------------------------------------------ |
| **Toggle Tiling**      | `Meta+Shift+E`     | Switch tiling on/off; restoring all windows when off   |
| **Tile/Untile Window** | `Meta+Shift+Space` | Toggle tiling for focused window                       |
| **Swap Halves**        | `Meta+Shift+S`     | Swap the two tiling halves; the pile regrows on the freed side |
| **Toggle Split**       | `Meta+T`           | Flip H↔V at the focused split (direction stays pinned) |
| **Toggle Orientation** | `Meta+Shift+O`     | Transpose the layout: side-by-side ↔ top/bottom        |

### Focus Navigation (vim-style)

Focus moves across monitor boundaries when you reach a screen edge.

| Action      | Shortcut |
| ----------- | -------- |
| Focus Above | `Meta+K` |
| Focus Below | `Meta+J` |
| Focus Left  | `Meta+H` |
| Focus Right | `Meta+L` |

### Move Window

Moves cross monitor boundaries at screen edges.

| Action     | Shortcut       |
| ---------- | -------------- |
| Move Up    | `Meta+Shift+K` |
| Move Down  | `Meta+Shift+J` |
| Move Left  | `Meta+Shift+H` |
| Move Right | `Meta+Shift+L` |

### Resize (adjust tile borders)

| Action       | Shortcut      |
| ------------ | ------------- |
| Resize Up    | `Meta+Ctrl+K` |
| Resize Down  | `Meta+Ctrl+J` |
| Resize Left  | `Meta+Ctrl+H` |
| Resize Right | `Meta+Ctrl+L` |

### Cycle

| Action           | Shortcut         | Description                 |
| ---------------- | ---------------- | --------------------------- |
| **Cycle Next**   | `Meta+Tab`       | Focus next tiled window     |
| **Cycle Prev**   | `Meta+Shift+Tab` | Focus previous tiled window |

## Shortcut Pattern

The shortcuts follow **vim-style navigation (HJKL)** with modifier combinations:

| Modifier     | Action         |
| ------------ | -------------- |
| `Meta` alone | Focus/navigate |
| `Meta+Shift` | Move window / layout actions |
| `Meta+Ctrl`  | Resize borders |

## Customization

1. Open **System Settings → Shortcuts → KWin**
2. Search for "Tessera"
3. Click any shortcut to reassign
