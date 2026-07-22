// dbus.ts - Controller for dbus interactions

import { ControllerContext } from "../context";
import { EngineConfig } from "../../engine";
import { Log } from "../../util/log";
import { DBusCall } from "kwin-api/qml";

type PendingOperation = () => void;

export class DBusManager {
    private isConnected: boolean = false;
    private logger: Log;
    private existsCall: DBusCall;
    private getSettingsCall: DBusCall;
    private setSettingsCall: DBusCall;
    private removeSettingsCall: DBusCall;
    private connectedDesktops: Map<string, (cfg: EngineConfig) => void> = new Map();
    private pendingOperations: PendingOperation[] = [];

    constructor(ctrl: ControllerContext) {
        this.logger = ctrl.logger;
        const dbus = ctrl.qmlObjects.dbus;

        this.existsCall = dbus.getExists();
        this.getSettingsCall = dbus.getGetSettings();
        this.setSettingsCall = dbus.getSetSettings();
        this.removeSettingsCall = dbus.getRemoveSettings();

        this.existsCall.finished.connect(this.existsCallback.bind(this));
        this.getSettingsCall.finished.connect(this.getSettingsCallback.bind(this));
        this.existsCall.call();
    }

    private existsCallback() {
        this.isConnected = true;
        this.logger.debug("DBus connected");
        for (const op of this.pendingOperations) {
            op();
        }
        this.pendingOperations = [];
    }

    private runOrQueue(fn: () => void): void {
        if (this.isConnected) {
            fn();
        } else {
            this.pendingOperations.push(fn);
        }
    }

    private getSettingsCallback(args: any[]): void {
        const desktop = args[0] as string;
        if (args[1].length == 0) {
            return;
        }
        let config: EngineConfig;
        try {
            config = JSON.parse(args[1]);
        } catch (e) {
            this.logger.error("Failed to parse DBus settings for desktop", desktop, e);
            return;
        }
        const fn = this.connectedDesktops.get(desktop);
        if (fn != undefined) {
            fn(config);
        }
    }

    setSettings(desktop: string, config: EngineConfig): void {
        this.runOrQueue(() => {
            const stringConfig = JSON.stringify(config);
            this.logger.debug(
                "Setting settings over dbus for desktop",
                desktop,
                "to",
                stringConfig,
            );
            this.setSettingsCall.arguments = [desktop, stringConfig];
            this.setSettingsCall.call();
        });
    }

    getSettings(desktop: string, fn: (cfg: EngineConfig) => void): void {
        this.runOrQueue(() => {
            this.logger.debug("Getting settings over dbus for desktop", desktop);
            this.connectedDesktops.set(desktop, fn);
            this.getSettingsCall.arguments = [desktop];
            this.getSettingsCall.call();
        });
    }

    removeSettings(desktop: string): void {
        this.runOrQueue(() => {
            this.logger.debug("Removing settings over dbus for desktop", desktop);
            this.connectedDesktops.delete(desktop);
            this.removeSettingsCall.arguments = [desktop];
            this.removeSettingsCall.call();
        });
    }
}
