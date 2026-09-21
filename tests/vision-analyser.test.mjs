import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadVisionAnalyserModule() {
  return loadTsModule("../lib/vision-analyser.ts");
}

function loadDemoClaimsModule() {
  return loadTsModule("../lib/demo-claims.ts");
}

function loadTsModule(modulePath) {
  const source = readFileSync(new URL(modulePath, import.meta.url), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const script = new Script(`(function (exports, require, module) { ${transpiled}\n})`);
  const localRequire = (id) => {
    if (id === "@/lib/demo-claims") {
      return loadDemoClaimsModule();
    }

    return require(id);
  };
  script.runInThisContext()(compiledModule.exports, localRequire, compiledModule);
  return compiledModule.exports;
}

test("maps Custom Vision predictions to a severity-only app vision result", () => {
  const { mapCustomVisionResponse } = loadVisionAnalyserModule();

  const result = mapCustomVisionResponse({
    predictions: [
      { tagName: "minor", probability: 0.16114981 },
      { tagName: "moderate", probability: 0.48526499 },
      { tagName: "severe", probability: 0.28952178 },
    ],
  });

  assert.deepEqual(result, {
    severity: "Modérée",
    confidence: 48.5,
  });
});

test("rejects analyser responses without predictions", () => {
  const { mapCustomVisionResponse } = loadVisionAnalyserModule();

  assert.throws(
    () => mapCustomVisionResponse({ predictions: [] }),
    /No predictions returned by the vision analyser/,
  );
});

test("resolves dossier metadata with dataset-backed image paths", () => {
  const { demoClaims, getDemoClaimById } = loadDemoClaimsModule();

  assert.equal(demoClaims.length, 4);
  assert.equal(getDemoClaimById("SIN-2026-0847").datasetPath, "data/raw/data3a/validation/02-moderate/0001.JPEG");
  assert.equal(getDemoClaimById("SIN-2026-0847").record.incidentCity, "Detroit");
  assert.equal(getDemoClaimById("SIN-2026-0835").expectedSeverity, "Modérée");
  assert.throws(
    () => getDemoClaimById("SIN-2026-0000"),
    /Unknown demo claim/,
  );
});
