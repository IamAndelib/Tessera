// actions/shortcuts.ts - Shortcuts invoked directly by the user

import { Controller } from "../";
import { Edge, Tile, Window } from "kwin-api";
import { GPoint, Direction as GDirection } from "../../util/geometry";
import { QPoint } from "kwin-api/qt";
import { Log } from "../../util/log";
import { Config } from "../../util/config";

const enum Direction {
    Above,
    Right,
    Below,
    Left,
}

function pointInDirection(window: Window, direction: Direction): GPoint | null {
    if (window.tile == null) {
        return null;
    }

    const geometry = window.frameGeometry;
    const padding = window.tile.padding;

    switch (direction) {
        case Direction.Above:
            return new GPoint({
                x: geometry.x + 1,
                y: geometry.y - 1 - padding,
            });
        case Direction.Below:
            return new GPoint({
                x: geometry.x + 1,
                y: geometry.y + geometry.height + 1 + padding,
            });
        case Direction.Left:
            return new GPoint({
                x: geometry.x - 1 - padding,
                y: geometry.y + 1,
            });
        case Direction.Right:
            return new GPoint({
                x: geometry.x + geometry.width + 1 + padding,
                y: geometry.y + 1,
            });
        default:
            return null;
    }
}

function gdirectionFromDirection(direction: Direction): GDirection {
    switch (direction) {
        case Direction.Above:
            return GDirection.Up | GDirection.Vertical;
        case Direction.Below:
            return GDirection.Vertical;
        case Direction.Left:
            return GDirection.None;
        case Direction.Right:
            return GDirection.Right;
    }
}

export class ShortcutManager {
    private ctrl: Controller;
    private logger: Log;
    private config: Config;

    constructor(ctrl: Controller) {
        this.ctrl = ctrl;
        this.logger = ctrl.logger;
        this.config = ctrl.config;
        const shortcuts = ctrl.qmlObjects.shortcuts;
        shortcuts
            .getRetileWindow()
            .activated.connect(this.retileWindow.bind(this));
        shortcuts
            .getOpenSettings()
            .activated.connect(this.openSettingsDialog.bind(this));

        shortcuts
            .getFocusAbove()
            .activated.connect(this.focus.bind(this, Direction.Above));
        shortcuts
            .getFocusBelow()
            .activated.connect(this.focus.bind(this, Direction.Below));
        shortcuts
            .getFocusLeft()
            .activated.connect(this.focus.bind(this, Direction.Left));
        shortcuts
            .getFocusRight()
            .activated.connect(this.focus.bind(this, Direction.Right));

        shortcuts
            .getInsertAbove()
            .activated.connect(this.insert.bind(this, Direction.Above));
        shortcuts
            .getInsertBelow()
            .activated.connect(this.insert.bind(this, Direction.Below));
        shortcuts
            .getInsertLeft()
            .activated.connect(this.insert.bind(this, Direction.Left));
        shortcuts
            .getInsertRight()
            .activated.connect(this.insert.bind(this, Direction.Right));

        shortcuts
            .getResizeAbove()
            .activated.connect(this.resize.bind(this, Direction.Above));
        shortcuts
            .getResizeBelow()
            .activated.connect(this.resize.bind(this, Direction.Below));
        shortcuts
            .getResizeLeft()
            .activated.connect(this.resize.bind(this, Direction.Left));
        shortcuts
            .getResizeRight()
            .activated.connect(this.resize.bind(this, Direction.Right));

        shortcuts
            .getRotateLayout()
            .activated.connect(this.rotateLayout.bind(this));

        // Hyprland-style shortcuts
        shortcuts.getSwapHalves().activated.connect(this.swapHalves.bind(this));
        shortcuts
            .getSwapWithSibling()
            .activated.connect(this.swapWithSibling.bind(this));
        shortcuts
            .getSwapAbove()
            .activated.connect(
                this.swapInDirection.bind(this, Direction.Above),
            );
        shortcuts
            .getSwapBelow()
            .activated.connect(
                this.swapInDirection.bind(this, Direction.Below),
            );
        shortcuts
            .getSwapLeft()
            .activated.connect(this.swapInDirection.bind(this, Direction.Left));
        shortcuts
            .getSwapRight()
            .activated.connect(
                this.swapInDirection.bind(this, Direction.Right),
            );
        shortcuts
            .getToggleSplit()
            .activated.connect(this.toggleSplit.bind(this));
        shortcuts
            .getCycleNext()
            .activated.connect(this.cycleNext.bind(this, false));
        shortcuts
            .getCyclePrev()
            .activated.connect(this.cycleNext.bind(this, true));
    }

