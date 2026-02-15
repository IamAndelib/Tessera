// layouts/btree.ts - Implementation of binary tree layout

import {
    Tile,
    Client,
    TilingEngine,
    EngineCapability,
    EngineSettings,
} from "../engine";
import { Direction } from "../../util/geometry";
import { InsertionPoint } from "../../util/config";
import { LayoutDirection } from "kwin-api";
import BiMap from "mnemonist/bi-map";
import Queue from "mnemonist/queue";

class TreeNode {
    parent: TreeNode | null = null;
    sibling: TreeNode | null = null;
    children: [TreeNode, TreeNode] | null = null;
    client: Client | null = null;
    // ratio of child 1 to self
    sizeRatio: number = 0.5;
    // Hyprland-style: stored split direction (1=horizontal, 2=vertical, 0=not yet determined)
    // Used for preserve_split to remember the direction when a node was first split
    splitDirection: number = 0;
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

export default class BTreeEngine extends TilingEngine {
    engineCapability = EngineCapability.None;
    private rootNode: RootNode = new RootNode();
    private nodeMap: BiMap<TreeNode, Tile> = new BiMap();

    // no engine settings for btree
    // (we dont save resizings through dbus saver right now)
    get engineSettings(): EngineSettings {
        return {};
    }
    set engineSettings(_: EngineSettings) {}

    buildLayout() {
        // set original tile direction based on rotating layout or not
        this.rootTile = new Tile();
        const baseDir = this.config.rotateLayout
            ? LayoutDirection.Vertical
            : LayoutDirection.Horizontal;
        this.rootTile.layoutDirection = baseDir;
        // set up
        this.nodeMap = new BiMap();

        // Track depth for dwindle alternating splits
        const queue: Queue<{ node: TreeNode; depth: number }> = new Queue();
        queue.enqueue({ node: this.rootNode, depth: 0 });
        this.nodeMap.set(this.rootNode, this.rootTile);

        while (queue.size > 0) {
            const { node, depth } = queue.dequeue()!;
            const tile = this.nodeMap.get(node)!;

            if (node.client != null) {
                tile.client = node.client;
            }
            if (node.children != null) {
                let splitDir: number;

                if (this.config.preserveSplit && node.splitDirection !== 0) {
                    // Use preserved split direction if enabled and previously set
                    splitDir = node.splitDirection;
                } else if (this.config.forceSplit !== 0) {
                    // Use forced direction if configured
                    // forceSplit: 1=left/top (vertical), 2=right/bottom (horizontal)
                    splitDir =
                        this.config.forceSplit === 1
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

                // Store direction for preserve_split feature
                node.splitDirection = splitDir;

                // Set the tile's layout direction before splitting
                tile.layoutDirection = splitDir;
                tile.split();

                this.nodeMap.set(node.children[0], tile.tiles[0]);
                this.nodeMap.set(node.children[1], tile.tiles[1]);

                // Apply default split ratio from config
                const ratio = this.config.defaultSplitRatio;
                tile.tiles[0].relativeSize =
                    node.sizeRatio !== 0.5 ? node.sizeRatio : ratio;
                tile.tiles[1].relativeSize =
                    node.sizeRatio !== 0.5 ? 1 - node.sizeRatio : 1 - ratio;

                queue.enqueue({ node: node.children[0], depth: depth + 1 });
                queue.enqueue({ node: node.children[1], depth: depth + 1 });
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
            if (this.config.insertionPoint == InsertionPoint.Left) {
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
        let queue: Queue<TreeNode> = new Queue();
        queue.enqueue(this.rootNode);
        let deleteQueue: TreeNode[] = [];
        while (queue.size > 0) {
            const node = queue.dequeue()!;
            if (node.client == client) {
                deleteQueue.push(node);
            }
            if (node.children != null) {
                for (const child of node.children) {
                    queue.enqueue(child);
                }
            }
        }
        for (const node of deleteQueue) {
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
            const tile = this.nodeMap.get(node)!;
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

    // Hyprland-style: swap a client with its sibling in the tree
    swapClients(client1: Client, client2: Client): boolean {
        let node1: TreeNode | null = null;
        let node2: TreeNode | null = null;

        // Find both nodes
        let queue: Queue<TreeNode> = new Queue();
        queue.enqueue(this.rootNode);
        while (queue.size > 0) {
            const node = queue.dequeue()!;
            if (node.client === client1) node1 = node;
            if (node.client === client2) node2 = node;
            if (node1 && node2) break;
            if (node.children != null) {
                queue.enqueue(node.children[0]);
                queue.enqueue(node.children[1]);
            }
        }

        if (!node1 || !node2) return false;

        // Swap the clients
        const temp = node1.client;
        node1.client = node2.client;
        node2.client = temp;
        return true;
    }

    // Get the sibling client of a given client (for swap with sibling)
    getSiblingClient(client: Client): Client | null {
        let queue: Queue<TreeNode> = new Queue();
        queue.enqueue(this.rootNode);
        while (queue.size > 0) {
            const node = queue.dequeue()!;
            if (node.client === client && node.sibling?.client) {
                return node.sibling.client;
            }
            if (node.children != null) {
                queue.enqueue(node.children[0]);
                queue.enqueue(node.children[1]);
            }
        }
        return null;
    }

    // Hyprland-style: toggle split direction at the parent of a client
    toggleSplit(client: Client): boolean {
        const queue: Queue<TreeNode> = new Queue();
        queue.enqueue(this.rootNode);
        while (queue.size > 0) {
            const node = queue.dequeue()!;
            if (node.client === client && node.parent != null) {
                // Handle uninitialized splitDirection (0) by setting based on current layout
                if (node.parent.splitDirection === 0) {
                    node.parent.splitDirection = LayoutDirection.Horizontal;
                }
                // Toggle between horizontal and vertical
                node.parent.splitDirection =
                    node.parent.splitDirection === LayoutDirection.Horizontal
                        ? LayoutDirection.Vertical
                        : LayoutDirection.Horizontal;
                return true;
            }
            if (node.children != null) {
                queue.enqueue(node.children[0]);
                queue.enqueue(node.children[1]);
            }
        }
        return false;
    }

    // Get all clients in order (for cycling)
    getAllClients(): Client[] {
        const clients: Client[] = [];
        const queue: Queue<TreeNode> = new Queue();
        queue.enqueue(this.rootNode);
        while (queue.size > 0) {
            const node = queue.dequeue()!;
            if (node.client != null) {
                clients.push(node.client);
            }
            if (node.children != null) {
                queue.enqueue(node.children[0]);
                queue.enqueue(node.children[1]);
            }
        }
        return clients;
    }
}
