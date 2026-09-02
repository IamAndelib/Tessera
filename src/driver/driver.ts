// driver/driver.ts - Mapping from engines to Kwin API

import { BTreeEngine, Tile, Client, EngineConfig } from "../engine";
import { Direction, GSize, GPoint, DirectionTools } from "../util/geometry";
import {
    InsertionPoint,
    TiledWindowStacking,
    RESIZE_AMOUNT,
} from "../util/config";
import * as Kwin from "kwin-api";
import { BiMap } from "../util/bimap";
import { Queue } from "../util/queue";
import { Log } from "../util/log";
import { Config } from "../util/config";
import type { Controller } from "../controller";

// M1: authoritative per-window lifecycle state. The tiled layer and the
// floating layer coexist (COSMIC-style duality); every window the driver
// manages is in exactly one of these states and every change flows through
// TilingDriver.transition().
export const enum TilingState {
    // not tiled and not a promotion candidate (dialogs, filtered apps,
    // windows opened while tiling is off, suspended windows)
    Floating = 0,
    // registered in the engine and occupying a tile
    Tiled = 1,
    // floating because the cap was hit; holds a FIFO position and is a
    // promotion candidate when a slot frees up
    Overflowed = 2,
}

// why a transition happened; drives state-dependent side effects
// (wasTiled restoration markers etc.)
export type TilingCause =
    // Tiled -> Floating: minimize/maximize/fullscreen entered, restorable
    | "suspended"
    // Tiled -> Floating: drag-out, desktop change, manual untile; not
    // auto-restorable
    | "released"
    // Floating/Overflowed -> Tiled or Floating -> Overflowed: window became
    // manageable / was dropped in
    | "added"
    // Floating -> Overflowed: the target half was full
    | "capHit";

export class TilingDriver {
    engine: BTreeEngine;

    private logger: Log;
    private config: Config;
    private ctrl: Controller;

    tiles: BiMap<Kwin.Tile, Tile> = new BiMap();
    clients: BiMap<Kwin.Window, Client> = new BiMap();
    // this driver's output root tile (set on every buildLayout pass); source
    // of the tileable-area geometry for aspect-based splits
    private rootKwinTile: Kwin.Tile | null = null;
    // authoritative lifecycle state per managed window (insertion order of
    // Overflowed entries is the FIFO promotion order)
    private windowStates: Map<Kwin.Window, TilingState> = new Map();
    // windows that left the tiled layer and still need their KWin-side
    // properties reapplied on the next rebuild (tile detach, stacking reset,
    // maximize undo). A work queue, not lifecycle state.
    private pendingUntile: Set<Kwin.Window> = new Set();

    // the single state-transition choke point. Illegal edges are logged and
    // ignored, never silently corrupt state.
    private transition(
        window: Kwin.Window,
        to: TilingState,
        cause: TilingCause = "added",
    ): void {
        const from = this.windowStates.get(window) ?? TilingState.Floating;
        if (from === to) {
            return;
        }
        const legal =
            (from === TilingState.Floating &&
                (to === TilingState.Tiled || to === TilingState.Overflowed)) ||
            (from === TilingState.Tiled && to === TilingState.Floating) ||
            (from === TilingState.Overflowed && to === TilingState.Tiled);
        if (!legal) {
            this.logger.error(
                "Illegal state transition",
                from,
                "->",
                to,
                "for",
                window.resourceClass,
            );
            return;
        }
        this.windowStates.set(window, to);
        if (from === TilingState.Tiled && to === TilingState.Floating) {
            this.pendingUntile.add(window);
        }
        const extensions = this.ctrl.windowExtensions.get(window);
        if (extensions != undefined) {
            // derived flags have exactly one writer: this transition
            extensions.isTiled = to === TilingState.Tiled;
            if (to === TilingState.Tiled) {
                // back in a tile: the restore marker has served its purpose
                extensions.wasTiled = false;
            } else if (to === TilingState.Floating) {
                extensions.isSingleMaximized = false;
                if (cause === "suspended") {
                    extensions.wasTiled = true;
                }
            }
        }
    }

