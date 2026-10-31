import {jsonHash} from '../editorial/fingerprint';
import {HYBRID_EDITORIAL_PROFILE} from '../editorial/hybrid-contracts';
/** Serializable policy; thresholds reuse calibrated/legacy QA rather than per-topic tuning. */
export const PRODUCTION_PROFILE=Object.freeze({
 id:'CLONAI_PRODUCTION_V1',version:1,policy:'FIRST_RENDER_IS_FINAL_CANDIDATE',maxReplans:0,
 editorialGrammar:HYBRID_EDITORIAL_PROFILE,
 output:{width:1080,height:1920,fps:30,videoCodec:'h264',audioCodec:'aac',sampleRate:48000,channels:2,container:'mp4'},
 sections:['STORY','WORLD','SYSTEM_IDENTITY','SPATIAL_MODEL','DEMONSTRATION','CAMERA','PACING','QUESTION_REVEAL','SYNC','PRESENTER','ENDING','AUDIO','TTS','SFX','CAPTIONS','MASTERING','TRUTH','QA','OUTPUT','HYBRID_EDITORIAL'],
 gates:{
  MAIN_SYSTEM_RECOGNIZABILITY:'BLOCKER',MECHANISM_PARTICIPANT_COVERAGE:'BLOCKER',PASS_THROUGH_READABILITY:'BLOCKER',BOUNDARY_OPENING_VISIBILITY:'BLOCKER',MATERIAL_ROUTE_CONTINUITY:'BLOCKER',SOURCE_ACTUATOR_DESTINATION_VISIBILITY:'BLOCKER',CONTEXT_COHERENCE:'BLOCKER',NARRATION_DEPENDENCY_ESTIMATE:'BLOCKER',
  CONTAINMENT_READABILITY:'BLOCKER',NESTED_CONTAINER_CONTINUITY:'BLOCKER',ROTATION_CONTENT_COHERENCE:'BLOCKER',CAUSAL_READABILITY:'WARNING'
 },
 thresholds:{syncWarningMs:500,stasisWarningSeconds:8,endingStaticWarningSeconds:2,captionWordsWarning:6},
 rationale:{syncWarningMs:'500 ms editorial tolerance; proportional timing is approximate; warning only',stasisWarningSeconds:'legacy visual QA 8 s; intentional questions may hold',endingStaticWarningSeconds:'attention heuristic; no factual claim; warning only',captionWordsWarning:'short phrase readability heuristic; not word alignment',gates:'existing Demonstration QA thresholds and applicability; no aggregate score authorizes missing required mechanism'},
 humanJudgment:['hook strength','natural narration','object recognition','silent comprehension','perceptual caption readability','postability'],
 postRender:['full decode','actual codec/geometry/fps','audio/video duration','audio clipping/LUFS/true peak','SFX masking','initial/final frames']
} as const);
export const profileFingerprint=()=>jsonHash(PRODUCTION_PROFILE);
