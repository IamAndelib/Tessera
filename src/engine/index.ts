// engine/index.ts - The tiling engine (BTree) and its shared types

import { Direction, GSize } from "../util/geometry";
import { InsertionPoint, ForceSplit } from "../util/config";
import { LayoutDirection, Window } from "kwin-api";
import { QSize } from "kwin-api/qt";
import { BiMap } from "../util/bimap";
import { Queue } from "../util/queue";

export interface EngineConfig {
    insertionPoint: InsertionPoint;
    rotateLayout: boolean;
    // biases the aspect rule: >1 favors top/bottom, <1 favors side-by-side
    splitWidthMultiplier: number;
    // Hyprland-style dwindle options
    preserveSplit: boolean; // Keep split directions permanent
    forceSplit: ForceSplit; // Force split direction
    // Hyprland permanent_direction_override: preselect persists for every
    // new window instead of being consumed once
    persistentPreselect: boolean;
}

// Preselect: which side of a NEW split the next inserted window takes
// (Hyprland layoutmsg preselect semantics). Left/Up imply a first-child
// placement, Right/Down a second-child placement.
export const enum Preselect {
    Left = 0,
    Right,
    Up,
    Down,
}

export class Client {
    name: string;
    minSize: QSize;

    constructor(window: Window) {
        this.name = window.resourceClass;
        this.minSize = window.minSize;
    }
}

export class Tile {
    parent: Tile | null;
    tiles: Tile[] = [];
    layoutDirection: LayoutDirection = LayoutDirection.Horizontal;
    // requested size in pixels, may not be honored
    requestedSize: QSize = new GSize();
    // requested relative size to screen, more likely to be honored
    relativeSize: number = 1;
    clients: Client[] = [];

    // getter/setter for backwards compatibility
    public get client(): Client | null {
        return this.clients.length > 0 ? this.clients[0] : null;
    }
    public set client(value: Client | null) {
        if (value != null) {
            this.clients[0] = value;
        } else {
            this.clients = [];
        }
    }

    constructor(parent?: Tile, alterSiblingRatios = true) {
        this.parent = parent ?? null;
        if (this.parent == null) {
            return;
        }
        this.parent.tiles.push(this);
        // if we want to alter sibling ratios on construction we do that by default
        // or you can turn this off to set ratios yourself in real time
        if (!alterSiblingRatios) {
            return;
        }
        // sizing
        const childrenLen = this.parent.tiles.length;
        if (childrenLen <= 1) {
            return;
        }
        // cancels out to be an even 1/childrenLen eventually
        this.relativeSize = 1 / (childrenLen - 1);
        for (const child of this.parent.tiles) {
            child.relativeSize *= (childrenLen - 1) / childrenLen;
        }
    }

    // adds a child that will split perpendicularly to the parent. Returns the child
    addChild(alterSiblingRatios = true): Tile {
        const splitDirection =
            this.layoutDirection === LayoutDirection.Horizontal
                ? LayoutDirection.Vertical
                : LayoutDirection.Horizontal;
        const childTile = new Tile(this, alterSiblingRatios);
        childTile.layoutDirection = splitDirection;
        return childTile;
    }

    // split a tile perpendicularly
    split(): void {
        this.addChild();
        this.addChild();
    }

    // removes a tile and all its children
    remove(batchRemove: boolean = false): void {
        const parent = this.parent;
        if (parent == null) {
            return;
        }
        if (!batchRemove) {
            parent.tiles.splice(parent.tiles.indexOf(this), 1);
        }
        const childrenLen = parent.tiles.length;
        // Guard against division by zero
        if (childrenLen > 0) {
            for (const child of parent.tiles) {
                child.relativeSize *= (childrenLen + 1) / childrenLen;
            }
        }
        this.tiles = [];
        this.client = null;
    }

    // remove child tiles
    removeChildren(): void {
        for (const tile of this.tiles) {
            tile.remove(true);
        }
        this.tiles = [];
    }