    // drop all lifecycle state for a window (it left the system entirely)
    private forget(window: Kwin.Window): void {
        this.windowStates.delete(window);
        this.pendingUntile.delete(window);
    }

    // read-only state accessor (Tiled / Floating / Overflowed)
    stateOf(window: Kwin.Window): TilingState {
        return this.windowStates.get(window) ?? TilingState.Floating;
    }

    // windows that left the tiled layer since the last rebuild and still
    // need their KWin-side "appear untiled" application. Draining the queue
    // clears it.
    takePendingUntile(): Kwin.Window[] {
        const ret = Array.from(this.pendingUntile);
        this.pendingUntile.clear();
        return ret;
    }

    // windows currently occupying a tile
    tiledWindows(): Kwin.Window[] {
        const ret: Kwin.Window[] = [];
        for (const [window, state] of this.windowStates) {
            if (state === TilingState.Tiled) {
                ret.push(window);
            }
        }
        return ret;
    }

    // registered engine clients whose tiling is temporarily suspended
    // (minimized / maximized / fullscreen / dragged out)
    suspendedWindows(): Kwin.Window[] {
        const ret: Kwin.Window[] = [];
        for (const [window, state] of this.windowStates) {
            if (state === TilingState.Floating && this.clients.has(window)) {
                ret.push(window);
            }
        }
        return ret;
    }

    // cap-hit floaters in FIFO promotion order
    overflowedWindows(): Kwin.Window[] {
        const ret: Kwin.Window[] = [];
        for (const [window, state] of this.windowStates) {
            if (state === TilingState.Overflowed) {
                ret.push(window);
            }
        }
        return ret;
    }

    get engineConfig(): EngineConfig {
        return {
            insertionPoint: this.engine.config.insertionPoint,
            rotateLayout: this.engine.config.rotateLayout,
            // Hyprland-style dwindle options
            preserveSplit: this.engine.config.preserveSplit,
            forceSplit: this.engine.config.forceSplit,
        };
    }

    set engineConfig(config: EngineConfig) {
        this.engine.config.insertionPoint = config.insertionPoint;
        this.engine.config.rotateLayout = config.rotateLayout;
        // Hyprland-style dwindle options
        this.engine.config.preserveSplit = config.preserveSplit;
        this.engine.config.forceSplit = config.forceSplit;
        try {
            this.rebuildEngine();
        } catch (e) {
            this.logger.error(e);
        }
    }

    constructor(engine: BTreeEngine, ctrl: Controller) {
        this.engine = engine;
        this.ctrl = ctrl;
        this.logger = ctrl.logger;
        this.config = ctrl.config;
    }

    // the tileable area of this driver's output, used by the engine for
    // aspect-based (Hyprland) split decisions. Null when unknown (fresh
    // driver before its first buildLayout), which makes the engine fall
    // back to depth-alternating splits.
    private rootGeometry(): { width: number; height: number } | null {
        const root = this.rootKwinTile;
        if (root == null) {
            return null;
        }
        try {
            const geometry = root.absoluteGeometry;
            if (geometry.width <= 0 || geometry.height <= 0) {
                return null;
            }
            return { width: geometry.width, height: geometry.height };
        } catch (e) {
            this.logger.error(e);
            return null;
        }
    }

    // rebuild the engine layout with real screen geometry so splits follow
    // the actual tile aspect ratios
    private rebuildEngine(): void {
        this.engine.buildLayout(this.rootGeometry() ?? undefined);
    }

