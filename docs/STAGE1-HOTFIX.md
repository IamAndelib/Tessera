# Stage 1 Hotfix — KWin 6.4+ Tiling Crash (Handoff Document)

This document is a **self-contained handoff**. A fresh session needs nothing
but this file + `ROADMAP.md` + the source tree to understand and execute the
fix. Read top to bottom before touching code.

---

## 1. Context snapshot

- **Project**: Tessera — Hyprland-style dwindle tiling KWin script for KDE
  Plasma 6. Constitution and principles live in `ROADMAP.md` (read it first).
- **Branch**: `test` (default). Head at the time of writing: `bda639c`.
- **Deployed**: the Phase B build (`bda639c`) is installed on the maintainer's
  system (Fedora, Plasma / KWin **6.7.4**, Wayland) via `./install.sh
  --restart`, script enabled (`kwinrc` → `Plugins` → `tesseraEnabled=true`).
- **Works**: install/build/test toolchain, 73-check harness, all Phase A/B
  features at the engine level (aspect+multiplier root decisions, preselect,
  cap/FIFO, cross-output nav, toggle tiling).
- **Broken in real sessions**: KWin **SIGSEGV** plus a continuous
  `TypeError` relayout storm → all Tessera shortcuts effectively dead
  (including `Meta+T` toggle-split). Root cause below — this is **not**
  speculative; it is evidence-backed and reproduced in logs.

**User-reported symptoms (2026-09-02):**
1. `kwin_wayland` crashed (SIGSEGV) shortly after the Phase B install.
2. Navigation shortcuts "do not work".
3. `Meta+T` (toggle split) "worked fine in the previous build, now broken".

**Important non-causes** (verified, do not chase):
- Shortcuts ARE registered in `~/.config/kglobalshortcutsrc` — the user
  personally binds **arrow keys** (`Meta+Left/Right/Up/Down`,
  `Meta+Shift+Arrows`, `Meta+Ctrl+Arrows` for resize), not the vim-key
  defaults. Both sets exist; deadness was caused by the relayout storm below.
- `kglobalshortcutsrc` contains stale entries for removed features
  (`TesseraOpenSettings`, `TesseraSwap*`) — harmless leftovers; KGlobalAccel
  prunes them eventually. Do not "fix" these.

---

## 2. Incident report (evidence)

```
coredumpctl:  Wed 2026-09-02 18:41:15  SIGSEGV  /usr/bin/kwin_wayland (core inaccessible)

journalctl after KWin restart (PID 53941), repeating every ~1-2s:
file:///home/andelibsriz/.local/share/kwin/scripts/tessera/contents/code/main.mjs:983:
  TypeError: Cannot read property 'relativeGeometry' of undefined
  (same at :987)
```

`main.mjs:983/987` (bundled) is the sizing block inside
`TilingDriver.buildLayout` (`src/driver/driver.ts`):

```ts
if (horizontal && i > 0) {
    const geom = kwinTile.tiles[i - 1].relativeGeometry;   // ← throws
    ...
} else if (i > 0) {
    const geom = kwinTile.tiles[i - 1].relativeGeometry;   // ← throws
```

`kwinTile.tiles[i - 1]` is `undefined` ⇒ **KWin created fewer children than
the engine tree expects** ⇒ `kwinTile.split()` did not produce two children
mid-BFS ⇒ half-built tile tree ⇒ `layoutModified` fires → regenerate →
geometry changes → `layoutModified` again → **relayout storm** → SIGSEGV.
The storm also explains the "dead" shortcuts: every shortcut effect was
trampled by the next rebuild/error pass.

---

## 3. Root cause (verified against KWin source)

KWin **6.4+ rewrote its tiling system** (`src/tiles/customtile.*`). The QML
`Tile.split()` semantics changed. From KWin `v6.7.4`
`src/tiles/customtile.h`:

```cpp
/// Splits the current tile, either creating two children or a new sibling
/// @returns the two new tiles created by splitting this one
Q_INVOKABLE QList<CustomTile *> split(KWin::Tile::LayoutDirection newDirection);
```

Implementation (`customtile.cpp:193`, v6.7.4):

```cpp
auto *parentT = static_cast<CustomTile *>(parentTile());
if (parentT && (parentT->childCount() < 2 || parentT->layoutDirection() == newDirection)) {
    // SIBLING path: "this" stays a leaf; a new sibling is appended to the parent
    splitTiles << this;
    splitTiles << parentT->createChildAt(newGeo, layoutDirection(), row() + 1);
} else {
    // CHILDREN path: two new children are created inside "this"
    // (only reachable for the root layout tile, or when the parent already
    //  has 2 children AND a different layout direction)
}
```

