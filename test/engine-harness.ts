// engine-harness.ts - Deterministic unit tests for the BTreeEngine.
// Runs in plain node (no KWin): "kwin-api" and "kwin-api/qt" are aliased
// at bundle time to test/stubs/*.mjs. Wired up via `make test`.

import { BTreeEngine, Client } from "../src/engine/index";

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

console.log(
    failures === 0
        ? "\nALL ENGINE CHECKS PASSED"
        : "\n" + failures + " CHECK(S) FAILED",
);
process.exit(failures === 0 ? 0 : 1);
