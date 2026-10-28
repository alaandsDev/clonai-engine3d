import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
test("generic entry import graph has no dependency on examples or cold-opening", async () => {
  const seen = new Set<string>();
  async function visit(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    assert(!file.replaceAll("\\", "/").includes("/examples/"));
    const source = await readFile(file, "utf8");
    assert(!/cold-opening/i.test(source));
    if (file.endsWith(".json")) return;
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const id = node.moduleSpecifier.text;
        if (!id.startsWith(".")) continue;
        const base = path.resolve(path.dirname(file), id);
        let found = false;
        for (const candidate of [
          base,
          base + ".ts",
          base + ".tsx",
          base + ".json",
          path.join(base, "index.ts"),
        ]) {
          try {
            if ((await stat(candidate)).isFile()) {
              await visit(candidate);
              found = true;
              break;
            }
          } catch (e: any) {
            if (e.code !== "ENOENT") throw e;
          }
        }
        assert(found, `unresolved ${id}`);
      }
    }
  }
  await visit(path.resolve("src/index.tsx"));
  assert(seen.size > 5);
});
