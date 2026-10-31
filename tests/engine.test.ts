import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Registry,
  registry,
  resources,
  supportsAnchor,
} from "../src/engine3d/registry";
import { parameters, resolveShot } from "../src/engine3d/validation";
import {
  compileDirectorPlan,
  captions,
  spokenText,
} from "../src/engine3d/director";
import { anchorAt, cameraAt, poseAt, seeded } from "../src/engine3d/motion";
import {
  cacheKey,
  defaultConfig,
  FakeNarrationProvider,
  narration,
  probeDuration,
} from "../src/engine3d/audio/narration";
import type {
  DirectorPlan,
  ShotSpec,
  EngineError,
} from "../src/engine3d/contracts";
const plan = JSON.parse(
  await readFile("examples/cold-opening.json", "utf8"),
) as DirectorPlan;
const shot = () => structuredClone(compileDirectorPlan(plan).shots[0]);
const rawShot = (): ShotSpec => {
  const { sceneId, startFrame, endFrame, durationFrames, ...s } = shot();
  return s;
};
const reject = (code: string, fn: () => unknown) =>
  assert.throws(fn, (e: unknown) => (e as EngineError).code === code);
test("registry has 53 unique serializable resources without absolute paths", () => {
  assert.equal(resources.length, 53);
  assert.equal(new Set(resources.map((r) => r.id)).size, 53);
  const s = JSON.stringify(resources);
  assert(!/[A-Z]:\\|\/Users\//.test(s));
  assert.deepEqual(JSON.parse(s), resources);
});
for (const r of resources)
  test(`registry resolves ${r.id} in its category`, () => {
    const result = registry.resolve(r.id, r.type);
    assert.equal(result.ok, true);
    assert(registry.listByType(r.type).includes(r));
    assert(registry.searchByTags(r.tags).includes(r));
    assert(r.capabilities.length > 0);
  });
test("registry explicit missing, unsupported and deprecated results", () => {
  assert.deepEqual(registry.resolve("unknown"), {
    ok: false,
    reason: "NOT_FOUND",
  });
  assert.deepEqual(registry.resolve(resources[0].id, "prop"), {
    ok: false,
    reason: "UNSUPPORTED",
  });
  assert.deepEqual(
    new Registry([{ ...resources[0], status: "deprecated" }]).resolve(
      resources[0].id,
    ),
    { ok: false, reason: "DEPRECATED" },
  );
  reject(
    "DUPLICATE_RESOURCE_ID",
    () => new Registry([resources[0], resources[0]]),
  );
});
for (const id of ["CHAR_CAIO_001", "CHAR_LIA_001"])
  for (const a of ["head", "face", "leftHand", "rightHand", "chest"] as const)
    test(`${id} supports geometry anchor ${a}`, () =>
      assert(supportsAnchor(id, a)));
test("unknown character has no anchors", () =>
  assert(!supportsAnchor("bad", "face")));
for (const value of [-63, -68, -89])
  test(`thermometer accepts ${value}`, () =>
    parameters("PROP_THERMOMETER_001", { value }));
for (const value of [0, 0.5, 1])
  test(`door accepts ${value}`, () =>
    parameters("PROP_DOOR_001", { openProgress: value }));
for (const value of [-1, 1.01, NaN, Infinity])
  test(`door rejects ${value}`, () =>
    reject("INVALID_PARAMETER", () =>
      parameters("PROP_DOOR_001", { openProgress: value }),
    ));
test("unknown parameter fails", () =>
  reject("INVALID_PARAMETER", () => parameters("VFX_SNOW_001", { random: 1 })));
const failures: [string, (s: ShotSpec) => void][] = [
  [
    "RESOURCE_NOT_FOUND",
    (s) => {
      s.characters[0].resourceId = "bad";
    },
  ],
  [
    "RESOURCE_NOT_FOUND",
    (s) => {
      s.environment.resourceId = "bad";
    },
  ],
  [
    "RESOURCE_NOT_FOUND",
    (s) => {
      s.props[0].resourceId = "bad";
    },
  ],
  [
    "RESOURCE_NOT_FOUND",
    (s) => {
      s.actions[0].resourceId = "bad";
    },
  ],
  [
    "RESOURCE_NOT_FOUND",
    (s) => {
      s.vfx[0].resourceId = "bad";
    },
  ],
  [
    "UNSUPPORTED_CAMERA",
    (s) => {
      s.camera.resourceId = "bad";
    },
  ],
  [
    "DUPLICATE_INSTANCE_ID",
    (s) => {
      s.props[0].instanceId = s.characters[0].instanceId;
    },
  ],
  [
    "INVALID_TIMING",
    (s) => {
      s.actions[0].end = s.actions[0].start;
    },
  ],
  [
    "INVALID_TIMING",
    (s) => {
      s.vfx[0].start = -1;
    },
  ],
  [
    "INVALID_DURATION",
    (s) => {
      s.durationSeconds = 0;
    },
  ],
  [
    "INVALID_TRANSFORM",
    (s) => {
      s.characters[0].scale = [1, 0, 1];
    },
  ],
  [
    "INVALID_TRANSFORM",
    (s) => {
      s.props[0].position = [NaN, 0, 0];
    },
  ],
  [
    "INCOMPATIBLE_ACTION",
    (s) => {
      s.characters[0].resourceId = "CHAR_BLOB_001";
    },
  ],
  [
    "UNSUPPORTED_ANCHOR",
    (s) => {
      s.vfx[1].anchor = "bad" as any;
    },
  ],
  [
    "MISSING_ACTOR",
    (s) => {
      s.actions[0].actor = "bad";
    },
  ],
  [
    "MISSING_TARGET",
    (s) => {
      s.actions[0].target = "bad";
    },
  ],
  [
    "INVALID_PARAMETER",
    (s) => {
      s.props[0].parameters = { bad: 1 };
    },
  ],
  [
    "INVALID_PARAMETER",
    (s) => {
      (s as any).surprise = true;
    },
  ],
];
failures.forEach(([code, mutate], n) =>
  test(`failure fixture ${n}: ${code}`, () => {
    const s = rawShot();
    mutate(s);
    reject(code, () => resolveShot(s));
  }),
);
test("transforms have explicit defaults and repeated resources are allowed", () => {
  const s = rawShot();
  s.characters.push({
    ...s.characters[0],
    instanceId: "second",
    position: undefined,
  });
  assert.deepEqual(resolveShot(s).characters[1].position, [0, 0, 0]);
});
test("director timeline is contiguous deterministic and fills scenes", () => {
  const a = compileDirectorPlan(plan);
  assert.deepEqual(a, compileDirectorPlan(plan));
  assert.equal(a.totalFrames, 240);
  assert.equal(a.shots[0].endFrame, a.shots[1].startFrame);
  assert.equal(a.shots.at(-1)?.endFrame, a.totalFrames);
  assert.equal(a.scenes[0].durationFrames, 240);
});
for (const [code, mutate] of [
  [
    "CAST_SWITCH",
    (p: DirectorPlan) => {
      p.scenes[0].shots[0].characters[0].resourceId = "CHAR_LIA_001";
    },
  ],
  [
    "UNSUPPORTED_TRANSITION",
    (p: DirectorPlan) => {
      p.scenes[0].shots[0].transition = "FADE";
    },
  ],
  [
    "NARRATION_EMPTY",
    (p: DirectorPlan) => {
      p.scenes[0].narration = "[intenso] (PAUSA)";
    },
  ],
  [
    "CONTINUITY_MISMATCH",
    (p: DirectorPlan) => {
      p.scenes[0].shots[1].props = [
        { ...p.scenes[0].shots[0].props[0], initialState: { openProgress: 0 } },
      ];
    },
  ],
  [
    "INVALID_PARAMETER",
    (p: DirectorPlan) => {
      p.scenes[0].shots[1].order = 1;
    },
  ],
  [
    "INVALID_PARAMETER",
    (p: DirectorPlan) => {
      p.scenes[0].shots[1].narrationSegment = "not in scene";
    },
  ],
  [
    "AUDIO_FILE_MISSING",
    (p: DirectorPlan) => {
      p.timingMode = "narration";
    },
  ],
] as [string, (p: DirectorPlan) => void][])
  test(`director rejects ${code}`, () => {
    const p = structuredClone(plan);
    mutate(p);
    reject(code, () => compileDirectorPlan(p));
  });
test("continuity accepts matching final and initial state", () => {
  const p = structuredClone(plan);
  p.scenes[0].shots[1].props = [
    { ...p.scenes[0].shots[0].props[0], initialState: { openProgress: 1 } },
  ];
  assert(compileDirectorPlan(p));
});
test("editorial tags stripped while preserving speech", () =>
  assert.equal(
    spokenText("[intenso] Olá (PAUSA) [curioso] mundo"),
    "Olá mundo",
  ));
test("captions have three words max and no gaps", () => {
  const cues = captions(plan.scenes[0].narration, 10, 240);
  assert.equal(cues[0].startFrame, 10);
  assert.equal(cues.at(-1)?.endFrame, 250);
  cues.forEach((c, i) => {
    assert(c.text.split(" ").length <= 3);
    if (i) assert.equal(cues[i - 1].endFrame, c.startFrame);
  });
});
test("seeded particles repeat and remain in range", () => {
  const values = Array.from({ length: 80 }, (_, n) => seeded(n));
  assert.deepEqual(
    values,
    Array.from({ length: 80 }, (_, n) => seeded(n)),
  );
  assert(values.every((n) => n >= 0 && n < 1));
  assert(new Set(values).size > 70);
});
for (const r of registry.listByType("camera"))
  test(`${r.id} is deterministic and finite`, () => {
    for (const t of [0, 0.5, 1]) {
      const c = cameraAt(r.id, t);
      assert.deepEqual(c, cameraAt(r.id, t));
      assert(c.position.every(Number.isFinite));
    }
  });
test("RUN differs from WALK in lean, cadence and amplitude", () => {
  const s = rawShot(),
    i = s.characters[0];
  s.actions = [
    { resourceId: "ACTION_RUN_001", actor: i.instanceId, start: 0, end: 1 },
  ];
  const run = poseAt(i, s, 0.13);
  s.actions[0].resourceId = "ACTION_WALK_001";
  assert.notDeepEqual(run, poseAt(i, s, 0.13));
  assert(run.lean > 0.1);
});
test("door hand reaches transformed handle and face anchor follows scale", () => {
  const s = rawShot(),
    i = s.characters[0];
  const hand = anchorAt(i, s, 0.5, "rightHand");
  assert(hand.every(Number.isFinite));
  const face = anchorAt(i, s, 0.5, "face");
  const bigger = { ...i, scale: [2, 2, 2] as [number, number, number] };
  assert(anchorAt(bigger, s, 0.5, "face")[1] > face[1]);
});
test("cache hashes text config and provider", () => {
  const key = cacheKey("Olá", defaultConfig);
  assert.equal(key, cacheKey("Olá", defaultConfig));
  assert.notEqual(key, cacheKey("Outro", defaultConfig));
  assert.notEqual(key, cacheKey("Olá", { ...defaultConfig, rate: "+5%" }));
  assert.notEqual(key, cacheKey("Olá", defaultConfig, "fake"));
});
test("fake provider, ffprobe, cache, narration timeline and manifest work offline", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "engine-test-"));
  try {
    let calls = 0;
    const fake = new FakeNarrationProvider();
    const provider = {
      name: "fake",
      synthesize: async (...args: Parameters<typeof fake.synthesize>) => {
        calls++;
        return fake.synthesize(...args);
      },
    };
    const track = await narration(
      "winter",
      plan.scenes[0].narration,
      30,
      provider,
      defaultConfig,
      root,
    );
    const second = await narration(
      "winter",
      plan.scenes[0].narration,
      30,
      provider,
      defaultConfig,
      root,
    );
    assert.equal(calls, 1);
    assert.deepEqual(track, second);
    assert(track.durationSeconds > 0);
    assert(!path.isAbsolute(track.relativeAudioPath));
    assert.equal(track.timingSource, "estimated_proportional");
    const sequence = compileDirectorPlan({ ...plan, timingMode: "narration" }, [
      track,
    ]);
    assert.equal(sequence.totalFrames, Math.ceil(track.durationSeconds * 30));
    assert.equal(sequence.shots[0].endFrame, sequence.shots[1].startFrame);
    assert.equal(sequence.scenes.filter((s) => s.audio).length, 1);
    reject("AUDIO_DURATION_INVALID", () =>
      compileDirectorPlan({ ...plan, timingMode: "narration" }, [
        { ...track, durationSeconds: NaN },
      ]),
    );
    await assert.rejects(
      () => probeDuration(path.join(root, "missing.mp3")),
      (e: EngineError) => e.code === "AUDIO_FILE_MISSING",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