    // should be auto ran by driver but can be ran by engines too
    fixRelativeSizing(): void {
        let totalSize = 0;
        for (const tile of this.tiles) {
            totalSize += tile.relativeSize;
        }
        if (Math.abs(totalSize - 1) < 0.001) {
            return;
        }
        for (const tile of this.tiles) {
            tile.relativeSize /= totalSize;
        }
    }
}

class TreeNode {
    parent: TreeNode | null = null;
    sibling: TreeNode | null = null;
    children: [TreeNode, TreeNode] | null = null;
    client: Client | null = null;
    // ratio of child 1 to self
    sizeRatio: number = 0.5;
    // stored split direction (1=horizontal, 2=vertical, 0=not yet determined).
    // Used by preserve_split, explicit toggles, and as the record of what the
    // last layout build decided.
    splitDirection: number = 0;
    // explicitly pinned by toggleSplit: keeps its direction regardless of
    // geometry or the preserveSplit setting, like Hyprland's togglesplit
    splitPinned: boolean = false;
    // direction chosen for this split by a preselect; consumed by the next
    // buildLayout (one-shot, survives exactly one rebuild)
    splitPreselected: boolean = false;
    // splits tile
    split(): void {
        // cannot already have children
        if (this.children != null) return;
        this.children = [new TreeNode(), new TreeNode()];
        this.children[0].parent = this;
        this.children[0].sibling = this.children[1];
        this.children[1].parent = this;
        this.children[1].sibling = this.children[0];
    }
    // removes self
    remove(): void {
        // cannot have children or be root
        if (
            this.children != null ||
            this.sibling == null ||
            this.parent == null
        )
            return;
        // if sibling has children, move them to the parent and leave both siblings to be garbage collected
        if (this.sibling.children != null) {
            this.parent.children = this.sibling.children;
            for (const child of this.parent.children) {
                // help the adoption
                child.parent = this.parent;
            }
        } else {
            // otherwise just move windows over
            this.parent.client = this.sibling.client;
            this.parent.children = null;
            this.parent.sizeRatio = 0.5;
        }
        // say goodbye
        this.parent = null;
        this.sibling.parent = null;
        this.sibling.sibling = null;
        this.sibling = null;
    }
}

class RootNode extends TreeNode {
    parent: null = null;
    sibling: null = null;
    remove(): void {
        // for root node, if the node needs to be removed just reset it
        this.children = null;
        this.client = null;
    }
}

// BFS helper to find a node matching a predicate
function findNode(
    root: TreeNode,
    predicate: (node: TreeNode) => boolean,
): TreeNode | null {
    const queue: Queue<TreeNode> = new Queue();
    queue.enqueue(root);
    while (queue.size > 0) {
        const node = queue.dequeue()!;
        if (predicate(node)) return node;
        if (node.children != null) {
            queue.enqueue(node.children[0]);
            queue.enqueue(node.children[1]);
        }
    }
    return null;
}

// BFS helper to collect all nodes matching a predicate
function collectNodes(
    root: TreeNode,
    predicate: (node: TreeNode) => boolean,
): TreeNode[] {
    const results: TreeNode[] = [];
    const queue: Queue<TreeNode> = new Queue();
    queue.enqueue(root);
    while (queue.size > 0) {
        const node = queue.dequeue()!;
        if (predicate(node)) results.push(node);
        if (node.children != null) {
            queue.enqueue(node.children[0]);
            queue.enqueue(node.children[1]);
        }
    }
    return results;
}

export class BTreeEngine {
    rootTile: Tile = new Tile();
    config: EngineConfig;
    // whether the driver should rotate insertion directions when rotateLayout is on
    translatesRotation: boolean = true;
    // preselected split for the next inserted window (null = none)
    private preselectedDirection: Preselect | null = null;

    constructor(config: EngineConfig) {
        this.config = config;
    }

    // Choose the split direction and side for the next inserted window
    // (Hyprland layoutmsg preselect). Consumed by the next insertion unless
    // persistentPreselect is enabled; pass null to clear.
    preselect(direction: Preselect | null): void {
        this.preselectedDirection = direction;
    }

