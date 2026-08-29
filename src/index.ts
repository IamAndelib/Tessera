// index.ts - Entry point from QML to TypeScript

import { Api, Objects as QmlObjects } from "./extern/qml";
import { Controller } from "./controller";

let controller: Controller | null = null;

export function main(api: Api, qmlObjects: QmlObjects) {
    // KWin's declarative-script reload can briefly keep a stale instance alive
    // while a fresh one starts (upstream QQmlEngine cache issue). Never run two
    // controllers over the same windows: tear the old one down first.
    if (controller != null) {
        try {
            controller.destroy();
        } catch (e) {
            // best effort; the old QML may already be partially destroyed
        }
    }
    controller = new Controller(api, qmlObjects);
    controller.init();
}

// called from main.qml when KWin unloads/disables the script so all managed
// windows are released instead of staying snapped until the next login
export function destroy() {
    if (controller == null) {
        return;
    }
    controller.destroy();
    controller = null;
}
