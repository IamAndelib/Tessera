// engine-harness.ts - Deterministic unit tests for the BTreeEngine and the
// driver window state machine. Runs in plain node (no KWin): "kwin-api" and
// "kwin-api/qt" are aliased at bundle time to test/stubs/*.mjs. Wired up via
// `make test`.

import { BTreeEngine, Client, Preselect } from "../src/engine/index";
import { TilingDriver, TilingState } from "../src/driver/driver";
import { Log } from "../src/util/log";

const H = 1;
const V = 2;

function mk(name: string) {
    return new Client({ resourceClass: name, minSize: null });
}

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
console.log(
        (cond ? "PASS " : "FAIL ") +
            name +
            (detail !== undefined ? " :: " + detail : ""),
    );
    if (!cond) failures++;
}
const own = (t: any) => t.clients.map((c: any) => c.name).join(",") || "-";

// Right-hand bias cascade with the DEFAULT config (insertion Right, rotateLayout false)
{
    const e = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    ["A", "B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    const rt = e.rootTile;
    check("root split is Horizontal", rt.layoutDirection === H);
    check("root has exactly 2 children", rt.tiles.length === 2);
    // geometry: A = LEFT half, B = TOP of right half, C = BOTTOM-LEFT of right half, D = BOTTOM-RIGHT of right half
    check("A occupies LEFT half", own(rt.tiles[0]) === "A", own(rt.tiles[0]));
    const right = rt.tiles[1];
    check(
        "right half splits Vertical",
        right.layoutDirection === V,
        "got " + right.layoutDirection,
    );
    check("right half has 2 children", right.tiles.length === 2);
    check(
        "B is in TOP of right half",
        own(right.tiles[0]) === "B",
        own(right.tiles[0]),
    );
    const bottomRight = right.tiles[1];
    check(
        "bottom half of right is split Horizontal",
        bottomRight.layoutDirection === H,
        "got " + bottomRight.layoutDirection,
    );
    check(
        "C is LEFT of bottom-right",
        own(bottomRight.tiles[0]) === "C",
        own(bottomRight.tiles[0]),
    );
    check(
        "D is RIGHT of bottom-right",
        own(bottomRight.tiles[1]) === "D",
        own(bottomRight.tiles[1]),
    );
}

// Left bias still selectable
{
    const e = new BTreeEngine({
        insertionPoint: 0,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    const rt = e.rootTile;
    check(
        "with Left insertion: B occupies LEFT half",
        own(rt.tiles[0]) === "B",
        own(rt.tiles[0]),
    );
}

// rotateLayout flips the root split to Vertical (B lands in BOTTOM half)
{
    const e = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: true,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    const rt = e.rootTile;
    check("rotateLayout: root split is Vertical", rt.layoutDirection === V);
    check(
        "rotateLayout: B lands in BOTTOM half",
        own(rt.tiles[1]) === "B",
        own(rt.tiles[1]),
    );
}

// Closing a window collapses cleanly into the cascade
{
    const e = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    ["A", "B", "C"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    e.removeClient(e.getAllClients()[0]);
    e.buildLayout();
    const ct = e.rootTile;
    const clients = e
        .getAllClients()
        .map((c: any) => c.name)
        .join(",");
    check("after closing A: 2 clients remain", clients === "B,C", clients);
    check("after closing A: root Horizontal", ct.layoutDirection === H);
    check(
        "after closing A: B left, C right",
        own(ct.tiles[0]) === "B" && own(ct.tiles[1]) === "C",
        own(ct.tiles[0]) + " | " + own(ct.tiles[1]),
    );
}

// --- per-half window cap helpers ---

function engine() {
    return new BTreeEngine({
        insertionPoint: 1, // Right bias
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
}

// clientCount over single/pile/two-half layouts
{
    const e = engine();
    check("empty engine has 0 clients", e.clientCount() === 0);
    check(
        "empty root is countable as the single half",
        e.dwindleSideNode() != null,
    );
    check(
        "empty root counts 0 clients",
        e.clientCount(e.dwindleSideNode()) === 0,
    );
    e.addClient(mk("A"));
    e.buildLayout();
    check("single window -> 1 client", e.clientCount() === 1);
    ["B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    check("4 clients total", e.clientCount() === 4);
    const side = e.dwindleSideNode();
    check("dwindle side resolves", side != null);
    if (side != null) {
        check(
            "right (dwindle) side holds B,C,D",
            e.clientCount(side) === 3,
            "got " + e.clientCount(side),
        );
        check(
            "left side holds the singleton A",
            e.clientCount() - e.clientCount(side) === 1,
        );
    }
}

// swapHalves swaps the pile with the singleton, preserving sizes
{
    const e = engine();
    ["A", "B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    check("swap succeeds", e.swapHalves() === true);
    e.buildLayout();
    const rt = e.rootTile;
    check(
        "A moves to the RIGHT half",
        own(rt.tiles[1]) === "A",
        own(rt.tiles[1]),
    );
    const side = e.dwindleSideNode();
    check(
        "right half is the singleton (1 client)",
        side != null && e.clientCount(side) === 1,
    );
    check(
        "old pile stays on the LEFT half (3 clients)",
        side != null && e.clientCount() - e.clientCount(side) === 3,
    );
    check(
        "halves stay 50/50 after swap",
        Math.abs(rt.tiles[0].relativeSize - 0.5) < 0.001 &&
            Math.abs(rt.tiles[1].relativeSize - 0.5) < 0.001,
        rt.tiles[0].relativeSize + "," + rt.tiles[1].relativeSize,
    );
}

// After a swap, new windows dwindle a FRESH pile on the right (the feature)
{
    const e = engine();
    ["A", "B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    e.swapHalves();
    e.buildLayout();
    ["F", "G", "H", "I"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    check("8 clients total after regrow", e.clientCount() === 8);
    const side = e.dwindleSideNode();
    check(
        "right half fills to 5 (A+F+G+H+I)",
        side != null && e.clientCount(side) === 5,
        side != null ? "got " + e.clientCount(side) : "no side",
    );
    check(
        "left half keeps the frozen pile (B,C,D)",
        side != null && e.clientCount() - e.clientCount(side) === 3,
    );
    const right = e.rootTile.tiles[1];
    check(
        "A anchors the top of the new right pile",
        own(right.tiles[0]) === "A",
        own(right.tiles[0]),
    );
    check("right pile is a fresh dwindle cascade", right.tiles.length === 2);
    // Dwindle still behaves after the fork: closing an old pile window keeps
    // the cascade count sane
    e.removeClient(e.getAllClients()[1]);
    e.buildLayout();
    check("7 clients after closing one", e.clientCount() === 7);
}

// swapHalves refuses when there is nothing to swap
{
    const e = engine();
    e.addClient(mk("A"));
    e.buildLayout();
    check("swap with 1 window returns false", e.swapHalves() === false);
}

// rootChildNode / nodeOfTile resolve a tile to its top-level half
{
    const e = engine();
    ["A", "B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    const rt = e.rootTile;
    const aNode = e.nodeOfTile(rt.tiles[0]);
    const left = aNode != null ? e.rootChildNode(aNode) : null;
    check(
        "A's half resolves and holds 1 client",
        left != null && e.clientCount(left) === 1,
    );
    const rightTileNode = e.nodeOfTile(rt.tiles[1]);
    const right = rightTileNode != null ? e.rootChildNode(rightTileNode) : null;
    check("right tile maps to the dwindle half", e.dwindleSideNode() === right);
    check(
        "unregistered tile resolves to null",
        e.nodeOfTile({} as any) === null,
    );
}

// Layout orientation transpose (rotateLayout) for the two-window case:
// side-by-side windows become top/bottom, left on top, right on bottom
{
    const e = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout();
    });
    const rt = e.rootTile;
    check(
        "two windows start side by side",
        rt.layoutDirection === H &&
            own(rt.tiles[0]) === "A" &&
            own(rt.tiles[1]) === "B",
        own(rt.tiles[0]) + "|" + own(rt.tiles[1]),
    );
    e.config.rotateLayout = true;
    e.buildLayout();
    const rt2 = e.rootTile;
    check(
        "transposed to top/bottom (left on top, right on bottom)",
        rt2.layoutDirection === V &&
            own(rt2.tiles[0]) === "A" &&
            own(rt2.tiles[1]) === "B",
        own(rt2.tiles[0]) + "|" + own(rt2.tiles[1]) +
            " dir=" + rt2.layoutDirection,
    );
    e.config.rotateLayout = false;
    e.buildLayout();
    const rt3 = e.rootTile;
    check(
        "toggling back restores side by side",
        rt3.layoutDirection === H &&
            own(rt3.tiles[0]) === "A" &&
            own(rt3.tiles[1]) === "B",
        own(rt3.tiles[0]) + "|" + own(rt3.tiles[1]),
    );
}

// --- M2: aspect-based (Hyprland) split directions ---

function aspectEngine(rotate: boolean) {
    return new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: rotate,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
}

// landscape screen: two windows split side by side (longer axis first)
{
    const e = aspectEngine(false);
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout({ width: 1600, height: 900 });
    });
    const rt = e.rootTile;
    check(
        "aspect 1600x900: root splits Horizontal",
        rt.layoutDirection === H,
        "got " + rt.layoutDirection,
    );
}

// portrait screen: same two windows split top/bottom
{
    const e = aspectEngine(false);
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout({ width: 900, height: 1600 });
    });
    const rt = e.rootTile;
    check(
        "aspect 900x1600: root splits Vertical",
        rt.layoutDirection === V,
        "got " + rt.layoutDirection,
    );
}

// cascade on 16:9 still matches the classic dwindle pattern
{
    const e = aspectEngine(false);
    ["A", "B", "C", "D"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout({ width: 1600, height: 900 });
    });
    const rt = e.rootTile;
    check(
        "aspect 16:9 cascade: A left, B top-right",
        own(rt.tiles[0]) === "A" && own(rt.tiles[1].tiles[0]) === "B",
        own(rt.tiles[0]) + "|" + own(rt.tiles[1].tiles[0]),
    );
    check(
        "aspect 16:9 cascade: bottom-right splits Horizontal",
        rt.tiles[1].tiles[1].layoutDirection === H,
        "got " + rt.tiles[1].tiles[1].layoutDirection,
    );
}

// split direction follows real geometry but is constrained by KWin 6.4+
// (CustomTile::split makes a sibling, not children, when the parent group
// cuts the same way): a same-direction aspect decision flips perpendicular
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    // shrink A to a quarter: its sibling remainder (1200x900) is wide and
    // the aspect rule picks Horizontal — same as the parent, so it flips
    e.rootTile.tiles[0].relativeSize = 0.25;
    e.regenerateLayout();
    e.addClient(mk("C"));
    e.buildLayout({ width: 1600, height: 900 });
    const right = e.rootTile.tiles[1];
    check(
        "same-direction aspect flips to perpendicular (KWin constraint)",
        right.layoutDirection === V &&
            own(right.tiles[0]) === "B" &&
            own(right.tiles[1]) === "C",
        "dir=" + right.layoutDirection + " " + own(right.tiles[0]) + "|" + own(right.tiles[1]),
    );
    // the flip must be stable across rebuilds (no tree corruption)
    e.buildLayout({ width: 1600, height: 900 });
    e.buildLayout({ width: 1600, height: 900 });
    const right2 = e.rootTile.tiles[1];
    check(
        "flipped direction stable across rebuilds",
        right2.layoutDirection === V &&
            own(right2.tiles[0]) === "B" &&
            own(right2.tiles[1]) === "C",
        "dir=" + right2.layoutDirection + " " + own(right2.tiles[0]) + "|" + own(right2.tiles[1]),
    );
}

// rotateLayout transposes the aspect decision
{
    const e = aspectEngine(true);
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout({ width: 1600, height: 900 });
    });
    check(
        "rotateLayout on landscape: root splits Vertical",
        e.rootTile.layoutDirection === V,
        "got " + e.rootTile.layoutDirection,
    );
    e.config.rotateLayout = false;
    e.buildLayout({ width: 900, height: 1600 });
    check(
        "portrait without rotateLayout: root splits Vertical",
        e.rootTile.layoutDirection === V,
        "got " + e.rootTile.layoutDirection,
    );
}

// toggleSplit pins a node's direction across rebuilds, geometry or not
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    check("pre-toggle root is Horizontal", e.rootTile.layoutDirection === H);
    const clientA = e.getAllClients()[0];
    check("toggleSplit succeeds", e.toggleSplit(clientA) === true);
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "pinned direction survives aspect rebuild",
        e.rootTile.layoutDirection === V,
        "got " + e.rootTile.layoutDirection,
    );
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "pin persists across rebuilds without preserveSplit",
        e.rootTile.layoutDirection === V,
        "got " + e.rootTile.layoutDirection,
    );
}

