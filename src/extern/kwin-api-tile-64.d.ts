// kwin-api-tile-64.d.ts - Tile APIs added by the Plasma 6.4+ tiling rewrite.
// Verified present at runtime in KWin 6.7.4 (src/tiles/tile.h:
// `Q_INVOKABLE bool manage(Window*)` / `unmanage(Window*)`) but missing from
// the kwin-api npm typings (v6.0.9, 2023). Remove this file if the typings
// ever ship these.

import type { Window } from "kwin-api";

declare module "kwin-api" {
    interface Tile {
        /** Attach a window to this tile (KWin manages placement/geometry). */
        manage(window: Window): boolean;
        /** Detach a window from this tile. */
        unmanage(window: Window): boolean;
    }
}
