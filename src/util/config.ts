// config.ts - Static config class

import { KWin } from "kwin-api/qml";
import type { EngineConfig } from "../engine";

export const enum InsertionPoint {
    Left = 0,
    Right,
    Active,
}

export const enum TiledWindowStacking {
    Normal = 0,
    KeepAbove,
    KeepBelow,
}

// Hyprland-style force split direction
export const enum ForceSplit {
    Disabled = 0, // Use dynamic/alternating split
    LeftTop, // Always split to left/top
    RightBottom, // Always split to right/bottom
}

// Hardcoded optimal values
export const TIMER_DELAY = 10;
export const RESIZE_AMOUNT = 12;

export class Config {
    private readonly readConfigFn: KWin["readConfig"] | undefined;

    constructor(kwinApi: KWin) {
        this.readConfigFn = kwinApi.readConfig;
        this.readConfig();
    }

    readConfig(): void {
        let rc = this.readConfigFn;
        if (rc == undefined) {
            return;
        }
        this.tilePopups = rc("TilePopups", false);
        this.filterProcess = rc(
            "FilterProcess",
            "krunner, yakuake, kded, polkit, plasmashell",
        )
            .split(",")
            .map((x: string) => x.trim());
        this.filterCaption = rc("FilterCaption", "")
            .split(",")
            .map((x: string) => x.trim());

        this.maximizeSingle = rc("MaximizeSingle", false);

        this.tiledWindowStacking = rc("TiledWindowStacking", TiledWindowStacking.Normal);

        this.insertionPoint = rc("InsertionPoint", InsertionPoint.Left);
        this.rotateLayout = rc("RotateLayout", false);
        this.autoRotateLayout = rc("AutoRotateLayout", true);

        // Hyprland-style dwindle options
        this.preserveSplit = rc("PreserveSplit", false);
        this.forceSplit = rc("ForceSplit", ForceSplit.Disabled);
    }

    tilePopups: boolean = false;
    filterProcess: string[] = [
        "krunner",
        "yakuake",
        "kded",
        "polkit",
        "plasmashell",
    ];
    filterCaption: string[] = [];

    tiledWindowStacking: TiledWindowStacking = TiledWindowStacking.Normal;

    maximizeSingle: boolean = false;

    insertionPoint: InsertionPoint = InsertionPoint.Left;
    rotateLayout: boolean = false;
    autoRotateLayout: boolean = true;

    // Hyprland-style dwindle options
    preserveSplit: boolean = false; // Keep split directions permanent
    forceSplit: ForceSplit = ForceSplit.Disabled; // Force split direction

    createDefaultEngineConfig(): EngineConfig {
        return {
            insertionPoint: this.insertionPoint,
            rotateLayout: this.rotateLayout,
            engineSettings: {},
            preserveSplit: this.preserveSplit,
            forceSplit: this.forceSplit,
        };
    }
}