**Rules to internalize:**
- Splitting a tile whose parent has <2 children, or whose parent has the
  **same** direction as the requested split → **sibling**, not children.
- Only the root layout tile (no parent), or a tile whose parent has 2
  children **and** a different direction, gets two children.
- KWin's tile model is therefore **N-ary groups with alternating nesting**.
  A same-direction *nested binary* split is **unrepresentable**.

Our `TilingDriver.buildLayout` (inherited from old pre-6.4 Polonium) assumes
`split()` always yields two children. The old engine guaranteed alternating
directions (H→V→H→V) so the sibling path never triggered. **M2's
aspect-based splits can legitimately produce same-direction parent/child
splits** (e.g. a wide tile inside a wide parent — true Hyprland behavior),
which flips KWin into the sibling path → desync → the crash loop above.

Why the M4 build (`c69de4d`) "worked": on the maintainer's 16:9 screen the
aspect decisions coincided exactly with strict alternation (identical tree
shapes to the old depth-parity), so the sibling path never fired. The bug
was latent since M2; any resize or odd shape could trigger it.

Side note: `KWin::Tile` (src/tiles/tile.h, v6.7.4) exposes only
`resizeByPixels`, `manage(Window*)`, `unmanage(Window*)` as Q_INVOKABLEs —
`split()` lives on `CustomTile`. The kwin-api npm typings (v6.0.9, from
2023) predate all of this.

---

## 4. Polonium v1.2.1 source analysis (the proven adaptation)

Polonium 1.2.x targets "Plasma 6.4 and up (6.7 recommended)" and already
solved this. Studied file-by-file (URLs in §9).

### 4.1 Engine is perpendicular by construction
`src/engine/layouts/btree.ts`: `Node.layoutDirection` is a **getter** —
children are always perpendicular to their parent; only the root stores a
direction (`layoutDirectionRoot`, set by their `rotateLayout` setting).
Their engine *cannot represent* same-direction nesting. That is the price
of KWin compatibility, paid deliberately.

