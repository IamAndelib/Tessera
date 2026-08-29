# Changelog

All notable changes to Tessera are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Default `Meta+Shift+O` keybinding for `TesseraRotateLayout`, which toggles
  the layout orientation: two side-by-side windows become top/bottom (left on
  top, right on bottom) and back.

### Changed
- Disabling or uninstalling the script (and KWin logout) now releases every
  tiled window: tiles are dropped, forced stacking is undone, and each window
  returns to its pre-tiling geometry, maximization and fullscreen state.
- Windows that are already open when the script starts are now tiled too
  (i3-style backfill), and captured so unloading hands them back intact.
- Fixed a regenerating loop on tile-resize: the layout debounce timer could
  throw, so every tile change retiled the tree thousands of times (causing
  scrambled, non-tiling windows). Debounce is now guarded and uses `start()`.
- Guarded against a second script instance overlapping an old one when KWin
  reloads a declarative script mid-session (upstream QQmlEngine cache issue,
  bug 519678): an existing controller is torn down before the new one starts.
  Note: re-enabling the script in System Settings after disabling it can leave
  it "loaded but not running" on affected KWin versions; re-login (or
  disable -> reconfigure -> enable -> reconfigure) restores it reliably.

### Removed
- The quick settings dialog (`TesseraOpenSettings` / `Meta+\`) and the on-screen
  display (OSD) were removed to keep the script lean. Settings remain available
  via System Settings > KWin Scripts > Tessera (Configure), and over DBus.

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