// --- M1: driver window state machine ---

function mkWindow(name: string): any {
    return {
        resourceClass: name,
        minSize: null,
        tile: null,
        keepAbove: false,
        keepBelow: false,
        fullScreen: false,
        minimized: false,
        frameGeometry: null,
        setMaximize() {},
    };
}

function mkExt(): any {
    return {
        isTiled: false,
        wasTiled: false,
        isSingleMaximized: false,
        captureState() {},
        priorKeepAbove: false,
        priorKeepBelow: false,
        priorFullScreen: false,
        priorMaximizedFull: false,
        priorMinimized: false,
        priorFrameGeometry: null,
    };
}

function mkDriver(cap: number): { driver: TilingDriver; extensions: Map<any, any> } {
    const extensions: Map<any, any> = new Map();
    const ctrl: any = {
        logger: new Log({} as any),
        config: {
            maxTiledWindowsPerHalf: cap,
            tiledWindowStacking: 0,
            maximizeSingle: false,
        },
        windowExtensions: extensions,
        workspaceExtensions: { lastActiveWindow: null },
        workspace: { raiseWindow() {}, windows: [] },
        managedTiles: new Set(),
    };
    const engine = new BTreeEngine({
        insertionPoint: 1, // Right bias
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 1.0,
    });
    return { driver: new TilingDriver(engine, ctrl), extensions };
}

