// controller.ts - Main controller object of the script

import { Options, Tile, Window } from "kwin-api";
import { Workspace } from "kwin-api/qml";
import * as Qml from "../extern/qml";

import { Log } from "../util/log";
import { Config, TIMER_DELAY } from "../util/config";

import { DriverManager } from "../driver";

import { DesktopFactory } from "./desktop";
import { WindowExtensions, WorkspaceExtensions } from "./extensions";
import { ShortcutManager } from "./actions/shortcuts";
import { WindowHookManager } from "./actions/windowhooks";
import { WorkspaceActions } from "./actions/basic";
import { QTimer } from "kwin-api/qt";

export class Controller {
    workspace: Workspace;
    options: Options;
    qmlObjects: Qml.Objects;

    desktopFactory: DesktopFactory;

    driverManager: DriverManager;
    shortcutManager: ShortcutManager;
    windowHookManager: WindowHookManager;
    workspaceActions: WorkspaceActions;

    logger: Log;
    config: Config;

    workspaceExtensions: WorkspaceExtensions;
    windowExtensions: Map<Window, WindowExtensions> = new Map();
    managedTiles: Set<Tile> = new Set();

    initTimer: QTimer;
    private initRetryCount: number = 0;
    private static readonly MAX_INIT_RETRIES: number = 50;

    // whether the script is actively tiling. Turning it off restores every
    // managed window and makes all tiling/hook/shortcut handling inert.
    active: boolean = true;

    constructor(qmlApi: Qml.Api, qmlObjects: Qml.Objects) {
        this.workspace = qmlApi.workspace;
        this.options = qmlApi.options;
        this.qmlObjects = qmlObjects;

        this.desktopFactory = new DesktopFactory(this.workspace);

        const kwinApi = qmlApi.kwin;
        this.config = new Config(kwinApi);
        this.logger = new Log(this.qmlObjects.root);
        this.logger.debugEnabled = this.config.debug;
        this.logger.info("Tessera started!");

        this.workspaceExtensions = new WorkspaceExtensions(this.workspace);

        this.driverManager = new DriverManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.windowHookManager = new WindowHookManager(this);
        this.workspaceActions = new WorkspaceActions(this);

        // delayed init will help with some stuff
        this.initTimer = qmlObjects.root.createTimer();
        this.initTimer.interval = TIMER_DELAY;
        this.initTimer.triggered.connect(this.initCallback.bind(this));
        this.initTimer.repeat = false;
    }

    init(): void {
        this.initTimer.start();
    }

    // script-native on/off: restores every window and stops tiling, or resumes
    // tiling from the current (floating) layout like a fresh install
    toggleTiling(): void {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    deactivate(): void {
        if (!this.active) {
            return;
        }
        this.logger.info("Tessera tiling disabled by toggle");
        this.active = false;
        // hand every managed window back to its pre-tiling state and detach
        // them from KWin tiles; all hooks/shortcuts are inactive from now on
        this.driverManager.untileAll();
        this.showOsd("kt-restore-defaults", "Tiling disabled");
    }

    activate(): void {
        if (this.active) {
            return;
        }
        this.logger.info("Tessera tiling enabled by toggle");
        this.active = true;
        // re-tile the windows the drivers still know about, then take in any
        // windows that arrived while tiling was off
        this.driverManager.rebuildLayout();
        this.backfillExistingWindows();
        this.showOsd("view-grid", "Tiling enabled");
    }

    // release windows when the script is unloaded, disabled or removed.
    // guards against running during an actual KWin logout and never lets
    // a teardown error take KWin down with it.
    destroy(): void {
        this.logger.debug("Tessera unload cleanup started");
        try {
            if (this.workspace.screens.length == 0) {
                return;
            }
            this.driverManager.untileAll();
            this.notifyDisabled();
        } catch (e) {
            this.logger.error(e);
        }
    }

    // warn when the user disables Tessera mid-session: re-enabling from
    // System Settings is broken on some KWin versions (upstream script reload
    // issue) so one more click without a login will look like it did nothing.
    // fire and forget - this is the last thing the script does before KWin
    // tears it down.
    private notifyDisabled(): void {
        try {
            const notify = this.qmlObjects.notify.getNotify();
            notify.arguments = [
                "tessera",
                0,
                "preferences-system-windows-effect-presentwindows",
                "Tessera disabled",
                "Tiling is off and all windows were restored.\n\nRe-enabling Tessera from System Settings mid-session may not take effect until you log out and back in (upstream KWin issue). Use the 'Tessera: Toggle Tiling' shortcut (Meta+Shift+E) for an instant switch.",
                [],
                {},
                10000,
            ];
            notify.call();
        } catch (e) {
            this.logger.error(e);
        }
    }

    // transient Plasma pill rendered by plasmashell (org.kde.osdService); gives
    // the toggle shortcut immediate visible feedback
    private showOsd(icon: string, text: string): void {
        try {
            const osd = this.qmlObjects.notify.getOsd();
            osd.arguments = [icon, text];
            osd.call();
        } catch (e) {
            // no plasmashell (logout/headless): the toggle still worked, the
            // indicator is optional
            this.logger.error(e);
        }
    }

    private initCallback(): void {
        // keep restarting the call until it actually initializes properly
        if (
            this.workspace.activities.length == 1 &&
            this.workspace.activities[0] ==
                "00000000-0000-0000-0000-000000000000"
        ) {
            this.initRetryCount += 1;
            if (this.initRetryCount >= Controller.MAX_INIT_RETRIES) {
                this.logger.error(
                    "Failed to initialize after",
                    Controller.MAX_INIT_RETRIES,
                    "attempts. Activities not available.",
                );
                return;
            }
            this.logger.debug("Restarting init timer");
            // gradually increase time between restart calls for slower systems
            this.initTimer.interval += TIMER_DELAY;
            this.initTimer.restart();
            return;
        }
        // hook into kwin after everything loads nicely
        this.workspaceActions.addHooks();
        this.driverManager.init();
        // i3-style: manage the windows already open when the script starts,
        // so they tile too and get captured for a proper unload restore
        const tiled = this.backfillExistingWindows();
        this.logger.info(
            "Tessera initialized:",
            this.workspace.windows.length,
            "windows open,",
            "drivers",
            this.driverManager.driverCount,
            ", tiled",
            tiled,
        );
    }

    // tiles the windows already open when the script was (re)enabled. only
    // processes windows the script hasn't seen yet, so re-activation never
    // overwrites an already-captured pre-tiling state or double-registers
    // clients that are already part of a driver's layout.
    private backfillExistingWindows(): number {
        const windows = this.workspace.windows.slice();
        let tiled = 0;
        for (const window of windows) {
            if (this.windowExtensions.has(window)) {
                continue;
            }
            try {
                if (this.workspaceActions.windowAdded(window)) {
                    tiled += 1;
                }
            } catch (e) {
                this.logger.error(e);
            }
        }
        this.logger.debug("Backfilled", tiled, "of", windows.length, "windows");
        return tiled;
    }
}