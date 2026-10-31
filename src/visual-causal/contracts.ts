import type {Assembly} from '../engine3d/demonstration-contracts';
import type {Vec3} from '../engine3d/contracts';
import type {CameraState} from '../engine3d/directed';
import type {Operation,ProofLevel} from '../engine3d/demonstration-contracts';
/** Phase 27 visual-causal planning. A plan places the grounded relations of a
 * Phase26 causal-curiosity script inside one persistent 3D world and schedules
 * them as beats. It compiles to the existing DirectedSequence/VisualDemonstration
 * contracts (no parallel renderer). Editorial staging (world, props, camera,
 * presenter) never becomes evidence; only FACTUAL_DEMONSTRATION beats may claim
 * visual proof, and only for relations present in the input. */
export const VISUAL_CAUSAL_VERSION='visual-causal-plan/1.0.0';
export type CameraZone='WORLD'|'SYSTEM'|'CUTAWAY'|'COMPONENT'|'ACTION'|'RESULT';
export const CAMERA_ZONES:CameraZone[]=['WORLD','SYSTEM','CUTAWAY','COMPONENT','ACTION','RESULT'];
export type BeatGrounding='FACTUAL_DEMONSTRATION'|'EDITORIAL_CONTEXT'|'EDITORIAL_TRANSITION'|'PRESENTER_ACTION'|'ATMOSPHERE';
export type PresenterIntent='NONE'|'ESTABLISH_CONTEXT'|'OBSERVE_SYSTEM'|'POINT_TO_SYSTEM'|'POINT_TO_COMPONENT'|'REACT_TO_EVENT'|'WALK_TO_TARGET'|'REVEAL_SYSTEM'|'COMPARE_SCALE'|'FOLLOW_ACTION'|'FINAL_PAYOFF';
export type WorldTemplate='TERRAIN_SUBSURFACE'|'ENCLOSURE'|'OPEN_STAGE'|'MECHANISM_STAGE'|'MOTION_STAGE';
export type EntityRole='CUTAWAY_LAYER'|'MEDIUM'|'MAIN_SYSTEM'|'SYSTEM_COMPONENT'|'CONDUIT'|'CONTEXT_PROP';
/** Abstraction tags are for QA/provenance; they are never shown as disclaimers. */
export type Abstraction='ABSTRACT_SYSTEM_REPRESENTATION'|'EDITORIAL_DECORATION'|'EDITORIAL_CONTEXT_FROM_SENTENCE';
export interface WorldEntity {
 entityId:string;worldId:string;role:EntityRole;grounding:'FACTUAL'|'EDITORIAL';abstraction:Abstraction;
 kind:'LAYER'|'BOX'|'CYLINDER'|'PATH';layer?:'surface'|'subsurface'|'deep';relationIds:string[];participant:string|null;label:string|null;
 size:Vec3;position:Vec3;rotation:Vec3;path?:Vec3[];color:string;initiallyVisible:boolean;
 /** Generic stylized assembly used to draw the entity (editorial geometry; never a fact). */
 assembly?:Assembly;
 /** Assembly attachment: position/rotation/scale are local to this parent. */
 parentId?:string;variant?:'STEM'|'CONTROL'|'PHASE'|'THERMAL'|'KITCHEN_LIKE'|'BATHROOM_LIKE'|'BUILDING_SHAFT'|'WORKSHOP'|'DOOR_FRONT'|import('./functional-form').FormVariant|'PERFORATED'|'PUMP_LIKE'|'NEUTRAL_INTERIOR';
 /** Phase29 readability: functional silhouette selected from the part's stated role in the mechanism (never from its name). */
 form?:import('./functional-form').FunctionalForm;
 /** Phase29: initial numeric parameters (e.g. a source container already holding liquid) and the script relation that sets the initial pose. */
 initial?:Record<string,number>;initialStateFrom?:string;
 /** Phase29 Script Mode: script entities represented by this world entity (aliases share one visual). */
 scriptEntityIds?:string[];
}
export interface PersistentWorld {
 worldId:string;template:WorldTemplate;environmentId:string;
 /** offstage: the scene has no place for the presenter (e.g. mid-air); the character is not placed at all. */
 presenter:{entityId:string;resourceId:string;home:Vec3;facing:number;scale:number;offstage?:true};
 cutaway:{kind:'GROUND_TRENCH'|'HOUSING_SECTION'|'NONE';openAmount:number;revealsEntityIds:string[]};
 cameraZones:Record<CameraZone,CameraState>;entities:WorldEntity[];
 /** Phase29 world complexity management: why each script entity has (or has no) visual slot. */
 visualScope?:VisualScopeEntry[];maxSimultaneousVisible?:number;
}
/** PERSISTENT_WORLD: visible for most of the video. BEAT_LOCAL: revealed/hidden around its own beats.
 * CONTEXT_ONLY: represented by another entity's assembly. NON_VISUAL: concept/state/attribute, no object.
 * BUDGET_GAP: would exceed the simultaneous visual budget (recorded as a visual gap). */
