// actions/settingsdialog.ts - Actions related to signals coming from the settings dialog

import { ControllerContext } from "../context";
import { EngineConfig } from "../../engine";
import { StringDesktop } from "../desktop";

export class SettingsDialogManager {
    private ctrl: ControllerContext;

    constructor(ctrl: ControllerContext) {
        this.ctrl = ctrl;
        this.ctrl.qmlObjects.settings.saveSettings.connect(
            this.saveSettings.bind(this),
        );
        this.ctrl.qmlObjects.settings.removeSettings.connect(
            this.removeSettings.bind(this),
        );
    }

    saveSettings(settings: EngineConfig, desktop: StringDesktop): void {
        this.ctrl.driverManager.setEngineConfig(
            this.ctrl.desktopFactory.createDesktopFromStrings(desktop),
            settings,
        );
    }

    removeSettings(desktop: StringDesktop): void {
        const desktopObj =
            this.ctrl.desktopFactory.createDesktopFromStrings(desktop);
        this.ctrl.driverManager.removeEngineConfig(desktopObj);
    }
}
