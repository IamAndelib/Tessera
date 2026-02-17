// driver.ts - Interface from drivers/engines to the controller

import { TilingDriver } from "./driver";
import { EngineConfig, TilingEngineFactory } from "../engine";
import { Window, Tile, Output } from "kwin-api";
import { QTimer } from "kwin-api/qt";
import { Direction } from "../util/geometry";
import { Controller } from "../controller";
import { Log } from "../util/log";
import { Config } from "../util/config";
import { Desktop } from "../controller/desktop";

export class DriverManager {
    private drivers: Map<string, TilingDriver> = new Map();
    private engineFactory: TilingEngineFactory;
    private rootTileCallbacks: Map<Tile, QTimer> = new Map();

    private ctrl: Controller;
    private logger: Log;
    private config: Config;

    buildingLayout: boolean = false;
    resizingLayout: boolean = false;

    constructor(c: Controller) {
        this.ctrl = c;
        this.engineFactory = new TilingEngineFactory(this.ctrl.config);
        this.logger = c.logger;
        this.config = c.config;
    }

    init(): void {
        const c = this.ctrl;
        c.workspace.screensChanged.connect(this.generateDrivers.bind(this));
        c.workspace.desktopsChanged.connect(this.generateDrivers.bind(this));
        c.workspace.activitiesChanged.connect(this.generateDrivers.bind(this));
        this.generateDrivers();
    }

    private generateDrivers(): void {
        // all drivers get pre generated now, no lazy loading
        // also handles driver regeneration on screen/layout changes
        const currentDesktops = new Set<string>(this.drivers.keys());
        for (const desktop of this.ctrl.desktopFactory.createAllDesktops()) {
            const desktopString = desktop.toString();
            if (!currentDesktops.has(desktopString)) {
                // create new desktop
                this.logger.debug(
                    "Creating new engine for desktop",
                    desktopString,
                );
                let rotateLayout = this.config.rotateLayout;
                if (
                    this.config.autoRotateLayout &&
                    desktop.output.geometry.width <
                        desktop.output.geometry.height
                ) {
                    this.logger.debug(
                        "Auto rotate layout for desktop",
                        desktopString,
                    );
                    rotateLayout = !rotateLayout;
                }
                const config = this.config.createDefaultEngineConfig();
                config.rotateLayout = rotateLayout;
                const engine = this.engineFactory.newEngine(config);
                const driver = new TilingDriver(engine, this.ctrl);
                this.drivers.set(desktopString, driver);
                this.ctrl.dbusManager.getSettings(
                    desktopString,
                    this.setEngineConfig.bind(this, desktop),
                );
            } else {
                currentDesktops.delete(desktopString);
            }
        }
        // remove engines for desktops that no longer exist
        for (const desktop of currentDesktops) {
            this.drivers.delete(desktop);
        }
        // remove tiles that dont exist
        for (const tile of this.rootTileCallbacks.keys()) {
            let remove = true;
            for (const output of this.ctrl.workspace.screens) {
                if (
                    this.ctrl.workspace.tilingForScreen(output).rootTile == tile
                ) {
                    remove = false;
                    break;
                }
            }
            if (remove && this.rootTileCallbacks.has(tile)) {
                this.rootTileCallbacks.get(tile)!.destroy();
                this.rootTileCallbacks.delete(tile);
            }
        }
        // register tiles that do exist
        for (const output of this.ctrl.workspace.screens) {
            const rootTile =
                this.ctrl.workspace.tilingForScreen(output).rootTile;
            if (this.ctrl.managedTiles.has(rootTile)) {
                continue;
            }
            this.ctrl.managedTiles.add(rootTile);
            const timer = this.ctrl.qmlObjects.root.createTimer();
            timer.interval = this.config.timerDelay;
            timer.triggered.connect(
                this.layoutModifiedCallback.bind(this, rootTile, output),
            );
            timer.repeat = false;
            this.rootTileCallbacks.set(rootTile, timer);
            rootTile.layoutModified.connect(
                this.layoutModified.bind(this, rootTile),
            );
        }
    }

    private layoutModified(tile: Tile): void {
        if (this.buildingLayout) {
            return;
        }
        this.resizingLayout = true;
        const timer = this.rootTileCallbacks.get(tile);
        if (timer == undefined) {
            this.logger.error(
                "Callback not registered for root tile",
                tile.absoluteGeometry,
            );
            return;
        }
        timer.restart();
    }

    private layoutModifiedCallback(tile: Tile, output: Output): void {
        this.logger.debug("Layout modified for tile", tile.absoluteGeometry);
        const desktop = new Desktop(
            this.ctrl.workspace.currentDesktop,
            this.ctrl.workspace.currentActivity,
            output,
        );
        const driver = this.drivers.get(desktop.toString());
        if (!driver) {
            this.logger.error("No driver for desktop", desktop.toString());
            return;
        }
        driver.regenerateLayout(tile);
        if (this.config.saveOnTileEdit) {
            this.ctrl.dbusManager.setSettings(
                desktop.toString(),
                driver.engineConfig,
            );
        }
        this.resizingLayout = false;
    }

    private applyTiled(window: Window): void {
        this.ctrl.windowExtensions.get(window)!.isTiled = true;
    }

    private applyUntiled(window: Window): void {
        const extensions = this.ctrl.windowExtensions.get(window)!;
        extensions.isTiled = false;
        extensions.isSingleMaximized = false;
        window.keepAbove = false;
        window.keepBelow = false;
    }

