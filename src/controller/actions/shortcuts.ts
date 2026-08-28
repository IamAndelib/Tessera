// actions/shortcuts.ts - Shortcuts invoked directly by the user

import type { Controller } from "../index";
import { Tile, Window } from "kwin-api";
import type { ShortcutHandler } from "kwin-api/qml";
import { GPoint, Direction as GDirection } from "../../util/geometry";
import { QPoint } from "kwin-api/qt";
import { Log } from "../../util/log";
import { Config } from "../../util/config";
import { TilingDriver } from "../../driver/driver";
import { Client } from "../../engine";

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

        const bindings: Array<[get: () => ShortcutHandler, fn: () => void]> = [
            [shortcuts.getRetileWindow, this.retileWindow.bind(this)],
            [shortcuts.getOpenSettings, this.openSettingsDialog.bind(this)],

            [shortcuts.getFocusAbove, this.focus.bind(this, Direction.Above)],
            [shortcuts.getFocusBelow, this.focus.bind(this, Direction.Below)],
            [shortcuts.getFocusLeft, this.focus.bind(this, Direction.Left)],
            [shortcuts.getFocusRight, this.focus.bind(this, Direction.Right)],

            [shortcuts.getInsertAbove, this.insert.bind(this, Direction.Above)],
            [shortcuts.getInsertBelow, this.insert.bind(this, Direction.Below)],
            [shortcuts.getInsertLeft, this.insert.bind(this, Direction.Left)],
            [shortcuts.getInsertRight, this.insert.bind(this, Direction.Right)],

            [shortcuts.getResizeAbove, this.resize.bind(this, Direction.Above)],
            [shortcuts.getResizeBelow, this.resize.bind(this, Direction.Below)],
            [shortcuts.getResizeLeft, this.resize.bind(this, Direction.Left)],
            [shortcuts.getResizeRight, this.resize.bind(this, Direction.Right)],

            [shortcuts.getRotateLayout, this.rotateLayout.bind(this)],

            // Hyprland-style shortcuts
            [shortcuts.getSwapHalves, this.swapHalves.bind(this)],
            [shortcuts.getSwapWithSibling, this.swapWithSibling.bind(this)],
            [shortcuts.getSwapAbove, this.swapInDirection.bind(this, Direction.Above)],
            [shortcuts.getSwapBelow, this.swapInDirection.bind(this, Direction.Below)],
            [shortcuts.getSwapLeft, this.swapInDirection.bind(this, Direction.Left)],
            [shortcuts.getSwapRight, this.swapInDirection.bind(this, Direction.Right)],
            [shortcuts.getToggleSplit, this.toggleSplit.bind(this)],
            [shortcuts.getCycleNext, this.cycleNext.bind(this, false)],
            [shortcuts.getCyclePrev, this.cycleNext.bind(this, true)],
        ];
        for (const [get, fn] of bindings) {
            get().activated.connect(fn);
        }
    }

    // Shared helper: gets the active window's driver and engine client, or null
    private getActiveDriverAndClient(): {
        window: Window;
        driver: TilingDriver;
        client: Client;
    } | null {
        const window = this.ctrl.workspace.activeWindow;
        if (!window || !this.ctrl.windowExtensions.get(window)?.isTiled)
            return null;
        const desktop = this.ctrl.desktopFactory.createDefaultDesktop(window.output);
        const driver = this.ctrl.driverManager.getDriver(desktop);
        if (!driver) return null;
        const client = driver.clients.get(window);
        if (!client) return null;
        return { window, driver, client };
    }

    retileWindow(): void {
        const window = this.ctrl.workspace.activeWindow;
        if (window == null || !this.ctrl.windowExtensions.has(window)) {
            return;
        }
        const ext = this.ctrl.windowExtensions.get(window);
        if (ext == undefined) {
            return;
        }
        if (ext.isTiled) {
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
        // Resolve the target tile from the current layout before removing the
        // window. Removing it only redistributes sibling sizes, so the picked
        // tile stays valid and the intermediate rebuild is unnecessary.
        let tile = this.tileInDirection(window, point);
        if (tile == null) {
            // usually this works
            tile = this.ctrl.workspace.tilingForScreen(window.output).rootTile;
            while (tile.tiles.length == 1) {
                tile = tile.tiles[0];
            }
        }
        this.logger.debug("Moving", window.resourceClass);
        this.ctrl.driverManager.untileWindow(window);
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
        this.ctrl.driverManager.resizeWindow(window, direction);
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
        const ctx = this.getActiveDriverAndClient();
        if (!ctx) {
            this.logger.debug("swapHalves: no active tiled window, aborting");
            return;
        }
        const { window, driver } = ctx;

        // Sync live KWin tile sizes into the engine tree before swapping.
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
        const ctx = this.getActiveDriverAndClient();
        if (!ctx) return;
        const { window, driver, client } = ctx;

        const sibling = driver.engine.getSiblingClient(client);
        if (sibling) {
            driver.engine.swapClients(client, sibling);
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.logger.debug("Swapped window with sibling");
        }
    }

    // Hyprland-style: swap with window in a direction
    swapInDirection(direction: Direction): void {
        const ctx = this.getActiveDriverAndClient();
        if (!ctx) return;
        const { window, driver, client: client1 } = ctx;

        const point = pointInDirection(window, direction);
        const targetTile = this.tileInDirection(window, point);
        if (!targetTile || targetTile.windows.length === 0) return;

        const targetWindow = targetTile.windows[0];
        if (targetWindow === window) return;

        const client2 = driver.clients.get(targetWindow);
        if (!client2) return;

        if (driver.engine.swapClients(client1, client2)) {
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.logger.debug("Swapped windows in direction", direction);
        }
    }

    // Hyprland-style: toggle split direction at current window
    toggleSplit(): void {
        const ctx = this.getActiveDriverAndClient();
        if (!ctx) return;
        const { window, driver, client } = ctx;

        if (driver.engine.toggleSplit(client)) {
            this.ctrl.driverManager.rebuildLayout(window.output);
            this.ctrl.qmlObjects.osd.show("Split direction toggled");
            this.logger.debug("Toggled split direction");
        }
    }

    // Cycle focus to next/previous tiled window
    cycleNext(reverse: boolean = false): void {
        const ctx = this.getActiveDriverAndClient();
        if (!ctx) return;
        const { driver, client: currentClient } = ctx;

        const allClients = driver.engine.getAllClients();
        if (allClients.length < 2) return;

        const currentIndex = allClients.indexOf(currentClient);
        if (currentIndex === -1) return;

        // Get next/prev index with wraparound
        const nextIndex = reverse
            ? currentIndex === 0
                ? allClients.length - 1
                : currentIndex - 1
            : currentIndex === allClients.length - 1
              ? 0
              : currentIndex + 1;

        // Use BiMap inverse for O(1) lookup instead of iterating entries
        const nextWindow = driver.clients.inverse.get(allClients[nextIndex]);
        if (nextWindow) {
            this.ctrl.workspace.activeWindow = nextWindow;
            this.logger.debug("Cycled to window", nextWindow.resourceClass);
        }
    }
}
