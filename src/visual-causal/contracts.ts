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
export type WorldTemplate='TERRAIN_SUBSURFACE'|'ENCLOSURE'|'OPEN_STAGE';
export type EntityRole='CUTAWAY_LAYER'|'MEDIUM'|'MAIN_SYSTEM'|'SYSTEM_COMPONENT'|'CONDUIT'|'CONTEXT_PROP';
/** Abstraction tags are for QA/provenance; they are never shown as disclaimers. */
export type Abstraction='ABSTRACT_SYSTEM_REPRESENTATION'|'EDITORIAL_DECORATION'|'EDITORIAL_CONTEXT_FROM_SENTENCE';
export interface WorldEntity {
 entityId:string;worldId:string;role:EntityRole;grounding:'FACTUAL'|'EDITORIAL';abstraction:Abstraction;
 kind:'LAYER'|'BOX'|'CYLINDER'|'PATH';layer?:'surface'|'subsurface'|'deep';relationIds:string[];participant:string|null;label:string|null;
 size:Vec3;position:Vec3;rotation:Vec3;path?:Vec3[];color:string;initiallyVisible:boolean;
 /** Generic stylized assembly used to draw the entity (editorial geometry; never a fact). */
 assembly?:Assembly;
}
export interface PersistentWorld {
 worldId:string;template:WorldTemplate;environmentId:string;
 presenter:{entityId:string;resourceId:string;home:Vec3;facing:number;scale:number};
 cutaway:{kind:'GROUND_TRENCH'|'HOUSING_SECTION'|'NONE';openAmount:number;revealsEntityIds:string[]};
 cameraZones:Record<CameraZone,CameraState>;entities:WorldEntity[];
}
export interface VisualStateTransition {
 id:string;beatId:string;entityId:string;operation:Operation;parameter:string|null;from:number|boolean;to:number|boolean;
 grounding:'GROUNDED'|'EDITORIAL';evidenceRelationId:string|null;editorialReason:string|null;stateVersion:number;
}
export interface BeatOperation {operation:Operation;target:string;parameters:Record<string,unknown>;startOffset:number;endOffset:number}
export interface CausalVisualBeat {
 id:string;order:number;sentenceId:string|null;storyNodeIds:string[];relationIds:string[];evidenceIds:string[];
 grounding:BeatGrounding;visualIntent:string;presenterIntent:PresenterIntent;presenterVisible:boolean;
 cameraZone:CameraZone;cameraMotivation:string;focusEntityId:string|null;label:string|null;
 operations:BeatOperation[];transitionIds:string[];
 proof:{level:ProofLevel;rationale:string}|null;startFrame:number;endFrame:number;timing:'SENTENCE_BOUNDARY'|'ESTIMATED_WITHIN_SENTENCE';
}
export interface VisualGap {relationId:string;predicate:string;reason:string}
export interface PlannerRelation {id:string;subject:string;predicate:string;object:string;visualHints:string[];evidenceIds:string[];storyNodeIds:string[];sentenceIds:string[]}
export interface PlannerSentence {id:string;kind:'FACT'|'EDITORIAL';text:string;relationIds:string[];roles:string[]}
export interface PlannerInput {
 topic:string;script:string;scriptFingerprint:string;storyFingerprint:string;sentences:PlannerSentence[];relations:PlannerRelation[];
 timing:{sentenceId:string;startFrame:number;endFrame:number}[];fps:number;totalFrames:number;
 /** Operator override (harness/test only): environment preset. Never topic logic. */
 environmentId?:string;
}
export interface VisualCausalPlan {
 version:string;topic:string;worldId:string;scriptFingerprint:string;storyFingerprint:string;relationsFingerprint:string;
 world:PersistentWorld;beats:CausalVisualBeat[];transitions:VisualStateTransition[];gaps:VisualGap[];fps:number;totalFrames:number;fingerprint:string;
}
