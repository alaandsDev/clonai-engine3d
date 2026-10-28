import path from "node:path";
import { realpath, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fail } from "../engine3d/contracts";
import { relativeAssetPath } from "../editorial/schema";
import { canonicalJson } from "../editorial/fingerprint";
import { assetStatuses, sfxRoles } from "../editorial/contracts";
import type { MediaAsset, MediaCatalog, SfxApproval } from "./contracts";
import type { VisualMediaAsset } from "../visual/contracts";
import { visualAssetShape } from "../visual/schema";
export const soundFail = (message: string): never => fail("SOUND_INVALID", message);
export function object(x: any, keys: string[], optional: string[] = []) { if (!x || typeof x !== "object" || Array.isArray(x))
    soundFail("object required"); for (const k of Object.keys(x))
    if (!keys.includes(k))
        soundFail(`unknown field ${k}`); for (const k of keys)
    if (!optional.includes(k) && (!Object.hasOwn(x, k) || x[k] === undefined || x[k] === null))
        soundFail(`missing ${k}`); }
export function str(x: any) { if (typeof x !== "string" || !x.trim())
    soundFail("nonempty string required"); }
export function number(x: any, min: number, max = Number.MAX_SAFE_INTEGER) { if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
    soundFail("number out of range"); }
export function hash(x: any) { if (typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x))
    soundFail("SHA256 required"); }
