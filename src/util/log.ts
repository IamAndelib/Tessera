// log.ts - Logging support

import { Root } from "../extern/qml";

export class Log {
    private readonly printFn: Root["printQml"] | undefined;
    debugEnabled: boolean = false;

    constructor(root: Root) {
        this.printFn = root.printQml;
    }

    private print(opener: string, stuff: any[]): void {
        if (this.printFn == undefined) {
            return;
        }
        let ret = opener;
        for (const s of stuff) {
            ret += " ";
            if (s === null) {
                ret += "null";
            } else if (s === undefined) {
                ret += "undefined";
            } else if (typeof s == "string") {
                ret += s;
            } else {
                ret += s.toString();
            }
        }
        this.printFn(ret);
    }

    debug(...stuff: any[]): void {
        if (this.debugEnabled) {
            this.print("Tessera DBG:", stuff);
        }
    }

    info(...stuff: any[]) {
        this.print("Tessera INF:", stuff);
    }

    error(...stuff: any[]) {
        this.print("Tessera ERR:", stuff);
    }
}