// cap-hit, FIFO promotion, suspend/release cycles.
// cap=3 with right-bias insertion: A anchors the left half; B,C,D pile up on
// the right until it holds 3; E,F then overflow.
{
    const { driver, extensions } = mkDriver(3);
    const A = mkWindow("A");
    const B = mkWindow("B");
    const C = mkWindow("C");
    const D = mkWindow("D");
    const E = mkWindow("E");
    const F = mkWindow("F");
    for (const w of [A, B, C, D, E, F]) {
        extensions.set(w, mkExt());
    }
    driver.addWindow(A);
    driver.addWindow(B);
    driver.addWindow(C);
    driver.addWindow(D);
    check(
        "A-D tile under the per-half cap",
        [A, B, C, D].every(
            (w) =>
                driver.stateOf(w) === TilingState.Tiled &&
                extensions.get(w).isTiled === true,
        ),
    );
    driver.addWindow(E);
    check(
        "E overflows once the dwindle half is full",
        driver.stateOf(E) === TilingState.Overflowed &&
            extensions.get(E).isTiled === false,
    );
    check("capped-out floater sits above the tiled layer", E.keepAbove === true);
    driver.addWindow(F);
    check("F overflows too", driver.stateOf(F) === TilingState.Overflowed);

    // closing tiled windows frees dwindle-half slots (the tree reflows on
    // every removal); floaters must promote strictly in FIFO order
    const tiledQueue = [A, B, C, D];
    const promoted: any[] = [];
    while (driver.overflowedWindows().length > 0) {
        const next = tiledQueue.find(
            (w) => driver.stateOf(w) === TilingState.Tiled,
        );
        const oldest = driver.overflowedWindows()[0];
        const didPromote = driver.removeWindow(next);
        if (didPromote) {
            check(
                "promotion fills the freed slot with the oldest floater",
                driver.stateOf(oldest) === TilingState.Tiled &&
                    extensions.get(oldest).isTiled === true,
            );
            promoted.push(oldest);
        } else {
            check(
                "non-slot-freeing removal promotes nobody",
                driver.stateOf(oldest) === TilingState.Overflowed,
            );
        }
    }
    check(
        "both floaters promoted in FIFO order (E before F)",
        promoted.length === 2 && promoted[0] === E && promoted[1] === F,
    );

    // re-hitting the cap requeues at the back of the FIFO
    driver.addWindow(A);
    check("A overflowed again", driver.stateOf(A) === TilingState.Overflowed);

    // untileAll restores window properties but keeps lifecycle state intact
    driver.untileAll();
    check(
        "untileAll keeps lifecycle state for a later rebuild",
        driver.stateOf(A) === TilingState.Overflowed &&
            driver.stateOf(C) === TilingState.Tiled,
    );
    check("untileAll resets floater keep-above", A.keepAbove === false);

    // a floater closing frees nothing and promotes nobody
    check(
        "closing overflowed A reports no promotion",
        driver.removeWindow(A) === false,
    );
    check(
        "remaining tiled windows keep their tiles",
        [C, D, E, F].every((w) => driver.stateOf(w) === TilingState.Tiled),
    );
}

