// controller.ts - Main controller object of the script

import { Options, Tile, Window } from "kwin-api";
import { Workspace } from "kwin-api/qml";
import * as Qml from "../extern/qml";

import { Log } from "../util/log";
import { Config, TIMER_DELAY } from "../util/config";

import { DriverManager } from "../driver";

import { DBusManager } from "./actions/dbus";
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
    dbusManager: DBusManager;
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

        this.dbusManager = new DBusManager(this);
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
        } catch (e) {
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
        this.backfillExistingWindows();
    }

    private backfillExistingWindows(): void {
        const windows = this.workspace.windows.slice();
        this.logger.debug(
            "Backfilling",
            windows.length,
            "existing windows",
        );
        for (const window of windows) {
            try {
                this.workspaceActions.windowAdded(window);
            } catch (e) {
                this.logger.error(e);
            }
        }
    }
}
