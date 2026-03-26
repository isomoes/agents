import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(modulePath: string) {
  return readFileSync(resolve(process.cwd(), modulePath), "utf8");
}

const serverOnlyModules = [
  "lib/agents/runtime.ts",
  "lib/agents/subagents/general-purpose.ts",
  "lib/agents/functions/registry.ts",
  "lib/agents/tools/run-function.ts",
  "lib/env.ts",
];

const guardedLocalImports: Record<string, string[]> = {
  "lib/agents/runtime.ts": [
    "lib/env.ts",
    "lib/agents/tools/run-function.ts",
  ],
  "lib/agents/subagents/general-purpose.ts": ["lib/agents/tools/run-function.ts"],
};

describe("server-only boundaries", () => {
  it.each(serverOnlyModules)("marks %s as server-only", (modulePath) => {
    const source = readSource(modulePath);

    expect(source).toContain('import "server-only";');
  });

  it.each(serverOnlyModules)(
    "keeps the server-only marker at the top of %s",
    (modulePath) => {
      const source = readSource(modulePath);

      expect(source.trimStart().startsWith('import "server-only";')).toBe(true);
    },
  );

  it.each(Object.entries(guardedLocalImports))(
    "%s only depends on guarded local modules",
    (modulePath, importedPaths) => {
      const source = readSource(modulePath);

      for (const importedPath of importedPaths) {
        expect(source).toContain(`from "@/${importedPath.replace(/\.ts$/, "")}"`);
        expect(readSource(importedPath)).toContain('import "server-only";');
      }
    },
  );
});