export type VisualScope='PERSISTENT_WORLD'|'BEAT_LOCAL'|'CONTEXT_ONLY'|'NON_VISUAL'|'BUDGET_GAP';
export interface VisualScopeEntry {scriptEntityId:string;label:string;role:string;scope:VisualScope;worldEntityId:string|null;segments:string[];reason:string}
export interface VisualStateTransition {
 id:string;beatId:string;entityId:string;operation:Operation;parameter:string|null;from:number|boolean;to:number|boolean;
 grounding:'GROUNDED'|'EDITORIAL';evidenceRelationId:string|null;editorialReason:string|null;stateVersion:number;
}
/** sustain: the step runs until the end of the video (a process that keeps going, e.g. rotation).
 * observed: no new step; the beat shows a sustained motion or the initial state already in the world (basis). */
export interface BeatOperation {operation:Operation;target:string;parameters:Record<string,unknown>;startOffset:number;endOffset:number;sustain?:true;observed?:'SUSTAINED_STEP'|'INITIAL_STATE'}
export interface CausalVisualBeat {
 id:string;order:number;sentenceId:string|null;storyNodeIds:string[];relationIds:string[];evidenceIds:string[];
 grounding:BeatGrounding;visualIntent:string;presenterIntent:PresenterIntent;presenterVisible:boolean;
 cameraZone:CameraZone;cameraMotivation:string;focusEntityId:string|null;label:string|null;
 operations:BeatOperation[];transitionIds:string[];
 proof:{level:ProofLevel;rationale:string}|null;startFrame:number;endFrame:number;timing:'SENTENCE_BOUNDARY'|'ESTIMATED_WITHIN_SENTENCE';
 /** Phase29: alternate viewing angle (±1) when the same focus is filmed again; staging only. */
 cameraVariant?:number;
 /** Phase29 demonstration-first direction: the demonstration this step belongs to and its micro-stage. */
 demonstrationId?:string;stage?:import('./demonstrations').MicroStage;
 /** Phase29 causal camera: what must be in frame together (source, route, destination, parent housing) and from where; and the
  * frame where the narration says this beat's predicate (semantic sync anchor). */
 framing?:{points:[number,number,number][];dir:[number,number,number];keyCount?:number;need?:number;keys?:[number,number,number][];
  /** Phase29 readability: first appearance opens on the object then pushes to this region (OBJECT → REGION → COMPONENT). */
  reveal?:[number,number,number][];
  /** Phase29 readability: the camera follows a route from its source framing to its destination framing (orientation kept). */
  track?:{from:[number,number,number][];to:[number,number,number][];fromDir?:[number,number,number];toDir?:[number,number,number]}};anchorFrame?:number;
 shotType?:'ESTABLISHING'|'SYSTEM'|'MEDIUM'|'COMPONENT_CLOSEUP'|'ACTION_CLOSEUP'|'CUTAWAY'|'FOLLOW_ACTION'|'RESULT'|'PAYOFF';
}
export interface VisualGap {relationId:string;predicate:string;reason:string}
export interface PlannerRelation {id:string;subject:string;predicate:string;object:string;visualHints:string[];evidenceIds:string[];storyNodeIds:string[];sentenceIds:string[];
 /** Phase29: USER_SCRIPT relations are backed by script spans instead of Evidence (never fake Evidence). */
 source?:'USER_SCRIPT';scriptSpans?:{start:number;end:number}[]}
