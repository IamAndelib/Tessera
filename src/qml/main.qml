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
            "dbus": dbusLoader.item,
        };
        Tessera.main(api, qmlObjects);
    }

    Loader {
        id: dbusLoader;
        
        source: "dbus.qml";
    }
    
    Loader {
        id: shortcutsLoader;
                
        source: "shortcuts.qml";
    }
}
