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

        this.maximizeSingle = rc("MaximizeSingle", false);

        // 0 = unlimited (per layout half, counts the half the next window targets)
        this.maxTiledWindowsPerHalf = rc("MaxTiledWindowsPerHalf", 4);

        this.tiledWindowStacking = rc(
            "TiledWindowStacking",
            TiledWindowStacking.KeepBelow,
        );

        // Hyprland dwindle: new windows split from the focused window; the
        // cascade emerges because the new window takes focus. Fixed left/right
        // pile insertion remains selectable.
        this.insertionPoint = rc("InsertionPoint", InsertionPoint.Active);
        this.rotateLayout = rc("RotateLayout", false);

        // Hyprland-style dwindle options
        this.preserveSplit = rc("PreserveSplit", false);
        this.forceSplit = rc("ForceSplit", ForceSplit.Disabled);
        // preselect persists for every new window instead of one-shot
        this.persistentPreselect = rc("PersistentDirectionOverride", false);
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

    tiledWindowStacking: TiledWindowStacking = TiledWindowStacking.KeepBelow;

    maximizeSingle: boolean = false;

    // max windows tiled per layout half before new ones float (0 = unlimited).
    // The "half" is the root-level side the next window targets (the dwindle
    // pile for dwindle insertion, or the active window's side for Active).
    maxTiledWindowsPerHalf: number = 4;

    insertionPoint: InsertionPoint = InsertionPoint.Active;
    rotateLayout: boolean = false;

    // Hyprland-style dwindle options
    preserveSplit: boolean = false; // Keep split directions permanent
    forceSplit: ForceSplit = ForceSplit.Disabled; // Force split direction
    // preselect persists for every new window instead of one-shot
    persistentPreselect: boolean = false;

    debug: boolean = false;

    createDefaultEngineConfig(): EngineConfig {
        return {
            insertionPoint: this.insertionPoint,
            rotateLayout: this.rotateLayout,
            preserveSplit: this.preserveSplit,
            forceSplit: this.forceSplit,
            persistentPreselect: this.persistentPreselect,
        };
    }
}
