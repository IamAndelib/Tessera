import QtQuick;
import org.kde.kwin;

Item {
    id: dbus;
    
    function getExists() {
        return exists;
    }
    
    function getGetSettings() {
        return getSettings;
    }
    
    function getSetSettings() {
        return setSettings;
    }
    
    function getRemoveSettings() {
        return removeSettings;
    }
    
    DBusCall {
        id: getSettings;
        
        service: "org.tessera.SettingSaver";
        path: "/saver";
        dbusInterface: "org.tessera.SettingSaver";
        method: "GetSettings";
    }

    DBusCall {
        id: setSettings;
        
        service: "org.tessera.SettingSaver";
        path: "/saver";
        dbusInterface: "org.tessera.SettingSaver";
        method: "SetSettings";
    }

    DBusCall {
        id: exists;
        
        service: "org.tessera.SettingSaver";
        path: "/saver";
        dbusInterface: "org.tessera.SettingSaver";
        method: "Exists";
    }
    
    DBusCall {
        id: removeSettings;
        
        service: "org.tessera.SettingSaver";
        path: "/saver";
        dbusInterface: "org.tessera.SettingSaver";
        method: "RemoveSettings";
    }
}