    buildLayout(rootTile: Kwin.Tile): void {
        // remember the root tile: it is the source of the tileable area
        // geometry for aspect-based splits on later engine rebuilds
        this.rootKwinTile = rootTile;
        // rebuild the engine with real geometry so the tree we apply carries
        // aspect-aware split directions (also covers fresh drivers whose
        // first tiling happens before this method ever ran)
        this.rebuildEngine();
        // clear root tile
        while (rootTile.tiles.length > 0) {
            rootTile.tiles[0].remove();
        }
        this.tiles.clear();

        // for maximizing single, sometimes engines can create overlapping root tiles so find the real root
        let realRootTile: Tile = this.engine.rootTile;
        while (
            realRootTile.tiles.length == 1 &&
            realRootTile.clients.length == 0
        ) {
            realRootTile = realRootTile.tiles[0];
        }
        this.tiles.set(rootTile, realRootTile);
        // if a root tile client exists, just maximize it. there shouldnt be one if roottile has children
        if (realRootTile.clients.length != 0 && this.config.maximizeSingle) {
            for (let i = realRootTile.clients.length - 1; i >= 0; i -= 1) {
                const client = realRootTile.clients[i];
                const window = this.clients.inverse.get(client);
                if (window == undefined) {
                    this.logger.error("Window undefined");
                    continue;
                }
                window.tile = null;
                const extensions = this.ctrl.windowExtensions.get(window);
                if (extensions != undefined) {
                    extensions.captureState();
                    extensions.isSingleMaximized = true;
                }
                window.setMaximize(true, true);
                window.keepAbove =
                    this.config.tiledWindowStacking ===
                    TiledWindowStacking.KeepAbove;
                window.keepBelow =
                    this.config.tiledWindowStacking ===
                    TiledWindowStacking.KeepBelow;
                this.ctrl.workspace.raiseWindow(window);
            }
            return;
        }
        const queue: Queue<Tile> = new Queue();
        queue.enqueue(realRootTile);
        while (queue.size > 0) {
            const tile = queue.dequeue()!;
            const kwinTile = this.tiles.inverse.get(tile);
            if (kwinTile == undefined) {
                this.logger.error("Tile not registered in buildLayout");
                continue;
            }
            this.ctrl.managedTiles.add(kwinTile);
            kwinTile.layoutDirection = tile.layoutDirection;
            // LayoutDirection: 1=Horizontal, 2=Vertical (per kwin-api)
            const horizontal =
                kwinTile.layoutDirection == Kwin.LayoutDirection.Horizontal;
            const tilesLen = tile.tiles.length;
            // fix sizing issues (ex. size > 1) prematurely
            tile.fixRelativeSizing();
            if (tilesLen > 1) {
                for (let i = 0; i < tilesLen; i += 1) {
                    // tiling has weird splitting mechanics, so hopefully this code can help with that
                    if (i == 0) {
                        kwinTile.split(tile.layoutDirection);
                    } else if (i > 1) {
                        kwinTile.tiles[i - 1].split(tile.layoutDirection);
                    }
                    // custom resizing much easier now (?)
                    const childKwinTile = kwinTile.tiles[i];
                    const childTile = tile.tiles[i];
                    this.tiles.set(childKwinTile, childTile);
                    // size based on relative size plus autosizing
                    // Must read-modify-write: in Qt's JS engine, relativeGeometry
                    // returns a copy of the QRectF, so direct sub-property assignment
                    // (e.g. tile.relativeGeometry.width = X) silently mutates the copy.
                    if (horizontal && i > 0) {
                        const geom = kwinTile.tiles[i - 1].relativeGeometry;
                        geom.width =
                            kwinTile.relativeGeometry.width *
                            tile.tiles[i - 1].relativeSize;
                        kwinTile.tiles[i - 1].relativeGeometry = geom;
                    } else if (i > 0) {
                        const geom = kwinTile.tiles[i - 1].relativeGeometry;
                        geom.height =
                            kwinTile.relativeGeometry.height *
                            tile.tiles[i - 1].relativeSize;
                        kwinTile.tiles[i - 1].relativeGeometry = geom;
                    }
                    queue.enqueue(childTile);
                }
            }
            // if there is one child tile, replace this tile with the child tile
            else if (tilesLen == 1) {
                this.tiles.set(kwinTile, tile.tiles[0]);
                queue.enqueue(tile.tiles[0]);
            }

            // Iterating over clients backwards to ensure stacking order
            for (let i = tile.clients.length - 1; i >= 0; i -= 1) {
                const client = tile.clients[i];
                const window = this.clients.inverse.get(client);
                if (window == undefined) {
                    this.logger.error("Client", client.name, "does not exist");
                    return;
                }
                const extensions = this.ctrl.windowExtensions.get(window);
                if (extensions == undefined) {
                    this.logger.error(
                        "Window extensions not found for",
                        window.resourceClass,
                    );
                    continue;
                }
                // set some properties before setting tile to make sure client shows up
                extensions.captureState();
                window.minimized = false;
                window.fullScreen = false;
                window.setMaximize(false, false);
                extensions.isSingleMaximized = false;
                // Clear tile first to force change detection for effects like KDE-Rounded-Corners
                if (window.tile !== kwinTile) {
                    window.tile = null;
                }
                window.tile = kwinTile;
                window.keepAbove =
                    this.config.tiledWindowStacking ===
                    TiledWindowStacking.KeepAbove;
                window.keepBelow =
                    this.config.tiledWindowStacking ===
                    TiledWindowStacking.KeepBelow;
                extensions.lastTiledLocation = GPoint.centerOfRect(
                    kwinTile.absoluteGeometry,
                );
                // windows raised in inverse order (first window in array goes on top eventually)
                this.ctrl.workspace.raiseWindow(window);
            }

            this.fixSizing(tile, kwinTile);
        }
    }

