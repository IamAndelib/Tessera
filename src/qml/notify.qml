// notify.qml - Fire-and-forget system notifications (org.freedesktop.Notifications)

import QtQuick;
import org.kde.kwin;

Item {
    id: notifyItem;

    function getNotify() {
        return notifyCall;
    }

    DBusCall {
        id: notifyCall;

        service: "org.freedesktop.Notifications";
        path: "/org/freedesktop/Notifications";
        dbusInterface: "org.freedesktop.Notifications";
        method: "Notify";
    }

    function getOsd() {
        return osdCall;
    }

    // transient Plasma pill (org.kde.osdService.showText) so the toggle
    // shortcut gives visible feedback
    DBusCall {
        id: osdCall;

        service: "org.kde.plasmashell";
        path: "/org/kde/osdService";
        dbusInterface: "org.kde.osdService";
        method: "showText";
    }
}