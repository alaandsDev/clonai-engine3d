import { relativeAssetPath, assetRefShape } from "./schema";
import type { AssetCandidate } from "./contracts";
import { fail } from "../engine3d/contracts";
/** Small shortlist adapter: no pack reads and no approval promotion. */
export function selectSfxCandidates(recommended: any, sfxAssets: any): (AssetCandidate & {
    roles: string[];
    selectionReason: string;
})[] {
    if (!recommended?.topSfx || !Array.isArray(sfxAssets))
        fail("EDITORIAL_CATALOG", "invalid audit catalogs");
    const selected = new Map<string, AssetCandidate & {
        roles: string[];
        selectionReason: string;
    }>();
    for (const role of ["WHOOSH", "IMPACT", "RISER", "TRANSITION", "UI"]) {
        const candidates = recommended.topSfx[role]?.candidates ?? [];
        if (!Array.isArray(candidates))
            fail("EDITORIAL_CATALOG", "invalid shortlist");
        for (const c of candidates.slice(0, 2)) {
            const source = sfxAssets.find((a: any) => a.id === c.id && a.relativePath === c.relativePath && a.category === "SFX");
            if (!source)
                fail("EDITORIAL_CATALOG", "shortlist item absent from SFX audit");
            relativeAssetPath(c.relativePath);
            const existing = selected.get(c.id);
            if (existing) {
                if (!existing.roles.includes(role))
                    existing.roles.push(role);
                continue;
            }
            if (selected.size >= 12)
                continue;
            const assetRef = { sourceCatalog: "pack-audit-v1", auditId: c.id, relativePath: c.relativePath, category: "SFX" as const, status: "CURATED" as const, provenance: "Phase 7 shortlist; semantic metadata rule only, no auditory approval", licenseStatus: "DECLARED" as const };
            assetRefShape(assetRef);
            selected.set(c.id, { assetRef, roles: [role], selectionReason: "Existing Phase 7 shortlist, first two per requested role; deduplicated by audit ID. No listening or creative approval." });
        }
    }
    return [...selected.values()];
}
