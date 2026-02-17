// engines/index.ts - Common classes and structures used by the engines

import { Config } from "../util/config";
import { Direction } from "../util/geometry";
import { LayoutDirection, Window } from "kwin-api";
import { QSize } from "kwin-api/qt";
import {
    EngineCapability,
    EngineSettings,
    EngineConfig as InternalEngineConfig,
    Client as IClient,
} from "./engine";
import BTreeEngine from "./layouts/btree";

export interface EngineConfig extends InternalEngineConfig {
    // intentionally undefined when coming from settings dialog
    engineSettings: EngineSettings | undefined;
}

export { EngineCapability, EngineSettings };

export class Client implements IClient {
    name: string;
    minSize: QSize;

    constructor(window: Window) {
        this.name = window.resourceClass;
        this.minSize = window.minSize;
    }
}

export interface Tile {
    parent: Tile | null;
    tiles: Tile[];
    layoutDirection: LayoutDirection;
    requestedSize: QSize;
    relativeSize: number;
    clients: Client[];

    get client(): Client | null;
    set client(value: Client | null);

    addChild(alterSiblingRatios?: boolean): Tile;

    split(): void;

    secede(): void;

    // removes a tile and all its children
    remove(batchRemove?: boolean): void;

    removeChildren(): void;

    // fix possible relative size conflicts
    fixRelativeSizing(): void;
}

export interface TilingEngine {
    rootTile: Tile;
    config: InternalEngineConfig;
    readonly engineCapability: EngineCapability;

    get engineSettings(): EngineSettings;
    set engineSettings(settings: EngineSettings | null);

    // initializes optional stuff in the engine if necessary
    initEngine(): void;
    // creates the root tile layout
    buildLayout(): void;
    // adds a new client to the engine
    addClient(c: Client): void;
    // removes a client
    removeClient(c: Client): void;
    // places a client in a specific tile, in the direction d
    putClientInTile(c: Client, t: Tile, d?: Direction): void;
    // called after subtiles are edited (ex. sizes) so the engine can update them internally if needed
    regenerateLayout(): void;

    // Hyprland-style methods
    // swaps the two halves (root subtrees) of the layout
    swapHalves(): boolean;
    // swaps two clients in the engine
    swapClients(client1: Client, client2: Client): boolean;
    // get sibling client for swap operations
    getSiblingClient(client: Client): Client | null;
    // toggle split direction at current node
    toggleSplit(client: Client): boolean;
    // get all clients for cycling
    getAllClients(): Client[];
}

export class TilingEngineFactory {
    config: Config;

    public constructor(config: Config) {
        this.config = config;
    }

    public newEngine(optConfig?: EngineConfig): TilingEngine {
        const config = optConfig ?? this.config.createDefaultEngineConfig();
        // Always use BTree engine
        const engine: TilingEngine = new BTreeEngine(config);
        engine.initEngine();
        engine.engineSettings = config.engineSettings ?? {};
        return engine;
    }
}