### 4.2 `src/driver/buildlayout.ts` — the proven build algorithm
```
buildLayout(kwinRootTile, engineRootTile):
  BFS over (kwinTile, engineTile) pairs:
    1. DIRECTION-CHANGE GUARD: if kwinTile.layoutDirection !== engineTile.layoutDirection
       → remove ALL kwin children first, then set the direction.
       ("changing layout direction with preexisting children causes tiling to freak")
    2. engineTile has exactly 1 child → clear kwin children, remap the SAME
       kwinTile to the child, continue (chain collapse).
    3. otherwise matchChildren(kwinTile, engineTile):
       a. SURPLUS: while kwinTile.tiles.length > engineTile.children.length
          → remove last child
       b. PRE-SHRINK: for i in 0..(count-2): setChildMinSize(kwinTile, i)
          — shrink every keeper except the last to 0.15001 relative size
       c. DEFICIT: while kwinTile.tiles.length < engineTile.children.length:
            if kwinTile.tiles.length === 0 → kwinTile.split(dir)
            else → kwinTile.tiles[last].split(dir)   // deterministic SIBLING path:
                                                   // parent dir was just synced == dir
       d. EXACT SIZING: for i from LAST down to 0 → setChildRelativeSize(...)
          (reverse order matters: setting early children first pushes later
           ones below KWin's minimum mid-sequence)
  return tileMap (kwinTile → engineTile)
```
The `0.15001` magic constant guards KWin's hard minimum relative tile size
(~0.15 — "Tiling system falls apart when tiles fall below 0.15 relative
size. This is a KWin feature" — Polonium 1.1-b1 release notes).

### 4.3 Window assignment via KWin's own API
`src/driver/index.ts`: windows are attached with
`if (kwinWindow.tile !== kwinTile) kwinTile.manage(kwinWindow)` and released
with `kwinWindow.tile.unmanage(kwinWindow)` — **not** direct
`window.tile = ...` writes. A "tiledWindows" set is computed from the engine
tree; everything not in it gets unmanaged (guarded: only unmanage when
`window.tile` belongs to this driver's tileMap — multi-driver safety).

### 4.4 Other mechanisms (studied, mostly NOT adopted)
- Tile hooks: `relativeGeometryChanged` / `childTilesChanged` on every tile
  → **event queue** → `updateTiles` syncs geometry back into the engine,
  even absorbing tiles KWin created externally (their "KWin layout" engine).
- Ghost-window purge at every `buildLayout` (drop windows that no longer
  exist / are not on the display).
- `savedActiveWindow` reconciliation (activation-before-add races).
- Engine N-ary `children[]` + per-child `size` + windows-in-tiles.

---

## 5. Stage 1 implementation spec (execute in this order)

### Commit 1 — engine: perpendicular constraint
File: `src/engine/index.ts`, function `buildLayout`.

- Carry `parentDir` through the BFS queue entries (extend the
  `{node, depth, width, height}` tuples; root gets `null`).
- Keep the existing decision chain (preselected → pinned → preserveSplit →
  forceSplit → aspect(+multiplier) → depth-parity) — **then**, if the chosen
  `splitDir === parentDir`, flip it (`Horizontal ↔ Vertical`).
- Root node: `parentDir === null` → no constraint (aspect + multiplier decide
  the root orientation — this is where aspect logic retains real value).
- Child geometry propagation already uses the final `splitDir` — unchanged.
- Add a code comment explaining the KWin constraint (cite §3).

Harness (`test/engine-harness.ts`) changes:
- Test *"wide remainder splits Horizontal (parity would say Vertical)"* →
  now expects **Vertical** (parent is Horizontal → flip). Rename it, e.g.
  *"same-direction aspect flips to perpendicular (KWin constraint)"*.
- Test *"persistent preselect beats aspect on later splits"* → the second
  split (Right) collides with the root's Horizontal → flips to Vertical;
  the client takes the second child (bottom). Update assertions accordingly.
- All other existing tests keep passing (16:9 cascade alternates naturally).
- ADD a dedicated regression test: construct a wide-inside-wide case, assert
  the flip, and assert the flip does not corrupt the tree over repeated
  `buildLayout` calls (build 3×, assert stable client placement).

### Commit 2 — driver: port Polonium's build algorithm
Files: `src/driver/driver.ts`, `src/driver/index.ts`.

Rewrite `TilingDriver.buildLayout`:
1. **Ghost purge** (new, try/catch-guarded): for each window in
   `this.clients.keys()`, probe `window.resourceClass`; on throw (dead
   object) → `engine.removeClient(client)` (guarded), `clients.delete`,
   `forget(window)`. Existence-only; desktop membership stays event-driven.
2. Keep the `maximizeSingle` root-client branch as-is.
3. Replace the BFS body with the §4.2 algorithm, binary-adapted:
   - direction-change guard (remove children first, then set direction)
   - `tile.tiles.length === 1` → clear kwin children, remap chain
   - `tile.tiles.length === 2` → matchChildren (surplus / pre-shrink /
     deficit-grow / reverse-exact-size), with `this.tiles.set(...)` for each
     kwin child ↔ engine child pair
   - `tile.tiles.length === 0` → leaf: keep the existing per-client property
     block (captureState, minimized/fullScreen/maximize resets, stacking,
     `lastTiledLocation`, `raiseWindow` in reverse order)
   - keep the `fixSizing(tile, kwinTile)` call per container
4. **Window assignment**: switch to `manage()`/`unmanage()`:
   - while walking the tree, collect `tiledWindows: Set<Window>`
   - `if (window.tile !== kwinTile) kwinTile.manage(window)` (try/catch;
     log on failure) — replaces the `window.tile = null; window.tile = kwinTile`
     force-change trick
   - after the walk: for each driver client NOT in tiledWindows → if
     `window.tile != null && this.tiles.has(window.tile)` → `window.tile.unmanage(window)`
     else if `window.tile == null` → nothing to detach; then run the existing
     flag cleanup (`applyUntiled` semantics — keepAbove/keepBelow resets stay
     in DriverManager's pendingUntile loop, which must ALSO unmanage instead
     of writing `window.tile = null` when the tile belongs to this driver)
5. Keep: `rootKwinTile` tracking, `rebuildEngine()`, `rootGeometry()`, cap
   helpers, `pendingUntile`, everything in DriverManager that is not the
   assignment mechanism.

Acceptance for this commit: `make lint` + `make test` green; NO behavior
change at the harness level except what Commit 1 already covers (the driver
is stubbed in tests; the port is validated by review against §4.2 + the
retest checklist in §7).

### Commit 3 — docs
- `ROADMAP.md`: mark Stage 1 implemented; keep Stage 2 brief (§6).
- `CHANGELOG.md` `Unreleased` → `Fixed`: "KWin 6.4+ compatibility: tile
  splitting no longer corrupts the native tile tree (crash + relayout
  storm); layout application now uses KWin's manage/unmanage API and
  incremental child matching, matching Polonium 1.2.x's Plasma 6.4+
  adaptation."
- `README.md` Compatibility section: one sentence — Tessera is adapted to
  the Plasma 6.4+ tiling rewrite and tested on 6.7.

### Then
`make lint && make test && make build` → commit each step separately →
reinstall with `./install.sh --restart` → hand the §7 checklist to the user.

---

## 6. Stage 2 design brief (do NOT implement yet)

**Goal**: Hyprland-exact same-direction nesting on exotic shapes, without
violating KWin's model — via **N-ary flattening**.

**Geometric equivalence**: a same-direction nested binary split is
geometrically identical to a flat N-ary group. `root H [A(½) | B-node H
[B1(¼), B2(¼)]]` ≡ `root H-group [A(½), B1(¼), B2(¼)]`. Nothing visual is
lost; only the binary grouping (used by operations at depth) is implicit.

**Design**:
- Driver-side flattening only — the ENGINE stays Hyprland-faithful (binary,
  per-node aspect). `buildLayout` maps each engine node to a kwin container;
  walking a node's subtree through same-direction edges collects "flat
  slots" (slot fraction = product of the chain's `relativeSize`s); a child
  whose direction differs becomes a nested kwin container.
- `tiles` BiMap becomes kwinTile ↔ slot-entry-node + chain metadata
  (ordered (node, ratio) pairs). Consumers to re-verify one by one:
  `regenerateLayout` (fold slot fraction back: last chain ratio =
  slotFraction / parentSlotFraction), `putWindowInTile` (insert at the
  slot's entry node), `nodeOfTile`, cap helpers (engine-tree-only — unaffected),
  `fixSizing`, `resizeTile` (kwin-native — unaffected).
- Preselect/pinned interactions must be re-derived under flattening.
- Requires its own harness suite (flattening + folding round-trips) and a
  real-session soak period before shipping.

**Prerequisite**: Stage 1 validated in daily use (no crashes, stable layouts
for at least a few days of the maintainer's usage).

---

## 7. Retest checklist (hand to the user after reinstall)

1. Session start with several windows → cascade builds, no journal errors:
   `journalctl --user -g "main.mjs|Tessera" --since "-5 min"`
2. Open windows past the per-half cap (default 4) → floaters above; close a
   tiled window → oldest floater promotes.
3. `Meta+T` (or the user's own binding) toggles a split and survives window
   open/close.
4. Resize a window with the mouse repeatedly, then open/close more windows →
   layout stays correct (this used to trigger the sibling-path corruption).
5. Drag a tiled window out → floats; snap to an edge → retiles (OSD pills).
6. `Meta+Shift+E` off/on → full restore and re-tile.
7. Multi-monitor (if available): focus/move across displays at edges.
8. Toggle-split orientation `Meta+Shift+O`; preselect (if bound).
9. Soak: leave the session running; confirm no TypeErrors in the journal
   during normal use (this is the Stage 2 gate).

---

## 8. Gotchas for the next session

- Run `npm install` first — `node_modules` is not committed; `npx tsc` and
  `npx eslint` fail without it.
- `make test` bundles to `test-harness.mjs` (gitignored) — safe to run.
- This machine has **no `qdbus`/`qdbus6`**; `install.sh` falls back to
  `dbus-send`. Manual reconfigure:
  `dbus-send --session --dest=org.kde.KWin --type=method_call /KWin org.kde.KWin.reconfigure`
- Verify script load after install:
  `dbus-send --session --print-reply --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.isScriptLoaded string:"tessera"`
- Never run `install.sh` as root (it self-guards).
- QML exceptions appear in the journal as `main.mjs:LINE` errors — map LINE
  back through the esbuild bundle (search the expression, not the line).
- The maintainer's shortcut bindings are arrow-key based; do not "fix" them.
- `AutoRotateLayout` and `MaxTiledWindows` were removed deliberately — do
  not reintroduce them (see ROADMAP Out-of-Scope).

## 9. Reference sources (re-fetchable)

- KWin v6.7.4 `src/tiles/customtile.h` / `customtile.cpp` / `tile.h` /
  `tile.cpp`:
  `https://raw.githubusercontent.com/KDE/kwin/v6.7.4/src/tiles/<file>`
- KWin master tiling rewrite lives in `src/tiles/` (old `src/tiling/` is gone)
- Polonium master (v1.2.x): `https://github.com/zeroxoneafour/polonium`
  - `src/driver/buildlayout.ts` (§4.2 algorithm)
  - `src/driver/index.ts` (manage/unmanage, tiledWindows sweep)
  - `src/driver/updatetiles.ts` (geometry→engine sync)
  - `src/engine/engine.ts`, `src/engine/layouts/btree.ts` (perpendicular getter)
- kwin-api npm typings: `node_modules/kwin-api/src/tile.ts` (outdated vs 6.7 —
  trust the KWin source, not the typings)
