# Changelog

All notable changes to Tessera are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Overhaul: true Hyprland dwindle with COSMIC-style float/tile duality

Tessera's identity is now explicit: Hyprland's dwindle behavior and keybinds,
COSMIC's tiled/floating duality with OSD feedback, and Tessera's per-half
window cap. See `ROADMAP.md` for the full development constitution.

### Added
- **Aspect-based dwindle splits**: every split follows the longer axis of the
  tile's real geometry, like Hyprland. Ultrawide, portrait and manually
  resized tiles all produce correct orientations; `AutoRotateLayout` is
  superseded and removed.
- **Focus-driven insertion** (`InsertionPoint` default is now `Active`): new
  windows split from the focused window and the dwindle cascade emerges from
  focus, exactly like Hyprland. Fixed left/right pile insertion remains
  selectable.
- **Pinned split toggles** (`Meta+T`): toggling the focused window's parent
  split pins its direction across relayouts, without requiring
  `PreserveSplit` (Hyprland `togglesplit` semantics).
- **Cross-display navigation**: directional focus and move shortcuts migrate
  to the neighboring display when the pressed direction leaves the current
  screen (COSMIC/Hyprland behavior).
- **OSD feedback for Tile/Untile Window** (`Meta+Shift+Space`): a Plasma OSD
  pill shows "Window tiled" / "Window floated", completing the COSMIC-style
  switch feedback alongside the tiling toggle.
- Default `Meta+Shift+O` keybinding for `TesseraRotateLayout`, which toggles
  the layout orientation: two side-by-side windows become top/bottom (left on
  top, right on bottom) and back.
- **Toggle Tiling** (`Meta+Shift+E`, `TesseraToggleEnabled`): tiling can now be
  stopped and restarted at any time without touching System Settings. Disabling
  restores every managed window to its captured pre-tiling state, enabling
  starts tiling again from the current floating layout like a fresh install.
- A system notification when Tessera is disabled from System Settings, warning
  that re-enabling mid-session needs a log out / log in (upstream KWin script
  reload limitation).

### Changed
- Single window state machine: all lifecycle state lives in one authoritative
  map (`FLOATING | TILED | OVERFLOWED`) and every transition flows through one
  choke point, eliminating the double-registration and promotion dead-end bug
  class. Covered by new deterministic tests (`make test`).
- Tiling no longer depends on the external `org.tessera.SettingSaver` DBus
  daemon: per-desktop engine settings are kept in memory for the session, and
  the setting-over-DBus actions were removed.

### Removed
- The swap-directional (`Meta+Alt+H/J/K/L`) and swap-with-sibling (`Meta+S`)
  shortcuts: directional move covers the same ground, keeping the keybind set
  minimal and Hyprland-aligned.
- The quick settings dialog (`TesseraOpenSettings` / `Meta+\`) and the old
  on-screen display: settings remain available via System Settings > KWin
  Scripts > Tessera (Configure), and feedback now comes from the native OSD
  service.
- Dead config options `MaxTiledWindows` (never enforced; the per-half cap is
  the real policy) and `AutoRotateLayout` (superseded by aspect-based splits).

## [1.5.0] - 2026-08-29

### Added
- Per-half tiled window cap (`MaxTiledWindowsPerHalf`, default 4): new windows
  tile into the half the insertion targets (the dwindle pile, or the active
  window's side for active insertion) until that half is full, then float above
  the tiled layer.
- Swap halves and tile again: after `TesseraSwapHalves`, the frozen pile moves
  to the other half and the dwindle grows a fresh pile on the freed side until
  its per-half limit, then the next window floats.
- Auto-promotion of capped-out floaters, FIFO, when a slot frees up on the half
  they target.
- Deterministic engine test harness (`make test`), with kwin-api stubs for
  no-KWin runs.

### Changed
- New windows that hit the cap are kept above the tiled layer regardless of the
  `TiledWindowStacking` setting.
- Tiled windows are kept below floating windows by default
  (`TiledWindowStacking` default is now Keep Below).

### Fixed
- Capped-out floaters used to open behind tiled windows; they now always sit on
  top.
- Dragging a floater onto a full half no longer overfills the layout; the
  window stays floating and its pending promotion slot is preserved.
- Engine cap/promotion helpers (`clientCount`, `dwindleSideNode`,
  `rootChildNode`, `nodeOfTile`) now count per half instead of globally, fixing
  promotion dead-ends under the cap.

## [1.4.0] - 2026-07-22

### Changed
- Restructured the codebase and moved development scripts into `dev/`.
- Removed the KDE Plasma environment detection from the install script.
- Removed dropped config options from the settings UI and fixed the manual
  build command.

### Fixed
- Full audit: bugs, race conditions, circular dependencies, and compatibility
  issues.
- Replaced static class fields with module constants, with an es2020 target.
- Cleaned up the repo: removed binaries, fixed the test script, deduped the
  logo.

## [1.3.0] - 2026-02-19

### Changed
- Simplified configuration and cleaned up the codebase.

## [1.2] - 2026-02-17

### Added
- Swap screen contents on each half (`swapHalves`).
- Tiled window stacking setting (Keep Above / Keep Below).
- Multi-distro install script with container-based pipeline tests.
- Full shortcuts table in the README.

### Changed
- Removed the OSD.
- Comprehensive code review, performance optimizations, and cleanup.

## [1.0.0] - 2026-02-07

### Added
- Initial release: Hyprland-style dwindle tiling for KDE Plasma 6.

[Unreleased]: https://github.com/IamAndelib/Tessera/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/IamAndelib/Tessera/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/IamAndelib/Tessera/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/IamAndelib/Tessera/compare/v1.2...v1.3.0
[1.2]: https://github.com/IamAndelib/Tessera/compare/v1.0.0...v1.2
[1.0.0]: https://github.com/IamAndelib/Tessera/releases/tag/v1.0.0