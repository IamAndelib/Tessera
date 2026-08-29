// actions/basic.ts - Basic actions performed by the window manager, such as adding or deleting clients

import { Window } from "kwin-api";
import type { Controller } from "../index";
import { Log } from "../../util/log";
import { Config } from "../../util/config";
import { WindowExtensions } from "../extensions";

export class WorkspaceActions {
    private logger: Log;
    private config: Config;
    private ctrl: Controller;
    constructor(ctrl: Controller) {
        this.logger = ctrl.logger;
        this.config = ctrl.config;
        this.ctrl = ctrl;
    }

    // done later after loading
    addHooks(): void {
        const workspace = this.ctrl.workspace;
        workspace.windowAdded.connect(this.windowAdded.bind(this));
        workspace.windowRemoved.connect(this.windowRemoved.bind(this));
        workspace.currentActivityChanged.connect(
            this.currentDesktopChange.bind(this),
        );
        workspace.currentDesktopChanged.connect(
            this.currentDesktopChange.bind(this),
        );
    }

    doTileWindow(c: Window): boolean {
        if (
            c.normalWindow &&
            !((c.popupWindow || c.transient) && !this.config.tilePopups)
        ) {
            // check for things like max/min/fullscreen
            if (c.fullScreen || c.minimized) {
                return false;
            }
            // check if caption/resourceclass is substring as well
            for (const s of this.config.filterProcess) {
                if (s.length > 0 && c.resourceClass.includes(s)) {
                    return false;
                }
            }
            for (const s of this.config.filterCaption) {
                if (s.length > 0 && c.caption.includes(s)) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    }

    // returns true when the window was handed to the tiling driver (used by
    // the enable-time backfill to know how many windows got tiled)
    windowAdded(window: Window): boolean {
        // windows opened while tiling is toggled off stay floating untouched,
        // and are picked up again on the next enable
        if (!this.ctrl.active) {
            return false;
        }
        this.ctrl.windowExtensions.set(
            window,
            new WindowExtensions(
                window,
                this.ctrl.desktopFactory,
                this.ctrl.workspace,
            ),
        );
        // capture pre-tiling state on first sight, before any script
        // mutation (so disable can hand every window back intact). Runs for
        // minimized windows too: if they are later un-minimized and tiled,
        // their recorded state stays like it was at enable time.
        this.ctrl.windowExtensions.get(window)?.captureState();
        this.ctrl.windowHookManager.attachWindowHooks(window);
        if (!this.doTileWindow(window)) {
            this.logger.debug("Not tiling window", window.resourceClass);
            return false;
        }
        this.logger.debug("Window", window.resourceClass, "added");
        this.ctrl.driverManager.addWindow(window);
        this.ctrl.driverManager.quitFullScreen(window.output);
        this.ctrl.driverManager.rebuildLayout();
        return true;
    }

    windowRemoved(window: Window): void {
        this.logger.debug("Window", window.resourceClass, "removed");
        // driver bookkeeping always runs: a window closed while tiling is
        // toggled off must still be dropped so a later re-enable doesn't try
        // to rebuild a layout that includes a dead window
        this.ctrl.driverManager.removeWindow(window);
        if (this.ctrl.active && this.ctrl.windowExtensions.get(window)?.isTiled) {
            this.ctrl.driverManager.rebuildLayout();
        }
        this.ctrl.windowExtensions.delete(window);
    }

    currentDesktopChange(): void {
        if (!this.ctrl.active) {
            return;
        }
        // have to set this because this function temp untiles all windows
        this.ctrl.driverManager.suppressLayout(() => {
            // set geometry for all clients manually to avoid resizing when tiles are deleted
            for (const window of this.ctrl.workspace.windows) {
                if (
                    window.tile != null &&
                    window.activities.includes(
                        this.ctrl.workspaceExtensions.lastActivity!,
                    ) &&
                    window.desktops.includes(
                        this.ctrl.workspaceExtensions.lastDesktop,
                    )
                ) {
                    const tile = window.tile;
                    window.tile = null;
                    window.frameGeometry = tile.absoluteGeometry;
                    window.frameGeometry.width -= 2 * tile.padding;
                    window.frameGeometry.height -= 2 * tile.padding;
                    window.frameGeometry.x += tile.padding;
                    window.frameGeometry.y += tile.padding;
                }
            }
            this.ctrl.driverManager.rebuildLayout();
        });
    }
}
