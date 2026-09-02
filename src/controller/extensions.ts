import {
    ClientAreaOption,
    MaximizeMode,
    VirtualDesktop,
    Window,
} from "kwin-api";
import { Workspace } from "kwin-api/qml";
import { Desktop, DesktopFactory } from "./desktop";
import { WindowHooks } from "./actions/windowhooks";
import { GPoint, GRect } from "../util/geometry";

export class WorkspaceExtensions {
    // things added that we need
    public lastActivity: string;
    public lastDesktop: VirtualDesktop;
    public lastActiveWindow: Window | null = null;

    // hidden stuff to track changes with
    private currentActivity: string;
    private currentDesktop: VirtualDesktop;
    private workspace: Workspace;
    private currentActiveWindow: Window | null = null;

    constructor(workspace: Workspace) {
        this.workspace = workspace;
        this.currentActivity = this.workspace.currentActivity;
        this.currentDesktop = this.workspace.currentDesktop;
        this.lastActivity = this.currentActivity;
        this.lastDesktop = this.currentDesktop;
        this.currentActiveWindow = this.workspace.activeWindow;

        this.workspace.currentActivityChanged.connect(this.repoll.bind(this));
        this.workspace.currentDesktopChanged.connect(this.repoll.bind(this));
        this.workspace.windowActivated.connect(this.windowActivated.bind(this));
    }

    // this flickers to null and then back so account for null
    private windowActivated(window: Window) {
        if (window == null) {
            return;
        }
        this.lastActiveWindow = this.currentActiveWindow;
        this.currentActiveWindow = window;
    }

    private repoll(): void {
        this.lastActivity = this.currentActivity;
        this.lastDesktop = this.currentDesktop;
        this.currentActivity = this.workspace.currentActivity;
        this.currentDesktop = this.workspace.currentDesktop;
    }
}

// important that this is connected first to new windows
export class WindowExtensions {
    // only store state of full maximization (who maximizes only directionally?)
    maximized: boolean = false;
    previousDesktops: Desktop[] = [];
    private previousDesktopsInternal: Desktop[] = [];
    // DERIVED FLAGS — written only by TilingDriver.transition() (the state
    // machine choke point in driver/driver.ts). Never set them elsewhere.
    isTiled: boolean = false; // true exactly when lifecycle state is Tiled
    wasTiled: boolean = false; // suspended by min/max/fullscreen; restore on exit
    lastTiledLocation: GPoint | null = null;
    clientHooks: WindowHooks | null = null;
    isSingleMaximized: boolean = false; // whether the window is solo maximized or not (in accordance with maximize single windows)

    // pre-tiling state, captured once on first sight, so unload can hand the
    // window back exactly as it was before the script managed it
    priorKeepAbove: boolean = false;
    priorKeepBelow: boolean = false;
    priorFullScreen: boolean = false;
    priorMaximizedFull: boolean = false;
    priorMinimized: boolean = false;
    priorFrameGeometry: GRect | null = null;
    private captured: boolean = false;

    private window: Window;
    private desktopFactory: DesktopFactory;
    private workspace: Workspace;

    constructor(
        window: Window,
        desktopFactory: DesktopFactory,
        workspace: Workspace,
    ) {
        this.window = window;
        this.desktopFactory = desktopFactory;
        this.workspace = workspace;

        window.maximizedAboutToChange.connect(
            (m: MaximizeMode) =>
                (this.maximized = m == MaximizeMode.MaximizeFull),
        );
        window.desktopsChanged.connect(this.previousDesktopsChanged.bind(this));
        window.activitiesChanged.connect(
            this.previousDesktopsChanged.bind(this),
        );
        window.outputChanged.connect(this.previousDesktopsChanged.bind(this));

        // Seed both snapshots with the window's current desktops so the
        // first change event produces a correct diff. Leaving the previous
        // snapshot empty would make it look like the window arrived on every
        // desktop it touches, causing duplicate inserts and stale entries on
        // desktops it no longer occupies.
        const initial = this.desktopFactory.createDesktopsFromWindow(
            this.window,
        );
        this.previousDesktops = initial.slice();
        this.previousDesktopsInternal = initial;
    }

    private previousDesktopsChanged(): void {
        this.previousDesktops = this.previousDesktopsInternal;
        this.previousDesktopsInternal =
            this.desktopFactory.createDesktopsFromWindow(this.window);
    }

    // Records the window's pre-tiling state exactly once, before any script
    // mutation. Later calls are no-ops.
    captureState(): void {
        if (this.captured) {
            return;
        }
        this.captured = true;
        this.priorKeepAbove = this.window.keepAbove;
        this.priorKeepBelow = this.window.keepBelow;
        this.priorFullScreen = this.window.fullScreen;
        this.priorMaximizedFull = this.isMaximizedFull();
        this.priorMinimized = this.window.minimized;
        this.priorFrameGeometry = new GRect(this.window.frameGeometry);
    }

    private isMaximizedFull(): boolean {
        try {
            const area = this.workspace.clientArea(
                ClientAreaOption.MaximizeArea,
                this.window,
            );
            const geo = this.window.frameGeometry;
            const eps = 2;
            return (
                Math.abs(geo.x - area.x) <= eps &&
                Math.abs(geo.y - area.y) <= eps &&
                Math.abs(geo.width - area.width) <= eps &&
                Math.abs(geo.height - area.height) <= eps
            );
        } catch {
            return false;
        }
    }
}
