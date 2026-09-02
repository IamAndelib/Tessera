# Tessera Roadmap

Tessera brings Hyprland-style dwindle tiling to KDE Plasma 6. This document is
the development constitution: what Tessera is, what it borrows from whom, and
the ordered plan to make it robust and simple.

**Identity**: Hyprland's dwindle, keybinds and fluidity. COSMIC's float/tile
duality with OSD feedback. Tessera's per-half window cap. Nothing else.

---

## Design Principles

1. **Hyprland behavior** — dwindle tiling, insert at the focused window,
   directional keybinds, fluid single-pass layout updates.
2. **COSMIC duality** — a tiled layer and a floating layer coexist; windows
   switch between them freely, and every switch gives visible OSD feedback.
3. **Tessera cap** — a sane maximum of tiled windows per half; overflow
   windows float, and when a tiled window closes the oldest floater takes its
   place (FIFO promotion).
4. **KDE-native first** — never reimplement what KWin/Plasma already does
   well. Every feature must justify itself against native behavior before any
   script code exists. Script-side work is limited to what KWin lacks: the
   dwindle tree, the cap/FIFO policy, tile↔float transitions, and directional
   navigation.

---

## Research Basis

### Why not Polonium (v1.2.1, the fork base)

Polonium's latest stable ships 7 layout engines, a DBus settings daemon, a
settings dialog app, and is in maintenance mode ("I have nothing more to add
to this software"). Tessera deliberately rejects that scope:

| Area | Polonium v1.2.1 | Tessera direction |
| --- | --- | --- |
| Layouts | 7 engines | Dwindle only |
| Persistence | External dbus-saver daemon | None (session-local) |
| Settings | Dialog app + KWin config | KWin config only |
| Window caps | None | Per-half cap + FIFO promotion |
| Toggle tiling | No | Native toggle with full restore + OSD |
| Tests | None | Deterministic harness, no-KWin runs |

### What COSMIC (cosmic-comp) teaches

- **Two parallel layers per workspace**: a tiling tree and a floating space,
  with windows transitioning between them. Tessera formalizes the same
  duality with an explicit window state machine (M1).
- **Floating layer with edge snapping and maximization state preservation.**
  Tessera gets this from KWin natively (Quick Tile snap detection) and keeps
  captured pre-tiling state for restoration.
- **Cross-display navigation**: moving focus or a window toward a screen edge
  migrates to the adjacent display. This is the one navigation behavior worth
  porting (M3).
- **Per-output tiling toggle with visible feedback** — the pattern behind
  Tessera's Toggle Tiling + OSD, which stays.
- **Layout exceptions** (dialogs, app rules) auto-float — Tessera's filters
  already cover this; no new machinery needed.

### What KWin/Plasma natively provides (and Tessera must not duplicate)

- **Animations** — KWin's own effects animate open/close/minimize. No
  script-side animation work, ever. "Fluidity" means single-pass rebuilds
  without flicker or geometry jitter, not custom animation code.
- **OSD** — `org.kde.osdService` (already used for toggle feedback).
- **Notifications** — `org.freedesktop.Notifications` (already used).
- **Edge snapping** — KWin Quick Tile; Tessera only detects the resulting
  tile change and retiles.
- **Workspaces, outputs, activities, window rules, minimize/maximize/
  fullscreen semantics** — owned by KWin; Tessera reacts, never replaces.

---

## Milestones

### M1 — Window State Machine (foolproof core)

**Problem.** Window lifecycle state is spread across three driver structures
(`clients` BiMap, `untiledWindows`, `overflowedWindows`) plus scattered
`WindowExtensions` flags (`isTiled`, `wasTiled`). Transitions are duplicated
across five event hooks, which is the root cause of the bug class fixed
one-by-one so far (double registration, promotion dead-ends, stale desktop
entries).

**Target design.**

- One authoritative per-window state in the driver:

  ```
  FLOATING  — not tiled, not a promotion candidate (dialogs, filtered apps,
              windows opened while tiling is off)
  TILED     — registered in the engine and occupying a tile
  OVERFLOWED— floating because the cap was hit; holds a FIFO position and is
              a promotion candidate
  ```

- **All** transitions flow through a single choke point
  (`TilingDriver.transition()`), with legal edges only:

  ```
  FLOATING   → TILED      (addWindow: new window, snap-in, unminimize,
                           re-enable backfill)
  FLOATING   → OVERFLOWED (addWindow when the target half is full)
  TILED      → FLOATING   (untileWindow: drag-out, min/max/fullscreen enter,
                           desktop/activity/output change, manual untile)
  TILED      → TILED      (retarget: putWindowInTile within the layout)
  OVERFLOWED → TILED      (promotion when a slot frees, snap-in/drop onto
                           a half with room)
  OVERFLOWED → FLOATING   (no longer first in FIFO when another window
                           takes the slot — rare, explicit)
  ```

- Illegal transitions are logged and ignored, never silently corrupt state.
- `WindowExtensions.isTiled` is written only by the choke point (derived
  state), so hooks and shortcuts keep their current API.
- `wasTiled` becomes transition context on `TILED → FLOATING` caused by
  min/max/fullscreen, set centrally.

**Files.** `src/driver/driver.ts`, `src/driver/index.ts`,
`src/controller/actions/windowhooks.ts`, `src/controller/actions/basic.ts`,
`src/controller/extensions.ts`, `test/engine-harness.ts`.

**Acceptance criteria.**

- `make test` covers every legal transition edge plus illegal-transition
  rejection, FIFO promotion order, and cap-hit/cap-freed cycles.
- Manual KWin checklist: open > cap windows → floaters above; close a tiled
  window → oldest floater promotes; drag a tiled window out → floats; snap it
  back → tiles; minimize/maximize/fullscreen round-trips restore correctly;
  toggle tiling off/on preserves pre-tiling state.

### M2 — True Hyprland Dwindle

**Problem.** Two divergences from real Hyprland dwindle:

1. Insertion defaults to a fixed right-hand pile. Hyprland splits from the
   focused window; the dwindle cascade emerges because the new window takes
   focus.
2. Split direction alternates by tree depth (parity), which only mimics
   Hyprland's visual pattern on 16:9 screens. Hyprland cuts along the
   **longer axis of the tile's actual geometry**, re-evaluated per rebuild.

**Changes.**

- Default `InsertionPoint` → `Active` (insert at focused window). The
  right-pile option remains selectable.
- Aspect-based splits: the driver feeds each node's real tile geometry into
  the engine during `buildLayout`/`regenerateLayout`; the engine splits nodes
  along the longer axis. Depth-parity remains as the fallback when geometry
  is unknown (keeps the stubbed harness deterministic).
- `PreserveSplit` / `ForceSplit` semantics unchanged; `AutoRotateLayout`
  stays as a base-orientation hint for new desktops.

**Files.** `src/engine/index.ts`, `src/driver/driver.ts`,
`src/util/config.ts`, `res/main.xml`, `res/config.ui`, `test/engine-harness.ts`.

**Acceptance criteria.**

- Harness tests: two-window default is side-by-side on landscape geometry and
  top/bottom on portrait geometry; cascade matches Hyprland on 16:9; split
  direction follows a manually-resized tile's aspect on rebuild.
- Manual: new windows split from the focused window; ultrawide and portrait
  monitors produce sensible orientations without touching `AutoRotateLayout`.

### M3 — Hyprland Keybinds + Navigation

**Keybind set (final).**

| Action | Binding | Hyprland analog | Status |
| --- | --- | --- | --- |
| Toggle Tiling (+OSD) | `Meta+Shift+E` | — (COSMIC-inspired) | keep |
| Tile/Untile window (+OSD) | `Meta+Shift+Space` | `togglefloating` | keep, add OSD |
| Focus direction | `Meta+H/J/K/L` | `movefocus` | keep, cross-output |
| Move window direction | `Meta+Shift+H/J/K/L` | `movewindow` | keep, cross-output |
| Resize border | `Meta+Ctrl+H/J/K/L` | `resizeactive` | keep |
| Toggle split | `Meta+T` | `togglesplit` | keep |
| Cycle next/prev | `Meta+Tab` / `Meta+Shift+Tab` | `cyclenext` | keep |
| Swap halves | `Meta+Shift+S` | — (cap workflow) | keep |
| Rotate orientation | `Meta+Shift+O` | — | keep |
| Swap in direction ×4 | `Meta+Alt+…` | — | **cut** |
| Swap with sibling | `Meta+S` | — | **cut** (move covers it) |

**Changes.**

- Remove cut shortcuts from `src/qml/shortcuts.qml`, `res/main.xml`,
  `src/controller/actions/shortcuts.ts`.
- Cross-output navigation: when the directional probe point leaves the
  current output, resolve the nearest output in that direction and
  focus/move into its nearest tile. Single-output fast path unchanged.
- Native-first audit: every remaining shortcut is checked against KWin's
  built-in shortcut list; any duplicate is dropped in favor of the native one.

**Files.** `src/controller/actions/shortcuts.ts`, `src/qml/shortcuts.qml`,
`res/main.xml`, `README.md`, `SHORTCUTS.md`.

**Acceptance criteria.**

- Focus and move cross display boundaries toward the pressed direction.
- Cut shortcuts no longer appear in System Settings.
- No Tessera shortcut duplicates a KWin built-in.

### M4 — Native-First Cleanup, Docs, CI

- Remove the dead `MaxTiledWindows` global cap (declared in `res/main.xml`,
  read in `src/util/config.ts`, never enforced — only the per-half cap is
  real). Add both cap options to the README config table.
- Native-first audit pass: confirm each subsystem defers to KWin (no
  script-side animations, no geometry fighting; retire the desktop-change
  repositioning hack if KWin semantics allow).
- README rewritten to this identity: Hyprland dwindle + COSMIC-style
  float/tile duality + cap; Hyprland-bind mapping table; Polonium credited as
  the fork base without being the comparison frame.
- CHANGELOG: fix the contradictory OSD removed/added entries; document M1-M4.
- GitHub Actions CI: `lint` (tsc + eslint), `make test`, and the container
  build pipeline on every PR.

**Acceptance criteria.**

- No dead config keys; README config table matches `res/main.xml` exactly.
- CI green on PR; releases remain reproducible via `install.sh`.

---

## Out of Scope (explicit rejections)

| Feature | Reason |
| --- | --- |
| Additional layouts (Half, Three Column, Pillars, Pager, Monocle) | Identity is dwindle-only; Polonium has these |
| Layout persistence daemon | Session-local is simpler and dependency-free |
| Settings dialog app | KWin's config UI is native and sufficient |
| Window groups / stacks / tabs | KWin has its own tabbing; composable complexity |
| Script-side animations | Compositor-effect territory; native effects suffice |
| X11 support | KWin tiling API is Wayland-only |

## Source Audit (Hyprland + COSMIC, post-M4)

The engine was audited against the actual implementations: Hyprland
`src/layout/algorithm/tiled/dwindle/DwindleAlgorithm.cpp` and cosmic-comp
`src/shell/layout/tiling/mod.rs` / `floating/mod.rs`.

**Verified equivalent (kept as-is):** longer-axis dynamic splits; per-node
geometry computed top-down from the work area; sibling-promotion on removal;
insertion anchored at the focused window; 50/50 default split ratios;
orientation toggle; toggle-tiling with visible feedback. COSMIC's N-ary
groups were deliberately not adopted (binary tree is the Hyprland model we
target), and its group pill indicators need compositor effects (out of
scope for a KWin script).

**Kept where we are better:**
- `Meta+T` toggle-split works without `PreserveSplit`. Hyprland's
  `togglesplit` is silently overwritten by the dynamic rule at default
  config; ours pins the node.
- Per-half cap + FIFO promotion (exists in neither project).
- Cross-output focus/move always on (Hyprland gates it behind
  `binds:window_direction_monitor_fallback`).
- Deterministic test harness (neither project has tests).
- Fullscreen handling stays Tessera-style (exit fullscreen/maximized on new
  windows) — decided against Hyprland's pause-relayout approach in review.

**Adopted from Hyprland in Phase B:** `preselect` (choose the split
direction and side for the next inserted window, one-shot by default with a
persistent-override option) and `split_width_multiplier` (biases the aspect
comparison). Both are proven mechanisms, both map cleanly onto our engine.

## Phase B — Proven-parity additions

- **B1 Preselect**: `engine.preselect(dir)` consumed by the split created for
  the next inserted window; chooses axis *and* side (Left/Up → first child,
  Right/Down → second child, matching Hyprland's `m_overrideDirection`
  semantics). One-shot by default; `PersistentDirectionOverride` config for
  the permanent mode. Four shortcuts (`TesseraPreselect*`, unbound by
  default) with OSD feedback.
- **B2 `SplitWidthMultiplier`**: multiplies the vertical axis in the aspect
  comparison (`height * mult > width → vertical`), transposed under
  `RotateLayout`. Default 1.0 (pure aspect).
- **B5 Native-tiling notice**: one-time notification at init when foreign
  (non-Tessera) tiles exist on an output — i.e. Plasma's `Meta+T` tiling is
  in use — recommending it be disabled.
- **B4 Docs**: per-app exceptions section (Tessera filters + KWin window
  rules interplay).

## Stage 1 Hotfix — KWin 6.4+ tiling crash (ACTIVE)

Phase B exposed a latent M2 bug against the Plasma 6.4+ tiling rewrite:
KWin's `CustomTile::split()` now creates **two children or a new sibling**
depending on the parent's state, so same-direction parent/child splits
(which Hyprland-faithful aspect decisions produce) corrupted the native tile
tree → relayout storm → KWin SIGSEGV. Fix and full evidence:
**`docs/STAGE1-HOTFIX.md`** (self-contained handoff; implement from there).

- Stage 1 (this hotfix): perpendicular engine constraint + Polonium 1.2.x's
  proven build algorithm (direction-change clearing, incremental child
  matching, `manage()`/`unmanage()`).
- Stage 2 (deferred, design in the same doc): N-ary flattening for
  Hyprland-exact same-direction nesting — only after Stage 1 soaks.

## Testing & Release Strategy

- Every milestone keeps `make test` green before commit; one commit per
  milestone on the `test` branch.
- The deterministic harness (kwin-api stubs) is extended in the same commit
  as the behavior it covers — no milestone ships untested.
- Container build pipeline (`dev/test-install.sh`) validates packaging.
- Releases cut from `test` → `main` merges after the manual KWin checklist
  passes on a real Plasma 6 session.