// suspend/release cycles, restore marker, idempotency and illegal edges.
// cap=2: A anchors the left half, B,C fill the right half, D overflows.
{
    const { driver, extensions } = mkDriver(2);
    const A = mkWindow("A");
    const B = mkWindow("B");
    const C = mkWindow("C");
    const D = mkWindow("D");
    for (const w of [A, B, C, D]) {
        extensions.set(w, mkExt());
    }
    driver.addWindow(A);
    driver.addWindow(B);
    driver.addWindow(C);
    driver.addWindow(D);
    check(
        "A-C tiled, D overflowed",
        driver.stateOf(D) === TilingState.Overflowed &&
            [A, B, C].every((w) => driver.stateOf(w) === TilingState.Tiled),
    );

    // suspension (min/max/fullscreen) marks the restore flag via the choke point
    driver.untileWindow(B, "suspended");
    check(
        "B suspended: floating, wasTiled set",
        driver.stateOf(B) === TilingState.Floating &&
            extensions.get(B).isTiled === false &&
            extensions.get(B).wasTiled === true,
    );
    check(
        "B queued for untile application",
        driver.takePendingUntile().includes(B),
    );
    check("pending untile queue drains", driver.takePendingUntile().length === 0);

    // re-tiling a suspended window clears the restore flag
    driver.addWindow(B);
    check(
        "B re-tiled, wasTiled cleared",
        driver.stateOf(B) === TilingState.Tiled &&
            extensions.get(B).wasTiled === false,
    );

    // idempotency and illegal-edge guards
    driver.addWindow(B);
    check(
        "re-adding a tiled window is a no-op",
        driver.stateOf(B) === TilingState.Tiled,
    );
    driver.untileWindow(D, "released");
    check(
        "untile of an overflowed window is ignored",
        driver.stateOf(D) === TilingState.Overflowed,
    );

    // drag-out release does NOT set the restore flag
    driver.untileWindow(C, "released");
    check(
        "C released to floating without wasTiled",
        driver.stateOf(C) === TilingState.Floating &&
            extensions.get(C).wasTiled === false,
    );

    // a floater closing frees nothing and promotes nobody
    check(
        "closing overflowed D reports no promotion",
        driver.removeWindow(D) === false,
    );
    check(
        "removing an unknown window is a safe no-op",
        driver.removeWindow(mkWindow("Z")) === false,
    );

    // with no floaters waiting, closing a tiled window is pure bookkeeping
    check(
        "removing tiled B with no overflow reports no promotion",
        driver.removeWindow(B) === false,
    );
    check("B state forgotten", driver.stateOf(B) === TilingState.Floating);

    // a released window can be re-tiled explicitly
    driver.addWindow(C);
    check("C re-tiled after release", driver.stateOf(C) === TilingState.Tiled);
}