    private consumePreselect(): Preselect | null {
        const direction = this.preselectedDirection;
        if (direction != null && !this.config.persistentPreselect) {
            this.preselectedDirection = null;
        }
        return direction;
    }

    // mark a freshly created parent split to honor a preselected direction,
    // and report which child the new client takes (first = left/top)
    private markPreselectedSplit(node: TreeNode, pre: Preselect): boolean {
        node.splitDirection =
            pre === Preselect.Up || pre === Preselect.Down
                ? LayoutDirection.Vertical
                : LayoutDirection.Horizontal;
        node.splitPreselected = true;
        return pre === Preselect.Up || pre === Preselect.Left;
    }

    buildLayout(rootGeometry?: { width: number; height: number }): void {
        // set original tile direction based on rotating layout or not
        this.rootTile = new Tile();
        const baseDir = this.config.rotateLayout
            ? LayoutDirection.Vertical
            : LayoutDirection.Horizontal;
        this.rootTile.layoutDirection = baseDir;
        // set up
        this.nodeMap = new BiMap();

        // aspect-based splitting (Hyprland dwindle): cut along the longer
        // axis of each node's real tile geometry. Without a root geometry
        // (stubbed harness / unknown screen) fall back to depth alternation.
        const useAspect = rootGeometry != undefined;
        const rootWidth = rootGeometry?.width ?? 0;
        const rootHeight = rootGeometry?.height ?? 0;

        // Track depth for dwindle alternating splits, and each node's parent
        // split direction for the perpendicularity constraint
        const queue: Queue<{
            node: TreeNode;
            depth: number;
            width: number;
            height: number;
            parentDir: number | null;
        }> = new Queue();
        queue.enqueue({
            node: this.rootNode,
            depth: 0,
            width: rootWidth,
            height: rootHeight,
            parentDir: null,
        });
        this.nodeMap.set(this.rootNode, this.rootTile);

        while (queue.size > 0) {
            const { node, depth, width, height, parentDir } = queue.dequeue()!;
            const tile = this.nodeMap.get(node);
            if (tile == undefined) {
                continue;
            }

            if (node.client != null) {
                tile.client = node.client;
            }
            if (node.children != null) {
                let splitDir: number;

                if (node.splitPreselected && node.splitDirection !== 0) {
                    // direction chosen at insertion by a preselect; consumed
                    // by this build and not applied again
                    splitDir = node.splitDirection;
                    node.splitPreselected = false;
                } else if (node.splitPinned && node.splitDirection !== 0) {
                    // explicitly toggled by the user: keep this direction
                    splitDir = node.splitDirection;
                } else if (
                    this.config.preserveSplit &&
                    node.splitDirection !== 0
                ) {
                    // Use preserved split direction if enabled and previously set
                    splitDir = node.splitDirection;
                } else if (
                    this.config.forceSplit !== ForceSplit.Disabled
                ) {
                    // Use forced direction if configured
                    splitDir =
                        this.config.forceSplit === ForceSplit.LeftTop
                            ? LayoutDirection.Vertical
                            : LayoutDirection.Horizontal;
                } else if (useAspect) {
                    // Hyprland dwindle: cut along the longer axis of the
                    // tile's actual geometry. rotateLayout transposes the
                    // aspect comparison so the decision lands rotated, and
                    // splitWidthMultiplier biases toward top/bottom splits
                    // when above 1.0 (like Hyprland's split_width_multiplier).
                    const primary = this.config.rotateLayout ? height : width;
                    const secondary = this.config.rotateLayout ? width : height;
                    splitDir =
                        secondary * this.config.splitWidthMultiplier > primary
                            ? LayoutDirection.Vertical
                            : LayoutDirection.Horizontal;
                } else {
                    // Dwindle: alternate split direction based on depth
                    splitDir =
                        depth % 2 === 0
                            ? baseDir
                            : baseDir === LayoutDirection.Horizontal
                              ? LayoutDirection.Vertical
                              : LayoutDirection.Horizontal;
                }

                // Store direction for preserve_split / pinned features
                // KWin 6.4+ constraint (CustomTile::split creates a SIBLING
                // when the parent group already cuts the same way): a nested
                // split may never equal its parent's direction, so a colliding
                // decision is flipped to perpendicular. The root split is
                // unconstrained. Side hints (preselect) survive as
                // first/second-child placement under the flipped axis.
                if (parentDir != null && splitDir === parentDir) {
                    splitDir =
                        splitDir === LayoutDirection.Horizontal
                            ? LayoutDirection.Vertical
                            : LayoutDirection.Horizontal;
                }
                node.splitDirection = splitDir;

                // Set the tile's layout direction before splitting
                tile.layoutDirection = splitDir;
                tile.split();

                this.nodeMap.set(node.children[0], tile.tiles[0]);
                this.nodeMap.set(node.children[1], tile.tiles[1]);

                // Apply split ratio from node state, defaulting to even 50/50
                const ratio = node.sizeRatio !== 0.5 ? node.sizeRatio : 0.5;
                tile.tiles[0].relativeSize = ratio;
                tile.tiles[1].relativeSize = 1 - ratio;

                // Children geometry: split the node's area by the ratio
                // along the split axis
                const horizontal = splitDir === LayoutDirection.Horizontal;
                queue.enqueue({
                    node: node.children[0],
                    depth: depth + 1,
                    width: horizontal ? width * ratio : width,
                    height: horizontal ? height : height * ratio,
                    parentDir: splitDir,
                });
                queue.enqueue({
                    node: node.children[1],
                    depth: depth + 1,
                    width: horizontal ? width * (1 - ratio) : width,
                    height: horizontal ? height : height * (1 - ratio),
                    parentDir: splitDir,
                });
            }
        }
    }