    fixSizing(tile: Tile, kwinTile: Kwin.Tile): void {
        // only resize if not root tile (obv)
        if (tile.parent == null || kwinTile.parent == null) {
            return;
        }
        let index = tile.parent.tiles.indexOf(tile);
        let parentIndex =
            tile.parent.parent != null
                ? tile.parent.parent.tiles.indexOf(tile.parent)
                : null;
        const requestedSize = new GSize();
        requestedSize.fitSize(tile.requestedSize);
        for (const client of tile.clients) {
            const window = this.clients.inverse.get(client);
            if (window == undefined) {
                continue;
            }
            requestedSize.fitSize(window.minSize);
        }
        const horizontal =
            kwinTile.parent.layoutDirection == Kwin.LayoutDirection.Horizontal;

        // Helper to apply resize with correct edge based on index
        const applyResize = (
            targetTile: Kwin.Tile,
            diff: number,
            isHorizontal: boolean,
        ) => {
            if (isHorizontal) {
                if (index == 0) {
                    targetTile.resizeByPixels(diff, Kwin.Edge.RightEdge);
                } else {
                    targetTile.resizeByPixels(-diff, Kwin.Edge.LeftEdge);
                }
            } else {
                if (index == 0) {
                    targetTile.resizeByPixels(diff, Kwin.Edge.BottomEdge);
                } else {
                    targetTile.resizeByPixels(-diff, Kwin.Edge.TopEdge);
                }
            }
        };

        // Helper to handle parent expanding if child can't
        const applyParentResize = (diff: number, isHorizontal: boolean) => {
            if (parentIndex == null) return;
            // If we're resizing the parent, we use parentIndex to determine edge
            if (isHorizontal) {
                if (parentIndex == 0) {
                    kwinTile.parent!.resizeByPixels(diff, Kwin.Edge.RightEdge);
                } else {
                    kwinTile.parent!.resizeByPixels(-diff, Kwin.Edge.LeftEdge);
                }
            } else {
                if (parentIndex == 0) {
                    kwinTile.parent!.resizeByPixels(diff, Kwin.Edge.BottomEdge);
                } else {
                    kwinTile.parent!.resizeByPixels(-diff, Kwin.Edge.TopEdge);
                }
            }
        };

        // Horizontal resize
        if (requestedSize.width > kwinTile.absoluteGeometryInScreen.width) {
            let diff =
                requestedSize.width - kwinTile.absoluteGeometryInScreen.width;
            if (horizontal) {
                applyResize(kwinTile, diff, true);
            } else {
                applyParentResize(diff, true);
            }
        }

        // Vertical resize
        if (requestedSize.height > kwinTile.absoluteGeometryInScreen.height) {
            let diff =
                requestedSize.height - kwinTile.absoluteGeometryInScreen.height;
            if (!horizontal) {
                applyResize(kwinTile, diff, false);
            } else {
                applyParentResize(diff, false);
            }
        }
    }

