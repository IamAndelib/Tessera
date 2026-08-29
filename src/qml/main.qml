// main.qml - Entry point into script

import "../code/main.mjs" as Tessera;
import QtQuick;
import org.kde.kwin;

Item {
    id: root;

    function printQml(string) {
        print(string);
    }

    function createTimer() {
        return Qt.createQmlObject("import QtQuick; Timer {}", root);
    }
    
    Component.onCompleted: {
        const api = {
            "workspace": Workspace,
            "options": Options,
            "kwin": KWin,
        };
        const qmlObjects = {
            "root": root,
            "shortcuts": shortcutsLoader.item,
            "notify": notifyLoader.item,
        };
        Tessera.main(api, qmlObjects);
    }

    // KWin runs this when the script is unloaded (disable/uninstall) and on
    // logout, so release every managed window before the script goes away
    Component.onDestruction: {
        Tessera.destroy();
    }

    Loader {
        id: notifyLoader;

        source: "notify.qml";
    }
    
    Loader {
        id: shortcutsLoader;
                
        source: "shortcuts.qml";
    }
}
