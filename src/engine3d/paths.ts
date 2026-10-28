import path from "node:path";
import { lstatSync, realpathSync } from "node:fs";
import { fail } from "./contracts";
/** Logical identifiers never become filesystem paths without this boundary. */
export function safeArtifactName(id: string): string {
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id) ||
    /[. ]$/.test(id) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(id)
  )
    fail("UNSAFE_OUTPUT_PATH", "invalid artifact identifier");
  return id;
}
function canonical(candidate: string): string {
  try {
    lstatSync(candidate);
    try {
      return realpathSync(candidate);
    } catch {
      return fail("UNSAFE_OUTPUT_PATH", "unresolvable filesystem link");
    }
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
    const parent = path.dirname(candidate);
    return parent === candidate
      ? candidate
      : path.join(canonical(parent), path.basename(candidate));
  }
}
export function resolveSafeOutputPath(
  root: string,
  id: string,
  suffix = "",
): string {
  if (typeof root !== "string" || !root.trim())
    fail("UNSAFE_OUTPUT_PATH", "output root required");
  const name = safeArtifactName(id);
  if (
    typeof suffix !== "string" ||
    !/^[-A-Za-z0-9_.]*$/.test(suffix) ||
    suffix.includes("..")
  )
    fail("UNSAFE_OUTPUT_PATH", "invalid suffix");
  const base = path.resolve(root),
    destination = path.resolve(base, safeArtifactName(name + suffix));
  for (const [a, b] of [
    [base, destination],
    [canonical(base), canonical(destination)],
  ]) {
    const relative = path.relative(a, b);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    )
      fail("UNSAFE_OUTPUT_PATH", "destination outside output root");
  }
  return destination;
}