    addClient(client: Client) {
        // Dwindle behavior: always insert at the deepest leaf node
        // This creates the characteristic spiral pattern where new windows
        // alternate split direction into a corner

        // Find the deepest leaf node (rightmost for Right insertion, leftmost for Left)
        let current: TreeNode = this.rootNode;

        // Navigate to the deepest leaf
        while (current.children != null) {
            // For dwindle: always go to the "last" child based on insertion point
            if (this.config.insertionPoint == InsertionPoint.Left) {
                current = current.children[0]; // Go left (first child)
            } else {
                current = current.children[1]; // Go right (second child)
            }
        }

        // Now current is the deepest leaf node
        if (current.client != null) {
            // Split this node and add the new client
            current.split();
            const pre = this.consumePreselect();
            if (pre != null) {
                // preselect decides the split axis and the client's side
                const first = this.markPreselectedSplit(current, pre);
                if (first) {
                    current.children![0].client = client;
                    current.children![1].client = current.client;
                } else {
                    current.children![0].client = current.client;
                    current.children![1].client = client;
                }
            } else if (this.config.insertionPoint == InsertionPoint.Left) {
                current.children![0].client = client;
                current.children![1].client = current.client;
            } else {
                current.children![0].client = current.client;
                current.children![1].client = client;
            }
            current.client = null;
        } else {
            // Empty node (root with no windows yet)
            current.client = client;
        }
    }

    removeClient(client: Client) {
        const node = findNode(this.rootNode, (n) => n.client === client);
        if (node != null) {
            node.remove();
        }
    }

