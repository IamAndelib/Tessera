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
│  RESIZE (borders)               SWAP (exchange positions)           │
│  ────────────────               ──────────────────────              │
│      Meta+Ctrl+K                     Meta+Alt+K                     │
│          ↑                              ↑                           │
│ Meta+Ctrl+H ← · → Meta+Ctrl+L   Meta+Alt+H ← · → Meta+Alt+L         │
│          ↓                              ↓                           │
│      Meta+Ctrl+J                     Meta+Alt+J                     │
│                                                                     │
│  ACTIONS                                                            │
│  ───────                                                            │
│  Meta+Shift+Space    Tile/Untile focused window                     │
│  Meta+\              Open quick settings                            │
│  Meta+S              Swap with sibling (tree partner)               │
│  Meta+T              Toggle split direction (H↔V)                   │
│  Meta+Tab            Cycle to next window                           │
│  Meta+Shift+Tab      Cycle to previous window                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## All Shortcuts

### Core Actions

| Action                    | Shortcut           | Description                      |
| ------------------------- | ------------------ | -------------------------------- |
| **Tile/Untile Window**    | `Meta+Shift+Space` | Toggle tiling for focused window |
| **Open Settings**         | `Meta+\`           | Quick settings popup             |
| **Toggle Vertical-First** | _(unbound)_        | Switch H/V first split           |

### Focus Navigation (vim-style)

| Action      | Shortcut |
| ----------- | -------- |
| Focus Above | `Meta+K` |
| Focus Below | `Meta+J` |
| Focus Left  | `Meta+H` |
| Focus Right | `Meta+L` |

### Move Window

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

### Swap (Hyprland-style)

| Action                | Shortcut         | Description                 |
| --------------------- | ---------------- | --------------------------- |
| **Swap with Sibling** | `Meta+S`         | Swap with tree partner      |
| **Swap Up**           | `Meta+Alt+K`     | Swap with window above      |
| **Swap Down**         | `Meta+Alt+J`     | Swap with window below      |
| **Swap Left**         | `Meta+Alt+H`     | Swap with window on left    |
| **Swap Right**        | `Meta+Alt+L`     | Swap with window on right   |
| **Toggle Split**      | `Meta+T`         | Flip H↔V at current split  |
| **Cycle Next**        | `Meta+Tab`       | Focus next tiled window     |
| **Cycle Previous**    | `Meta+Shift+Tab` | Focus previous tiled window |

## Shortcut Pattern

The shortcuts follow **vim-style navigation (HJKL)** with modifier combinations:

| Modifier     | Action         |
| ------------ | -------------- |
| `Meta` alone | Focus/navigate |
| `Meta+Shift` | Move window    |
| `Meta+Ctrl`  | Resize borders |
| `Meta+Alt`   | Swap positions |

## Customization

1. Open **System Settings → Shortcuts → KWin**
2. Search for "Tessera"
3. Click any shortcut to reassign
