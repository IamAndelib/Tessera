// qml.d.ts - Declarations for external QML methods

import { Options } from "kwin-api";
import { QTimer } from "kwin-api/qt";
import { Workspace, KWin, DBusCall, ShortcutHandler } from "kwin-api/qml";

export interface Api {
    workspace: Workspace;
    options: Options;
    kwin: KWin;
}

export interface Objects {
    root: Root;
    shortcuts: Shortcuts;
    dbus: DBus;
}

export interface Root {
    printQml(s: string): void;
    createTimer(): QTimer;
}

export interface Shortcuts {
    getRetileWindow(): ShortcutHandler;

    getFocusAbove(): ShortcutHandler;
    getFocusBelow(): ShortcutHandler;
    getFocusLeft(): ShortcutHandler;
    getFocusRight(): ShortcutHandler;

    getInsertAbove(): ShortcutHandler;
    getInsertBelow(): ShortcutHandler;
    getInsertLeft(): ShortcutHandler;
    getInsertRight(): ShortcutHandler;

    getResizeAbove(): ShortcutHandler;
    getResizeBelow(): ShortcutHandler;
    getResizeLeft(): ShortcutHandler;
    getResizeRight(): ShortcutHandler;

    getRotateLayout(): ShortcutHandler;

    // Hyprland-style shortcuts
    getSwapHalves(): ShortcutHandler;
    getSwapWithSibling(): ShortcutHandler;
    getSwapAbove(): ShortcutHandler;
    getSwapBelow(): ShortcutHandler;
    getSwapLeft(): ShortcutHandler;
    getSwapRight(): ShortcutHandler;
    getToggleSplit(): ShortcutHandler;
    getCycleNext(): ShortcutHandler;
    getCyclePrev(): ShortcutHandler;
}

export interface DBus {
    getGetSettings(): DBusCall;
    getSetSettings(): DBusCall;
    getRemoveSettings(): DBusCall;
    getExists(): DBusCall;
}