    rebuildLayout(output?: Output): void {
        this.buildingLayout = true;
        let desktops: Desktop[];
        if (output == undefined) {
            desktops = this.ctrl.desktopFactory.createVisibleDesktops();
        } else {
            desktops = [
                new Desktop(
                    this.ctrl.workspace.currentDesktop,
                    this.ctrl.workspace.currentActivity,
                    output,
                ),
            ];
        }
        this.logger.debug("Rebuilding layout for desktops", desktops);
        for (const desktop of desktops) {
            const driver = this.drivers.get(desktop.toString());
            if (!driver) {
                this.logger.error("No driver for desktop", desktop.toString());
                continue;
            }
            // move this above to correctly set isTiled
            for (const window of driver.clients.keys()) {
                if (!driver.untiledWindows.has(window)) {
                    this.applyTiled(window);
                }
            }
            driver.buildLayout(
                this.ctrl.workspace.tilingForScreen(desktop.output).rootTile,
            );
            // make registered "untiled" clients appear untiled
            for (const window of driver.untiledWindows) {
                const extensions = this.ctrl.windowExtensions.get(window)!;
                if (!extensions.isTiled) {
                    continue;
                }
                // sometimes effects on untiled windows dont properly apply
                let fullscreen: boolean = false;
                if (window.fullScreen) {
                    window.fullScreen = false;
                    fullscreen = true;
                }
                const wasSingleMaximized = extensions.isSingleMaximized;
                this.applyUntiled(window);
                window.tile = null;
                if (wasSingleMaximized) {
                    window.setMaximize(false, false);
                }
                if (fullscreen) {
                    window.fullScreen = true;
                }
            }
        }
        this.buildingLayout = false;
    }

    untileWindow(window: Window, desktops?: Desktop[]): void {
        if (desktops == undefined) {
            desktops =
                this.ctrl.desktopFactory.createDesktopsFromWindow(window);
        }
        this.logger.debug(
            "Untiling window",
            window.resourceClass,
            "on desktops",
            desktops,
        );
        for (const desktop of desktops) {
            const driver = this.drivers.get(desktop.toString());
            if (driver) {
                driver.untileWindow(window);
            }
        }
    }

    addWindow(window: Window, desktops?: Desktop[]): void {
        if (desktops == undefined) {
            desktops =
                this.ctrl.desktopFactory.createDesktopsFromWindow(window);
        }
        this.logger.debug(
            "Adding window",
            window.resourceClass,
            "to desktops",
            desktops,
        );
        for (const desktop of desktops) {
            const driver = this.drivers.get(desktop.toString());
            if (driver) {
                driver.addWindow(window);
            }
        }
    }

    removeWindow(window: Window, desktops?: Desktop[]): void {
        if (desktops == undefined) {
            desktops =
                this.ctrl.desktopFactory.createDesktopsFromWindow(window);
        }
        this.logger.debug(
            "Removing window",
            window.resourceClass,
            "from desktops",
            desktops,
        );
        for (const desktop of desktops) {
            const driver = this.drivers.get(desktop.toString());
            if (driver) {
                driver.removeWindow(window);
            }
        }
    }

    putWindowInTile(window: Window, tile: Tile, direction?: Direction) {
        const desktop = this.ctrl.desktopFactory.createDefaultDesktop();
        desktop.output = window.output;
        this.logger.debug(
            "Putting client",
            window.resourceClass,
            "in tile",
            tile.absoluteGeometry,
            "with direction",
            direction,
            "on desktop",
            desktop,
        );
        const driver = this.drivers.get(desktop.toString());
        if (!driver) {
            this.logger.error("No driver for desktop", desktop.toString());
            return;
        }
        driver.putWindowInTile(window, tile, direction);
    }

    getEngineConfig(desktop: Desktop): EngineConfig | null {
        this.logger.debug("Getting engine config for desktop", desktop);
        const driver = this.drivers.get(desktop.toString());
        return driver?.engineConfig ?? null;
    }

    setEngineConfig(desktop: Desktop, config: EngineConfig) {
        this.logger.debug("Setting engine config for desktop", desktop);
        const driver = this.drivers.get(desktop.toString());
        if (!driver) {
            this.logger.error("No driver for desktop", desktop.toString());
            return;
        }
        driver.engineConfig = config;
        this.ctrl.dbusManager.setSettings(
            desktop.toString(),
            driver.engineConfig,
        );
        this.rebuildLayout(desktop.output);
    }

    removeEngineConfig(desktop: Desktop): void {
        this.logger.debug("Removing engine config for desktop", desktop);
        const config = this.config.createDefaultEngineConfig();
        const driver = this.drivers.get(desktop.toString());
        if (driver) {
            driver.engineConfig = config;
        }
        this.ctrl.dbusManager.removeSettings(desktop.toString());
        this.rebuildLayout(desktop.output);
    }

    // Get the driver for a specific desktop (used by shortcuts for Hyprland-style operations)
    getDriver(desktop: Desktop): TilingDriver | undefined {
        return this.drivers.get(desktop.toString());
    }

    quitFullScreen(output: Output): void {
        this.ctrl.workspace.windows.forEach((window) => {
            if (window.output == output && window.fullScreen) {
                window.fullScreen = false;
            }
            // not sure how to check for maximized so i just disable
            // it for all in the same output.
            if (window.output == output) {
                window.setMaximize(false, false);
            }
        });
    }
}