    putClientInTile(client: Client, tile: Tile, direction?: Direction) {
        const node = this.nodeMap.inverse.get(tile);
        if (node == undefined) {
            // usually means there are no other tiles in the layout
            this.addClient(client);
            return;
        }
        if (node.client == null) {
            node.client = client;
        } else {
            node.split();
            // put new client in zeroth child, else put in first child
            let putClientInZero = false;
            const pre = direction == undefined ? this.consumePreselect() : null;
            if (direction != undefined) {
                if (tile.layoutDirection === LayoutDirection.Horizontal) {
                    // horizontal
                    if (!(direction & Direction.Right)) {
                        putClientInZero = true;
                    }
                } // vertical
                else {
                    if (direction & Direction.Up) {
                        putClientInZero = true;
                    }
                }
            } else if (pre != null) {
                // no explicit drop/snap direction: a preselect decides
                // both the split axis and the client's side
                putClientInZero = this.markPreselectedSplit(node, pre);
            }
            if (putClientInZero) {
                node.children![0].client = client;
                node.children![1].client = node.client;
            } else {
                node.children![0].client = node.client;
                node.children![1].client = client;
            }
            node.client = null;
        }
    }

    regenerateLayout() {
        // just for checking resizing mostly
        for (const node of this.nodeMap.keys()) {
            const tile = this.nodeMap.get(node);
            if (tile == undefined) {
                continue;
            }
            if (tile.tiles.length == 2) {
                node.sizeRatio = tile.tiles[0].relativeSize;
            }
        }
    }

    // Swap the two halves of the layout (root's children/subtrees)
    swapHalves(): boolean {
        if (this.rootNode.children == null) return false;

        const temp = this.rootNode.children[0];
        this.rootNode.children[0] = this.rootNode.children[1];
        this.rootNode.children[1] = temp;

        // Swap sibling references to keep them consistent
        this.rootNode.children[0].sibling = this.rootNode.children[1];
        this.rootNode.children[1].sibling = this.rootNode.children[0];

        // Invert the root's size ratio so each half retains its original size
        this.rootNode.sizeRatio = 1 - this.rootNode.sizeRatio;

        return true;
    }

    // Hyprland-style: toggle split direction at the parent of a client.
    // The affected node is pinned so its direction survives rebuilds even
    // without preserveSplit (like Hyprland's togglesplit).
    toggleSplit(client: Client): boolean {
        const node = findNode(
            this.rootNode,
            (n) => n.client === client && n.parent != null,
        );
        if (!node || !node.parent) return false;

        // Handle uninitialized splitDirection (0) by setting based on current layout
        if (node.parent.splitDirection === 0) {
            node.parent.splitDirection = LayoutDirection.Horizontal;
        }
        // Toggle between horizontal and vertical
        node.parent.splitDirection =
            node.parent.splitDirection === LayoutDirection.Horizontal
                ? LayoutDirection.Vertical
                : LayoutDirection.Horizontal;
        node.parent.splitPinned = true;
        return true;
    }

    // Get all clients in order (for cycling)
    getAllClients(): Client[] {
        return collectNodes(this.rootNode, (n) => n.client != null).map(
            (n) => n.client!,
        );
    }

    // Get all clients in a specific subtree (used for per-half caps)
    clientCount(node: TreeNode | null = this.rootNode): number {
        if (node == null) {
            return 0;
        }
        return collectNodes(node, (n) => n.client != null).length;
    }

    // Root-level child the dwindle inserts into (the "pile" half), or the root
    // itself while there are fewer than two halves
    dwindleSideNode(): TreeNode | null {
        if (this.rootNode.children == null) {
            return this.rootNode;
        }
        return this.config.insertionPoint == InsertionPoint.Left
            ? this.rootNode.children[0]
            : this.rootNode.children[1];
    }

    // The root-level child containing the given node, or the root itself if it
    // has no halves yet
    rootChildNode(node: TreeNode | null): TreeNode | null {
        if (node == null) {
            return null;
        }
        let current: TreeNode = node;
        while (current.parent != null && current.parent.parent != null) {
            current = current.parent;
        }
        return current;
    }

    // Resolve the internal node for a tile (requires a recent buildLayout)
    nodeOfTile(tile: Tile): TreeNode | null {
        return this.nodeMap.inverse.get(tile) ?? null;
    }

    private rootNode: RootNode = new RootNode();
    private nodeMap: BiMap<TreeNode, Tile> = new BiMap();
}