// --- B1: preselect (Hyprland layoutmsg preselect) ---

function persistentEngine() {
    return new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: true,
        splitWidthMultiplier: 1.0,
    });
}

// one-shot preselect: decides axis AND side for exactly one insertion
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.preselect(Preselect.Left);
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "preselect Left: new window lands LEFT (beats right bias)",
        own(e.rootTile.tiles[0]) === "B" && own(e.rootTile.tiles[1]) === "A",
        own(e.rootTile.tiles[0]) + "|" + own(e.rootTile.tiles[1]),
    );
    e.addClient(mk("C"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "preselect consumed: C follows the default right-bias cascade",
        own(e.rootTile.tiles[0]) === "B" &&
            own(e.rootTile.tiles[1].tiles[0]) === "A" &&
            own(e.rootTile.tiles[1].tiles[1]) === "C",
        own(e.rootTile.tiles[0]) +
            "|" +
            own(e.rootTile.tiles[1].tiles[0]) +
            "," +
            own(e.rootTile.tiles[1].tiles[1]),
    );
}

// preselect Up: vertical split with the new window on top; the choice is
// consumed after one rebuild (aspect rules the next rebuild)
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.preselect(Preselect.Up);
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "preselect Up: root splits Vertical with B on top",
        e.rootTile.layoutDirection === V && own(e.rootTile.tiles[0]) === "B",
        "dir=" + e.rootTile.layoutDirection + " " + own(e.rootTile.tiles[0]),
    );
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "consumed preselect falls back to aspect on rebuild",
        e.rootTile.layoutDirection === H,
        "dir=" + e.rootTile.layoutDirection,
    );
}

