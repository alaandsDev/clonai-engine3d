# Script Mode — narration and direction defaults

The existing command automatically runs TTS → conservative boundary trim →
controlled pauses → measured narration windows → visual planning → final mix.
No script words or internal pauses are removed. Original TTS files remain cached;
trimmed floating-point WAVs have separate content-based cache keys.

`src/engine3d/audio/pacing.ts` owns the calibrated policy: -45 dBFS in 10 ms RMS
windows, 90 ms guards, four explicit pause kinds and a slightly calmer -3% TTS
rate. Desired acoustic gaps include the retained edge guards and frame rounding;
the director inserts only the remaining pause. These values are reusable defaults,
not language rules or topic-specific code. Silent clips fail before rendering.

All visual timing is rebuilt from these measured clips. Sentence windows remain
independent from beats and shots. Continuous action may span multiple sentences
in one shot, with bounded push/reframe/follow camera moves.

Assemblies can declare parentId: animated positions, rotations and scales are local
to that parent, and consumers receive parent × local world transforms. Children
do not need duplicate world-space tracking steps. Small controls derive shape
variation from their existing action role; gas emitters use the already asserted
exit participant. Camera framing reserves space for captions around tall effects.