    untileWindow(window: Kwin.Window, cause: TilingCause = "released"): void {
        if (this.stateOf(window) !== TilingState.Tiled) {
            return;
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            return;
        }
        this.transition(window, TilingState.Floating, cause);
        try {
            this.engine.removeClient(client);
            this.rebuildEngine();
        } catch (e) {
            this.logger.error(e);
        }
    }

    removeWindow(window: Kwin.Window): boolean {
        // a capped-out floater may have closed without ever being registered
        if (this.stateOf(window) === TilingState.Overflowed) {
            this.forget(window);
            return false;
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            this.forget(window);
            return false;
        }
        this.clients.delete(window);
        // a suspended window (registered but not tiled) leaving is pure
        // bookkeeping: it held no tile, so no slot frees up
        if (this.stateOf(window) === TilingState.Floating) {
            this.forget(window);
            return false;
        }
        this.forget(window);
        try {
            this.engine.removeClient(client);
            this.rebuildEngine();
        } catch (e) {
            this.logger.error(e);
            return false;
        }
        // a tiled slot freed up: auto-promote the oldest capped-out floater if
        // the half it targets now has room
        const overflowed = this.overflowedWindows();
        if (
            this.config.maxTiledWindowsPerHalf > 0 &&
            overflowed.length > 0 &&
            this.targetHalfCount() < this.config.maxTiledWindowsPerHalf
        ) {
            const oldest = overflowed[0];
            if (oldest != null) {
                this.logger.debug(
                    "A half has a free slot, promoting",
                    oldest.resourceClass,
                );
                this.addWindow(oldest);
                return true;
            }
        }
        return false;
    }

    // hand a managed window back to the exact state it had before the script
    // tiled it (its capture-time state), detached from any KWin tile.
    restoreWindow(window: Kwin.Window): void {
        const extensions = this.ctrl.windowExtensions.get(window);
        try {
            // detach from KWin's tiling first so nothing stays managed
            window.tile = null;
            if (extensions != undefined) {
                // undo forced stacking and the floater keep-above
                window.keepAbove = extensions.priorKeepAbove;
                window.keepBelow = extensions.priorKeepBelow;
                if (extensions.priorFullScreen) {
                    window.fullScreen = true;
                } else if (
                    extensions.priorMaximizedFull ||
                    extensions.isSingleMaximized
                ) {
                    window.setMaximize(true, true);
                }
                // a window that was already minimized when we captured it goes
                // back to being minimized
                if (extensions.priorMinimized) {
                    window.minimized = true;
                }
                // only restore geometry for plain floating windows; KWin owns
                // the geometry of minimized/maximized/fullscreen windows
                if (
                    !extensions.priorMinimized &&
                    !extensions.priorFullScreen &&
                    !extensions.priorMaximizedFull &&
                    !extensions.isSingleMaximized
                ) {
                    window.setMaximize(false, false);
                    if (extensions.priorFrameGeometry != null) {
                        window.frameGeometry = extensions.priorFrameGeometry;
                    }
                }
            } else {
                window.keepAbove = false;
                window.keepBelow = false;
            }
        } catch (e) {
            // the script is being torn down; never let cleanup take kwin down
            this.logger.error(e);
        }
    }

    untileAll(): void {
        // visual teardown only: the engine and the state machine are kept
        // intact so a later activate() can rebuild the layout
        const windows = new Set<Kwin.Window>(this.windowStates.keys());
        for (const window of this.clients.keys()) {
            windows.add(window);
        }
        this.pendingUntile.clear();
        for (const window of windows) {
            this.restoreWindow(window);
        }
    }