export function mediaAssetShape(a: any): asserts a is MediaAsset {
    object(a, ["id", "version", "type", "subtype", "roleTags", "relativePath", "sourceCatalog", "sourceAuditId", "contentHash", "technicalMetadata", "semanticMetadata", "lifecycleStatus", "licenseStatus", "provenance"]);
    if (!/^SFX_[A-Z]+_\d{3}$/.test(a.id) || a.version !== 1 || a.type !== "AUDIO" || a.subtype !== "SFX")
        soundFail("invalid stable media ID/version/category");
    if (!Array.isArray(a.roleTags) || !a.roleTags.length || new Set(a.roleTags).size !== a.roleTags.length || a.roleTags.some((r: any) => !sfxRoles.includes(r)))
        soundFail("invalid roles");
    relativeAssetPath(a.relativePath);
    if (a.relativePath.includes('"'))
        soundFail("invalid path");
    hash(a.contentHash);
    str(a.sourceCatalog);
    str(a.sourceAuditId);
    str(a.provenance);
    if (!assetStatuses.includes(a.lifecycleStatus) || !["UNKNOWN", "DECLARED", "VERIFIED"].includes(a.licenseStatus))
        soundFail("invalid lifecycle/license");
    object(a.technicalMetadata, ["codec", "sampleRate", "channels", "duration", "sizeBytes"]);
    const t = a.technicalMetadata;
    str(t.codec);
    number(t.sampleRate, 1, 384000);
    number(t.channels, 1, 8);
    number(t.duration, Number.EPSILON, 120);
    number(t.sizeBytes, 1, 100 * 1024 * 1024);
    if (![t.sampleRate, t.channels, t.sizeBytes].every(Number.isInteger))
        soundFail("invalid technical integer");
    object(a.semanticMetadata, ["description", "evidence"]);
    str(a.semanticMetadata.description);
    str(a.semanticMetadata.evidence);
    canonicalJson(a);
}
export class MediaAssetRegistry<T extends MediaAsset | VisualMediaAsset = MediaAsset> {
    private readonly data: {version:1;assets:T[]};
    constructor(input: unknown) { const x: any = input; object(x, ["version", "assets"]); if (x.version !== 1 || !Array.isArray(x.assets))
        soundFail("catalog version/assets"); const ids = new Set(); for (const a of x.assets) {
        if(a?.type==="AUDIO")mediaAssetShape(a);else visualAssetShape(a);
        if (ids.has(a.id))
            soundFail("duplicate asset ID");
        ids.add(a.id);
    } for(const [type,limit] of [["DUST",4],["LIGHT_LEAK",4],["OVERLAY",6],["GRAPHIC_ELEMENT",12]] as const)if(x.assets.filter((a:any)=>a.type===type).length>limit)soundFail("visual registry pilot limit exceeded");this.data = JSON.parse(canonicalJson(x)); }
    get catalog(): {version:1;assets:T[]} { return JSON.parse(canonicalJson(this.data)); }
    get(id: string): T { const a = this.data.assets.find(a => a.id === id); if (!a)
        return soundFail(`missing asset ${id}`); return JSON.parse(canonicalJson(a)); }
}
export function approvalShape(a: any): asserts a is SfxApproval {
    object(a, ["id", "assetId", "role", "context", "status", "reviewer", "reason", "sourceHash", "evidence"]);
    for (const k of ["id", "assetId", "context", "reason", "evidence"])
        str(a[k]);
    if (!["APPROVED", "REJECTED"].includes(a.status) || !sfxRoles.includes(a.role))
        soundFail("approval role/status");
    object(a.reviewer, ["type", "id"]);
    if (a.reviewer.type !== "HUMAN")
        soundFail("explicit HUMAN reviewer required");
    str(a.reviewer.id);
    hash(a.sourceHash);
    canonicalJson(a);
}
export function validateApprovals(records: unknown, registry: MediaAssetRegistry): asserts records is SfxApproval[] {
    if (!Array.isArray(records))
        soundFail("approval list required");
    const ids = new Set(), contexts = new Set();
    for (const a of records as unknown[]) {
        approvalShape(a);
        if (ids.has(a.id))
            soundFail("duplicate approval ID");
        ids.add(a.id);
        const key = `${a.assetId}/${a.role}/${a.context}`;
        if (contexts.has(key))
            soundFail("ambiguous review records; replace/revoke explicitly");
        contexts.add(key);
        const asset = registry.get(a.assetId);
        if (a.sourceHash !== asset.contentHash || !asset.roleTags.includes(a.role))
            soundFail("approval hash/role mismatch");
    }
}
export async function resolveMediaPath(root: string | undefined, relative: string): Promise<string> {
    relativeAssetPath(relative);
    if (!root?.trim())
        return fail("MEDIA_ROOT_MISSING", "configure CLONAI_MEDIA_ROOT");
    let base: string;
    try {
        base = await realpath(root);
    }
    catch {
        return fail("MEDIA_ROOT_MISSING", "configured root absent");
    }
    if (!(await stat(base)).isDirectory())
        return fail("MEDIA_ROOT_MISSING", "root must be directory");
    const candidate = path.resolve(base, ...relative.split("/"));
    const contains = (file: string) => { const rel = path.relative(base, file); return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel); };
    if (!contains(candidate))
        return fail("MEDIA_PATH_ESCAPE", "lexical containment");
    let resolved: string;
    try {
        resolved = await realpath(candidate);
    }
    catch {
        return fail("MEDIA_ASSET_MISSING", "asset absent");
    }
    if (!contains(resolved))
        return fail("MEDIA_PATH_ESCAPE", "symlink/junction containment");
    if (!(await stat(resolved)).isFile())
        return fail("MEDIA_ASSET_MISSING", "not a file");
    return resolved;
}
export const contentHash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function verifyMedia(root: string | undefined, asset: MediaAsset | VisualMediaAsset) { const file = await resolveMediaPath(root, asset.relativePath); if ((await stat(file)).size !== asset.technicalMetadata.sizeBytes)
    fail("MEDIA_HASH_MISMATCH", asset.id); const bytes = await readFile(file); if (bytes.length !== asset.technicalMetadata.sizeBytes || contentHash(bytes) !== asset.contentHash)
    fail("MEDIA_HASH_MISMATCH", asset.id); return { file, hash: asset.contentHash }; }
