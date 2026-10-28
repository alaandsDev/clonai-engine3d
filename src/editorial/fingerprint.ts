import { createHash } from "node:crypto";
import { fail } from "../engine3d/contracts";
export const COMPILER_VERSION = "editorial-compiler/1.0.0";
export function canonicalJson(value: unknown): string {
    const stack = new Set<object>();
    const encode = (x: any): string => {
        if (x === null || typeof x === "boolean" || typeof x === "string")
            return JSON.stringify(x);
        if (typeof x === "number" && Number.isFinite(x))
            return JSON.stringify(x);
        if (!x || typeof x !== "object" || stack.has(x))
            return fail("EDITORIAL_CANONICAL", "non JSON or cyclic value");
        if (Object.getOwnPropertySymbols(x).length)
            fail("EDITORIAL_CANONICAL", "symbol keys are not JSON");
        stack.add(x);
        let s: string;
        if (Array.isArray(x)) {
            if (Object.keys(x).length !== x.length)
                fail("EDITORIAL_CANONICAL", "sparse or decorated array");
            s = "[" + x.map(encode).join(",") + "]";
        }
        else {
            if (![Object.prototype, null].includes(Object.getPrototypeOf(x)))
                fail("EDITORIAL_CANONICAL", "plain JSON required");
            s = "{" + Object.keys(x).sort().map(k => JSON.stringify(k) + ":" + encode(x[k])).join(",") + "}";
        }
        stack.delete(x);
        return s;
    };
    return encode(value);
}
export const jsonHash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