// preselect Down puts the new window on the bottom side
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.preselect(Preselect.Down);
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "preselect Down: B lands on the bottom",
        e.rootTile.layoutDirection === V && own(e.rootTile.tiles[1]) === "B",
        "dir=" + e.rootTile.layoutDirection + " " + own(e.rootTile.tiles[1]),
    );
}

// persistent mode: preselect applies to every new split; a direction that
// collides with the parent's is flipped perpendicular, side hint survives
// as second-child placement
{
    const e = persistentEngine();
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.preselect(Preselect.Right);
    e.addClient(mk("B"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "persistent preselect Right: B right of root split",
        own(e.rootTile.tiles[1]) === "B",
        own(e.rootTile.tiles[0]) + "|" + own(e.rootTile.tiles[1]),
    );
    e.addClient(mk("C"));
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "persistent preselect flipped perpendicular under same-direction parent",
        own(e.rootTile.tiles[1].tiles[0]) === "B" &&
            own(e.rootTile.tiles[1].tiles[1]) === "C" &&
            e.rootTile.tiles[1].layoutDirection === V,
        own(e.rootTile.tiles[1].tiles[0]) +
            "," +
            own(e.rootTile.tiles[1].tiles[1]) +
            " dir=" +
            e.rootTile.tiles[1].layoutDirection,
    );
}

// preselect via putClientInTile when no explicit drop direction is given
{
    const e = aspectEngine(false);
    e.addClient(mk("A"));
    e.buildLayout({ width: 1600, height: 900 });
    e.preselect(Preselect.Up);
    e.putClientInTile(mk("B"), e.rootTile);
    e.buildLayout({ width: 1600, height: 900 });
    check(
        "putClientInTile honors preselect without explicit direction",
        e.rootTile.layoutDirection === V && own(e.rootTile.tiles[0]) === "B",
        "dir=" + e.rootTile.layoutDirection + " " + own(e.rootTile.tiles[0]),
    );
}

// --- B2: split width multiplier biases the aspect rule ---

{
    // tile is 800x900 (slightly taller than wide): pure aspect splits it
    // Vertical; a 0.5 multiplier halves the effective height -> Horizontal
    const e = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 0.5,
    });
    ["A", "B"].forEach((n) => {
        e.addClient(mk(n));
        e.buildLayout({ width: 800, height: 900 });
    });
    check(
        "multiplier 0.5 favors side-by-side on a slightly-tall tile",
        e.rootTile.layoutDirection === H,
        "dir=" + e.rootTile.layoutDirection,
    );
    // same geometry, multiplier 2: a slightly-wide tile splits Vertical
    const e2 = new BTreeEngine({
        insertionPoint: 1,
        rotateLayout: false,
        preserveSplit: false,
        forceSplit: 0,
        persistentPreselect: false,
        splitWidthMultiplier: 2,
    });
    ["A", "B"].forEach((n) => {
        e2.addClient(mk(n));
        e2.buildLayout({ width: 900, height: 800 });
    });
    check(
        "multiplier 2 favors top/bottom on a slightly-wide tile",
        e2.rootTile.layoutDirection === V,
        "dir=" + e2.rootTile.layoutDirection,
    );
}

console.log(
    failures === 0
        ? "\nALL ENGINE CHECKS PASSED"
        : "\n" + failures + " CHECK(S) FAILED",
);
process.exit(failures === 0 ? 0 : 1);