    // The root-level half the next window would be inserted into:
    // dwindle insertion targets the dwindle pile, active insertion targets the
    // half of the last active tiled window (falling back to the dwindle side).
    private targetHalfNode() {
        if (this.engine.config.insertionPoint == InsertionPoint.Active) {
            const activeWindow = this.ctrl.workspaceExtensions.lastActiveWindow;
            if (activeWindow != null && activeWindow.tile != null) {
                const tile = this.tiles.get(activeWindow.tile);
                if (tile != undefined) {
                    const node = this.engine.nodeOfTile(tile);
                    if (node != null) {
                        return this.engine.rootChildNode(node);
                    }
                }
            }
        }
        return this.engine.dwindleSideNode();
    }

    private targetHalfCount(): number {
        return this.engine.clientCount(this.targetHalfNode());
    }

    addWindow(window: Kwin.Window): void {
        // Idempotency guard: a window that already occupies a tile is part of
        // this driver's layout. Re-inserting it would corrupt the engine tree
        // (the same client ends up in multiple tiles).
        if (this.stateOf(window) === TilingState.Tiled) {
            return;
        }
        // window cap: leave new windows floating once the target half is full.
        // The whole layout is one half while fewer than two halves exist.
        if (
            this.config.maxTiledWindowsPerHalf > 0 &&
            this.targetHalfCount() >= this.config.maxTiledWindowsPerHalf
        ) {
            // re-hitting the cap keeps the window's existing FIFO position
            this.transition(window, TilingState.Overflowed, "capHit");
            // capped-out floaters must always sit over the tiled layer,
            // regardless of the tiled-window stacking config
            this.ctrl.windowExtensions.get(window)?.captureState();
            window.keepAbove = true;
            window.keepBelow = false;
            this.ctrl.workspace.raiseWindow(window);
            this.logger.debug(
                "Half is at its tiled window limit, leaving",
                window.resourceClass,
                "floating",
            );
            return;
        }
        if (!this.clients.has(window)) {
            this.clients.set(window, new Client(window));
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            return;
        }
        // tries to use active insertion if it should, but can fail and fall back
        let activeTile: Tile | null = null;
        if (this.engine.config.insertionPoint == InsertionPoint.Active) {
            // use last active window because kwin switches focus when new windows are added (usually)
            const activeWindow = this.ctrl.workspaceExtensions.lastActiveWindow;
            if (activeWindow != null && activeWindow.tile != null) {
                activeTile = this.tiles.get(activeWindow.tile) ?? null;
            }
        }
        try {
            if (activeTile == null) {
                this.engine.addClient(client);
            } else {
                this.engine.putClientInTile(client, activeTile);
            }
            this.rebuildEngine();
            this.transition(window, TilingState.Tiled, "added");
        } catch (e) {
            this.logger.error(e);
        }
    }

    putWindowInTile(
        window: Kwin.Window,
        kwinTile: Kwin.Tile,
        direction?: Direction,
    ) {
        let tile = this.tiles.get(kwinTile);
        if (tile == undefined) {
            this.logger.error(
                "Tile",
                kwinTile.absoluteGeometry,
                "not registered",
            );
            return;
        }
        // per-half cap: dropping a window onto a full half keeps it floating
        if (this.config.maxTiledWindowsPerHalf > 0) {
            const node = this.engine.nodeOfTile(tile);
            const half = this.engine.rootChildNode(node);
            if (
                half != null &&
                this.engine.clientCount(half) >=
                    this.config.maxTiledWindowsPerHalf
            ) {
                this.logger.debug(
                    "Drop target half is full, keeping",
                    window.resourceClass,
                    "floating",
                );
                return;
            }
        }
        if (!this.clients.has(window)) {
            this.clients.set(window, new Client(window));
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            return;
        }
        try {
            let rotatedDirection = direction;
            if (
                rotatedDirection != null &&
                this.engine.config.rotateLayout &&
                this.engine.translatesRotation
            ) {
                rotatedDirection = new DirectionTools(
                    rotatedDirection,
                ).rotateCw();
                this.logger.debug(
                    "Insertion direction rotated to",
                    rotatedDirection,
                );
            }
            this.engine.putClientInTile(client, tile, rotatedDirection);
            this.rebuildEngine();
            // a floater (including a capped-out one) that found a slot is tiled
            this.transition(window, TilingState.Tiled, "added");
        } catch (e) {
            this.logger.error(e);
        }
    }

