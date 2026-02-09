// config.ts - Static config class

import { KWin } from "kwin-api/qml";

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
        this.debug = rc("Debug", false);
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

        this.timerDelay = rc("TimerDelay", 10);

        this.maximizeSingle = rc("MaximizeSingle", false);
        this.resizeAmount = rc("ResizeAmount", 10);
        this.saveOnTileEdit = rc("SaveOnTileEdit", false);

        this.tiledWindowStacking = rc("TiledWindowStacking", TiledWindowStacking.Normal);

        this.insertionPoint = rc("InsertionPoint", InsertionPoint.Left);
        this.rotateLayout = rc("RotateLayout", false);
        this.autoRotateLayout = rc("AutoRotateLayout", true);

        // Hyprland-style dwindle options
        this.preserveSplit = rc("PreserveSplit", false);
        this.forceSplit = rc("ForceSplit", ForceSplit.Disabled);
        this.defaultSplitRatio = rc("DefaultSplitRatio", 50) / 100;
    }

    debug: boolean = false;

    tilePopups: boolean = false;
    filterProcess: string[] = [
        "krunner",
        "yakuake",
        "kded",
        "polkit",
        "plasmashell",
    ];
    filterCaption: string[] = [];

    timerDelay: number = 10;

    tiledWindowStacking: TiledWindowStacking = TiledWindowStacking.Normal;

    maximizeSingle: boolean = false;
    resizeAmount: number = 10;
    saveOnTileEdit: boolean = false;

    insertionPoint: InsertionPoint = InsertionPoint.Left;
    rotateLayout: boolean = false;
    autoRotateLayout: boolean = true;

    // Hyprland-style dwindle options
    preserveSplit: boolean = false; // Keep split directions permanent
    forceSplit: ForceSplit = ForceSplit.Disabled; // Force split direction
    defaultSplitRatio: number = 0.5; // Default ratio when splitting (0.1 to 0.9)
}