export interface PlannerSentence {id:string;kind:'FACT'|'EDITORIAL';text:string;relationIds:string[];roles:string[]}
export interface PlannerInput {
 /** Opt-in for legacy callers; enabled by the certified Script Mode production path. */
 hybridEditorial?:import('../editorial/hybrid-contracts').HybridEditorialOptions;
 /** A grounded candidate may be inspected without authorizing production. */
 previewOnly?:true;
 groundedStory?:ReturnType<typeof import('../curiosity/progression').groundedProgression>;
 topic:string;script:string;scriptFingerprint:string;storyFingerprint:string;sentences:PlannerSentence[];relations:PlannerRelation[];
 timing:{sentenceId:string;startFrame:number;endFrame:number}[];fps:number;totalFrames:number;
 /** Operator override (harness/test only): environment preset. Never topic logic. */
 environmentId?:string;
 /** Phase29 Script Mode: the understood user script (source type USER_SCRIPT). */
 scriptUnderstanding?:import('../script-mode/contracts').ScriptUnderstanding;
}
export interface VisualCausalPlan {
 hybridEditorial?:import('../editorial/hybrid-contracts').HybridEditorialTrack;
 /** Phase29: demonstrations selected for the script ideas, and direction stats (subject versions, stage switches). */
 demonstrations?:import('./demonstrations').VisualDemonstrationIntent[];
 /** Phase29 bridge: mechanism relations → carriers (what is shown, where, with which support) and recorded gaps. */
 mechanismExecution?:{carriers:import('./mechanism-bridge').MechanismCarrier[];gaps:import('./mechanism-bridge').MechanismGap[];coveredByClaims:string[]};
 /** Phase29 execution layer: spatial layout derived from stated relations (enclosure, inside/behind, circuit, machines, state tints). */
 context?:{category:string|null;context:string;reason:string};
 /** Phase29 camera space: navigable volume and structural blockers (walls, floor, furniture, large objects). */
 cameraSpace?:import('./camera-space').CameraSpace;
 /** Phase29 readability: functional silhouette chosen for each part, with the relation that supports it. */
 functionalForms?:import('./functional-form').FormChoice[];
 /** Phase29 containment class: semantic roles (from relations) and the visual features composed from them. */
 physical?:{system:string|null;roles:Record<string,string[]>;reason:string;features:string[];pairs:{container:string;content:string;relationId:string;kind:string}[];rotating:{entityId:string;relationId:string;content:string|null;behaviorStated:boolean}[]};
 /** Phase29 demonstration QA: participants of each admitted mechanism relation and which ones are drawn. */
 mechanismParticipants?:{relationId:string;participants:string[];drawn:string[]}[];
 /** Phase29 spatial mechanism map: every part in the main object's own frame (region, anchor, routes). Persistent for the whole video. */
 spatialMap?:{object:string;features:string[];parts:{entityId:string;label:string|null;region:'INSIDE'|'BEHIND'|'REAR_LOW'|'OUTSIDE';anchor:[number,number,number];connected:string[];routeIn:string[];routeOut:string[];initiallyVisible:boolean}[]};
 layout?:{enclosure:string|null;placed?:{child:string;relation:string;parent:string}[];inside:string[];behind:string[];circuit:string|null;machines:string[];tints:string[];relations:import('./demonstration-execution').SpatialFact[];derivedInitialStates:{entityId:string;parameter:string;value:number;reason:string}[]};direction?:{subjectVersions:number;stageSwitches:number};
 previewOnly?:true;
 groundedStoryHandoff?:{progressionFingerprint:string;beats:{beatId:string;roles:string[];stateDescriptionIds:string[];problemSolutionRelationIds:string[]}[]};
 version:string;topic:string;worldId:string;scriptFingerprint:string;storyFingerprint:string;relationsFingerprint:string;
 world:PersistentWorld;beats:CausalVisualBeat[];transitions:VisualStateTransition[];gaps:VisualGap[];fps:number;totalFrames:number;fingerprint:string;
}
