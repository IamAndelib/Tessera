import { Tile, Window } from "kwin-api";
import { Workspace } from "kwin-api/qml";
import { Config } from "../util/config";
import { Log } from "../util/log";
import { DriverManager } from "../driver";
import { WorkspaceExtensions, WindowExtensions } from "./extensions";
import { DBusManager } from "./actions/dbus";
import { WindowHookManager } from "./actions/windowhooks";
import { DesktopFactory } from "./desktop";
import * as Qml from "../extern/qml";

export interface ControllerContext {
    workspace: Workspace;
    config: Config;
    logger: Log;

    desktopFactory: DesktopFactory;
    driverManager: DriverManager;
    dbusManager: DBusManager;
    windowHookManager: WindowHookManager;

    qmlObjects: Qml.Objects;
    windowExtensions: Map<Window, WindowExtensions>;
    workspaceExtensions: WorkspaceExtensions;
    managedTiles: Set<Tile>;
}