    retileWindow(): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null || !this.ctrl.windowExtensions.has(window)) {
            return;
        }
        if (this.ctrl.windowExtensions.get(window)!.isTiled) {
            this.ctrl.driverManager.untileWindow(window);
        } else {
            this.ctrl.driverManager.addWindow(window);
        }
        this.ctrl.driverManager.rebuildLayout();
    }

    openSettingsDialog(): void {
        const settings = this.ctrl.qmlObjects.settings;
        if (settings.isVisible()) {
            settings.hide();
        } else {
            const config = this.ctrl.driverManager.getEngineConfig(
                this.ctrl.desktopFactory.createDefaultDesktop(),
            );
            if (!config) return;
            settings.setSettings(config);
            settings.show();
        }
    }

    tileInDirection(window: Window, point: QPoint | null): Tile | null {
        if (point == null) {
            return null;
        }
        return this.ctrl.workspace
            .tilingForScreen(window.output)
            .bestTileForPosition(point.x, point.y);
    }

    focus(direction: Direction): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null) {
            return;
        }
        let tile = this.tileInDirection(
            window,
            pointInDirection(window, direction),
        );
        if (tile == null) {
            tile = this.ctrl.workspace.tilingForScreen(window.output).rootTile;
            while (tile.tiles.length == 1) {
                tile = tile.tiles[0];
            }
        }
        if (tile.windows.length == 0) {
            return;
        }
        const newWindow = tile.windows[0];
        this.logger.debug("Focusing", newWindow.resourceClass);
        this.ctrl.workspace.activeWindow = newWindow;
    }

    insert(direction: Direction): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null) {
            return;
        }
        const point = pointInDirection(window, direction);
        this.logger.debug("Moving", window.resourceClass);
        this.ctrl.driverManager.untileWindow(window);
        this.ctrl.driverManager.rebuildLayout(window.output);
        let tile = this.tileInDirection(window, point);
        if (tile == null) {
            // usually this works
            tile = this.ctrl.workspace.tilingForScreen(window.output).rootTile;
            while (tile.tiles.length == 1) {
                tile = tile.tiles[0];
            }
        }
        this.ctrl.driverManager.putWindowInTile(
            window,
            tile,
            gdirectionFromDirection(direction),
        );
        this.ctrl.driverManager.rebuildLayout(window.output);
    }

    resize(direction: Direction): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null || window.tile == null) {
            return;
        }
        const tile = window.tile;
        const resizeAmount = this.config.resizeAmount;
        // dont change size for root tile
        if (tile.parent == null) {
            return;
        }
        // kwin shouldnt nest tiles so no need to bubble up hopefully
        const siblingCount = tile.parent.tiles.length;
        const indexOfTile = tile.parent.tiles.indexOf(tile);
        // should auto trigger the resize callback
        this.logger.debug("Changing size of", tile.absoluteGeometry);
        switch (direction) {
            // have to put special cases for each of these if at top/bottom of layout
            case Direction.Above:
                if (indexOfTile == 0) {
                    tile.resizeByPixels(-resizeAmount, Edge.BottomEdge);
                } else {
                    tile.resizeByPixels(-resizeAmount, Edge.TopEdge);
                }
                break;
            case Direction.Below:
                if (indexOfTile == siblingCount - 1) {
                    tile.resizeByPixels(resizeAmount, Edge.TopEdge);
                } else {
                    tile.resizeByPixels(resizeAmount, Edge.BottomEdge);
                }
                break;
            case Direction.Left:
                if (indexOfTile == 0) {
                    tile.resizeByPixels(-resizeAmount, Edge.RightEdge);
                } else {
                    tile.resizeByPixels(-resizeAmount, Edge.LeftEdge);
                }
                break;
            case Direction.Right:
                if (indexOfTile == siblingCount - 1) {
                    tile.resizeByPixels(resizeAmount, Edge.LeftEdge);
                } else {
                    tile.resizeByPixels(resizeAmount, Edge.RightEdge);
                }
                break;
        }
    }

    rotateLayout(): void {
        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        const engineConfig = this.ctrl.driverManager.getEngineConfig(desktop);
        if (!engineConfig) return;
        engineConfig.rotateLayout = !engineConfig.rotateLayout;
        this.ctrl.qmlObjects.osd.show(
            "Vertical-First: " + engineConfig.rotateLayout,
        );
        this.ctrl.driverManager.setEngineConfig(desktop, engineConfig);
    }

    // Swap the two halves (root subtrees) of the current screen's layout
    swapHalves(): void {
        this.logger.debug("swapHalves: triggered");
        const window = this.ctrl.workspace.activeWindow;
        if (window == null) {
            this.logger.debug("swapHalves: no active window, aborting");
            return;
        }
        if (!this.ctrl.windowExtensions.get(window)?.isTiled) {
            this.logger.debug(
                "swapHalves: active window not tiled, aborting",
                window.resourceClass,
            );
            return;
        }

        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        this.logger.debug("swapHalves: desktop key =", desktop.toString());
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) {
            this.logger.debug("swapHalves: no driver found for desktop");
            return;
        }

        const engine = driver.engine;
        this.logger.debug(
            "swapHalves: calling engine.swapHalves, clients count =",
            driver.clients.size,
        );

        // Sync live KWin tile sizes into the engine tree before swapping.
        // This ensures node.sizeRatio reflects the actual current layout,
        // not a potentially stale value from before the user resized.
        const kwinRootTile = this.ctrl.workspace.tilingForScreen(
            window.output,
        ).rootTile;

        if (driver.swapHalves(kwinRootTile)) {
            this.ctrl.driverManager.rebuildLayout(window.output);
        } else {
            this.ctrl.qmlObjects.osd.show(
                "Cannot swap: less than 2 windows tiled",
            );
        }
    }

    // Hyprland-style: swap focused window with its sibling
    swapWithSibling(): void {
        const window = this.ctrl.workspace.activeWindow;
        if (
            window == null ||
            !this.ctrl.windowExtensions.get(window)?.isTiled
        ) {
            return;
        }
        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) return;

        const client = driver.clients.get(window);
        if (!client) return;

        const engine = driver.engine;
        const sibling = engine.getSiblingClient(client);
        if (sibling) {
            engine.swapClients(client, sibling);
            engine.buildLayout();
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.logger.debug("Swapped window with sibling");
        }
    }

    // Hyprland-style: swap with window in a direction
    swapInDirection(direction: Direction): void {
        const window = this.ctrl.workspace.activeWindow;
        if (
            window == null ||
            !this.ctrl.windowExtensions.get(window)?.isTiled
        ) {
            return;
        }
        const point = pointInDirection(window, direction);
        const targetTile = this.tileInDirection(window, point);
        if (!targetTile || targetTile.windows.length === 0) {
            return;
        }
        const targetWindow = targetTile.windows[0];
        if (targetWindow === window) return;

        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) return;

        const client1 = driver.clients.get(window);
        const client2 = driver.clients.get(targetWindow);
        if (!client1 || !client2) return;

        const engine = driver.engine;
        if (engine.swapClients(client1, client2)) {
            engine.buildLayout();
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.logger.debug("Swapped windows in direction", direction);
        }
    }

    // Hyprland-style: toggle split direction at current window
    toggleSplit(): void {
        const window = this.ctrl.workspace.activeWindow;
        if (
            window == null ||
            !this.ctrl.windowExtensions.get(window)?.isTiled
        ) {
            return;
        }
        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) return;

        const client = driver.clients.get(window);
        if (!client) return;

        const engine = driver.engine;
        if (engine.toggleSplit(client)) {
            engine.buildLayout();
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.ctrl.qmlObjects.osd.show("Split direction toggled");
            this.logger.debug("Toggled split direction");
        }
    }

    // Cycle focus to next/previous tiled window
    cycleNext(reverse: boolean = false): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null) return;

        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) return;

        const engine = driver.engine;
        const allClients = engine.getAllClients();
        if (allClients.length < 2) return;

        // Find current window's index
        const currentClient = driver.clients.get(window);
        if (!currentClient) return;
        const currentIndex = allClients.indexOf(currentClient);
        if (currentIndex === -1) return;

        // Get next/prev index with wraparound
        let nextIndex: number;
        if (reverse) {
            nextIndex =
                currentIndex === 0 ? allClients.length - 1 : currentIndex - 1;
        } else {
            nextIndex =
                currentIndex === allClients.length - 1 ? 0 : currentIndex + 1;
        }

        // Find the window for the next client and focus it
        const nextClient = allClients[nextIndex];
        for (const [w, c] of driver.clients.entries()) {
            if (c === nextClient) {
                this.ctrl.workspace.activeWindow = w;
                this.logger.debug("Cycled to window", w.resourceClass);
                break;
            }
        }
    }
}
