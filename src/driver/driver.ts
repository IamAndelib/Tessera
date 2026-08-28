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

export class TilingDriver {
    engine: BTreeEngine;

    private logger: Log;
    private config: Config;
    private ctrl: Controller;

    tiles: BiMap<Kwin.Tile, Tile> = new BiMap();
    clients: BiMap<Kwin.Window, Client> = new BiMap();
    // windows that have no associated tile but are still in an engine go here
    untiledWindows: Set<Kwin.Window> = new Set();
    // windows declined tiling because the cap was reached (FIFO for auto-promotion)
    private overflowedWindows: Set<Kwin.Window> = new Set();

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
            this.engine.buildLayout();
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

    buildLayout(rootTile: Kwin.Tile): void {
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

    untileWindow(window: Kwin.Window): void {
        if (this.untiledWindows.has(window)) {
            return;
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            return;
        }
        this.untiledWindows.add(window);
        try {
            this.engine.removeClient(client);
            this.engine.buildLayout();
        } catch (e) {
            this.logger.error(e);
        }
    }

    removeWindow(window: Kwin.Window): boolean {
        // a capped-out floater may have closed without ever being registered
        this.overflowedWindows.delete(window);
        const client = this.clients.get(window);
        if (client == undefined) {
            return false;
        }
        this.clients.delete(window);
        if (this.untiledWindows.has(window)) {
            this.untiledWindows.delete(window);
            return false;
        }
        try {
            this.engine.removeClient(client);
            this.engine.buildLayout();
        } catch (e) {
            this.logger.error(e);
            return false;
        }
        // a tiled slot freed up: auto-promote the oldest capped-out floater if
        // the half it targets now has room
        if (
            this.config.maxTiledWindowsPerHalf > 0 &&
            this.overflowedWindows.size > 0 &&
            this.targetHalfCount() < this.config.maxTiledWindowsPerHalf
        ) {
            const oldest = this.overflowedWindows.values().next().value;
            if (oldest != null) {
                this.overflowedWindows.delete(oldest);
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
        // Idempotency guard: if the window is already a registered client and
        // is not marked untiled, it's already part of this driver's layout.
        // Re-inserting corrupts the engine tree (the same client ends up in
        // multiple tiles).
        if (this.clients.has(window) && !this.untiledWindows.has(window)) {
            return;
        }
        // window cap: leave new windows floating once the target half is full.
        // The whole layout is one half while fewer than two halves exist.
        if (
            this.config.maxTiledWindowsPerHalf > 0 &&
            this.targetHalfCount() >= this.config.maxTiledWindowsPerHalf
        ) {
            this.overflowedWindows.add(window);
            // capped-out floaters must always sit over the tiled layer,
            // regardless of the tiled-window stacking config
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
        this.overflowedWindows.delete(window);
        if (!this.clients.has(window)) {
            this.clients.set(window, new Client(window));
        }
        const client = this.clients.get(window);
        if (client == undefined) {
            return;
        }
        this.untiledWindows.delete(window);
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
            this.engine.buildLayout();
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
        this.untiledWindows.delete(window);
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
            this.engine.buildLayout();
            // a capped-out floater that found a slot is no longer overflowing
            this.overflowedWindows.delete(window);
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
                this.engine.buildLayout();
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
