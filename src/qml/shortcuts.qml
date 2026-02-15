// shortcuts.qml - Keyboard Shortcuts

import QtQuick;
import org.kde.kwin;

Item {
    id: shortcuts;
    
    function getRetileWindow() {
        return retileWindow;
    }
    ShortcutHandler {
        id: retileWindow;
        
        name: "TesseraRetileWindow";
        text: "Tessera: Tile/Untile Window";
        sequence: "Meta+Shift+Space";
    }
    
    function getOpenSettings() {
        return openSettings;
    }
    ShortcutHandler {
        id: openSettings;
        
        name: "TesseraOpenSettings";
        text: "Tessera: Open Settings";
        sequence: "Meta+\\";
    }
    
    function getFocusAbove() {
        return focusAbove;
    }
    ShortcutHandler {
        id: focusAbove;
        
        name: "TesseraFocusAbove";
        text: "Tessera: Focus Above";
        sequence: "Meta+K";
    }

    function getFocusBelow() {
        return focusBelow;
    }
    ShortcutHandler {
        id: focusBelow;
        
        name: "TesseraFocusBelow";
        text: "Tessera: Focus Below";
        sequence: "Meta+J";
    }

    function getFocusLeft() {
        return focusLeft;
    }
    ShortcutHandler {
        id: focusLeft;
        
        name: "TesseraFocusLeft";
        text: "Tessera: Focus Left";
        sequence: "Meta+H";
    }

    function getFocusRight() {
        return focusRight;
    }
    ShortcutHandler {
        id: focusRight;
        
        name: "TesseraFocusRight";
        text: "Tessera: Focus Right";
        sequence: "Meta+L";
    }
    
    function getInsertAbove() {
        return insertAbove;
    }
    ShortcutHandler {
        id: insertAbove;
        
        name: "TesseraInsertAbove";
        text: "Tessera: Move Window Up";
        sequence: "Meta+Shift+K";
    }

    function getInsertBelow() {
        return insertBelow;
    }
    ShortcutHandler {
        id: insertBelow;
        
        name: "TesseraInsertBelow";
        text: "Tessera: Move Window Down";
        sequence: "Meta+Shift+J";
    }

    function getInsertLeft() {
        return insertLeft;
    }
    ShortcutHandler {
        id: insertLeft;
        
        name: "TesseraInsertLeft";
        text: "Tessera: Move Window Left";
        sequence: "Meta+Shift+H";
    }

    function getInsertRight() {
        return insertRight;
    }
    ShortcutHandler {
        id: insertRight;
        
        name: "TesseraInsertRight";
        text: "Tessera: Move Window Right";
        sequence: "Meta+Shift+L";
    }

    function getResizeAbove() {
        return resizeAbove;
    }
    ShortcutHandler {
        id: resizeAbove;
        
        name: "TesseraResizeAbove";
        text: "Tessera: Resize Up";
        sequence: "Meta+Ctrl+K";
    }

    function getResizeBelow() {
        return resizeBelow;
    }
    ShortcutHandler {
        id: resizeBelow;
        
        name: "TesseraResizeBelow";
        text: "Tessera: Resize Down";
        sequence: "Meta+Ctrl+J";
    }

    function getResizeLeft() {
        return resizeLeft;
    }
    ShortcutHandler {
        id: resizeLeft;
        
        name: "TesseraResizeLeft";
        text: "Tessera: Resize Left";
        sequence: "Meta+Ctrl+H";
    }

    function getResizeRight() {
        return resizeRight;
    }
    ShortcutHandler {
        id: resizeRight;
        
        name: "TesseraResizeRight";
        text: "Tessera: Resize Right";
        sequence: "Meta+Ctrl+L";
    }

    function getRotateLayout() {
        return rotateLayout;
    }
    ShortcutHandler {
        id: rotateLayout;

        name: "TesseraRotateLayout";
        text: "Tessera: Toggle Vertical-First";
        sequence: "";
    }

    // Hyprland-style shortcuts
    function getSwapHalves() {
        return swapHalves;
    }
    ShortcutHandler {
        id: swapHalves;

        name: "TesseraSwapHalves";
        text: "Tessera: Swap Halves";
        sequence: "Meta+Shift+S";
    }

    function getSwapWithSibling() {
        return swapWithSibling;
    }
    ShortcutHandler {
        id: swapWithSibling;

        name: "TesseraSwapWithSibling";
        text: "Tessera: Swap with Sibling";
        sequence: "Meta+S";
    }

    function getSwapAbove() {
        return swapAbove;
    }
    ShortcutHandler {
        id: swapAbove;

        name: "TesseraSwapAbove";
        text: "Tessera: Swap Up";
        sequence: "Meta+Alt+K";
    }

    function getSwapBelow() {
        return swapBelow;
    }
    ShortcutHandler {
        id: swapBelow;

        name: "TesseraSwapBelow";
        text: "Tessera: Swap Down";
        sequence: "Meta+Alt+J";
    }

    function getSwapLeft() {
        return swapLeft;
    }
    ShortcutHandler {
        id: swapLeft;

        name: "TesseraSwapLeft";
        text: "Tessera: Swap Left";
        sequence: "Meta+Alt+H";
    }

    function getSwapRight() {
        return swapRight;
    }
    ShortcutHandler {
        id: swapRight;

        name: "TesseraSwapRight";
        text: "Tessera: Swap Right";
        sequence: "Meta+Alt+L";
    }

    function getToggleSplit() {
        return toggleSplit;
    }
    ShortcutHandler {
        id: toggleSplit;

        name: "TesseraToggleSplit";
        text: "Tessera: Toggle Split Direction";
        sequence: "Meta+T";
    }

    function getCycleNext() {
        return cycleNext;
    }
    ShortcutHandler {
        id: cycleNext;

        name: "TesseraCycleNext";
        text: "Tessera: Cycle Windows Next";
        sequence: "Meta+Tab";
    }

    function getCyclePrev() {
        return cyclePrev;
    }
    ShortcutHandler {
        id: cyclePrev;

        name: "TesseraCyclePrev";
        text: "Tessera: Cycle Windows Previous";
        sequence: "Meta+Shift+Tab";
    }
}
