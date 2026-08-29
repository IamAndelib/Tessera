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
}