    regenerateLayout(rootTile: Kwin.Tile) {
        const queue: Queue<Kwin.Tile> = new Queue();
        queue.enqueue(rootTile);
        while (queue.size > 0) {
            const kwinTile = queue.dequeue()!;
            const tile = this.tiles.get(kwinTile);
            if (tile == undefined) {
                this.logger.error(
                    "Tile",
                    kwinTile.absoluteGeometry,
                    "not registered",
                );
                continue;
            }
            // make sure parent squashing doesnt break resizing when a tile has one child
            // if the tile is normal, this all boils down to the old code so its whatever
            const tilesToSetSize = [tile];
            let parentTmp = tile.parent;
            while (parentTmp != null && parentTmp.tiles.length == 1) {
                tilesToSetSize.push(parentTmp);
                parentTmp = parentTmp.parent;
            }
            // because its a variable that should also be named tile... (keep the scopes clean!)
            for (const variableAlsoNamedTile of tilesToSetSize) {
                variableAlsoNamedTile.requestedSize = GSize.fromRect(
                    kwinTile.absoluteGeometry,
                );
                variableAlsoNamedTile.relativeSize = 1;
            }
            // only properly set relativeSize for the highest tile (its the only one actually affected)
            const highestTile = tilesToSetSize[tilesToSetSize.length - 1];
            if (
                kwinTile.parent != null &&
                kwinTile.parent.layoutDirection ==
                    Kwin.LayoutDirection.Horizontal
            ) {
                highestTile.relativeSize =
                    kwinTile.relativeGeometry.width /
                    kwinTile.parent.relativeGeometry.width;
            } else if (kwinTile.parent != null) {
                highestTile.relativeSize =
                    kwinTile.relativeGeometry.height /
                    kwinTile.parent.relativeGeometry.height;
            }
            for (const child of kwinTile.tiles) {
                queue.enqueue(child);
            }
        }
        try {
            this.engine.regenerateLayout();
        } catch (e) {
            this.logger.error(e);
        }
    }

    swapHalves(rootTile: Kwin.Tile): boolean {
        this.regenerateLayout(rootTile);
        if (this.engine.swapHalves()) {
            try {
                this.rebuildEngine();
                return true;
            } catch (e) {
                this.logger.error(e);
                return false;
            }
        }
        return false;
    }

    resizeTile(window: Kwin.Window, direction: number): void {
        const tile = window.tile;
        if (tile == null || tile.parent == null) {
            return;
        }
        const resizeAmount = RESIZE_AMOUNT;
        const siblingCount = tile.parent.tiles.length;
        const indexOfTile = tile.parent.tiles.indexOf(tile);
        this.logger.debug("Changing size of", tile.absoluteGeometry);

        // direction: 0=Above, 1=Right, 2=Below, 3=Left
        switch (direction) {
            case 0: // Above
                if (indexOfTile == 0) {
                    tile.resizeByPixels(-resizeAmount, Kwin.Edge.BottomEdge);
                } else {
                    tile.resizeByPixels(-resizeAmount, Kwin.Edge.TopEdge);
                }
                break;
            case 2: // Below
                if (indexOfTile == siblingCount - 1) {
                    tile.resizeByPixels(resizeAmount, Kwin.Edge.TopEdge);
                } else {
                    tile.resizeByPixels(resizeAmount, Kwin.Edge.BottomEdge);
                }
                break;
            case 3: // Left
                if (indexOfTile == 0) {
                    tile.resizeByPixels(-resizeAmount, Kwin.Edge.RightEdge);
                } else {
                    tile.resizeByPixels(-resizeAmount, Kwin.Edge.LeftEdge);
                }
                break;
            case 1: // Right
                if (indexOfTile == siblingCount - 1) {
                    tile.resizeByPixels(resizeAmount, Kwin.Edge.LeftEdge);
                } else {
                    tile.resizeByPixels(resizeAmount, Kwin.Edge.RightEdge);
                }
                break;
        }
    }
}
