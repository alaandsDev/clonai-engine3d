/** Phase 29 Script Mode. A user-provided script is the editorial source: explicit statements may
 * drive factual visuals (SCRIPT_ASSERTED) with script-span provenance instead of web Evidence.
 * The system never adds technical facts; staging (camera, world, presenter, colours) is
 * VISUAL/EDITORIAL inference and is tagged as such. Pure data; no I/O, network or clock. */
export const SCRIPT_MODE_VERSION='script-mode/1.0.0';
export const SCRIPT_SOURCE_TYPE='USER_SCRIPT' as const;
export interface ScriptSpan {start:number;end:number;text:string}
export interface ScriptSource {sourceType:typeof SCRIPT_SOURCE_TYPE;version:string;originalFingerprint:string;normalized:string;fingerprint:string;normalizations:string[];words:number}
export type SegmentRole='QUESTION'|'HYPOTHESIS'|'ASSERTION'|'EDITORIAL';
export type DiscourseRole='GOAL'|'ATTEMPT'|'PROBLEM'|'CAUSE'|'SOLUTION'|'STATE_CHANGE'|'CONSEQUENCE'|'RESULT'|'HOOK'|'TRANSITION'|'EXPLANATION';
export interface ScriptSegment {id:string;order:number;span:ScriptSpan;role:SegmentRole;discourse:DiscourseRole[];claimIds:string[]}
/** Claim status: only SCRIPT_ASSERTED may drive factual visuals. */
export type ClaimStatus='SCRIPT_ASSERTED'|'QUESTION'|'HYPOTHETICAL'|'NEGATED'|'UNSUPPORTED_EXTENSION';
export type Modality='ASSERTED'|'CONDITIONAL'|'NEGATED';
export interface ClaimArgument {role:'OBJECT'|'SOURCE'|'PATH'|'DESTINATION'|'STATE';span:ScriptSpan}
export interface ScriptClaim {
 id:string;segmentId:string;status:ClaimStatus;modality:Modality;predicate:string;
 subject:ScriptSpan;trigger:ScriptSpan;args:ClaimArgument[];
 /** Subject came from the previous clause (ellipsis) or the antecedent of a relative pronoun. */
 subjectResolution:'EXPLICIT'|'ELLIPSIS'|'RELATIVE_ANTECEDENT'|'PRONOUN_ANTECEDENT'|'INVERTED';
 /** The noun phrase a pronoun subject stands for (previous asserted clause); the subject span keeps the pronoun. */
 antecedent?:ScriptSpan;
 extractor:'MECHANISM_PARSER'|'SCRIPT_CLAUSE';discourse:DiscourseRole[];
}
export type EntityRole='VEHICLE'|'LIFT_SURFACE'|'PROPULSOR'|'FORCE'|'HEAT_SOURCE'|'SYSTEM'|'COMPONENT'|'ROTATING'|'VANES'|'GATE'|'CONDUIT'|'CONTAINER'|'FLUID'|'ACTOR'|'MATERIAL'|'ABSTRACT'|'BODY';
export type Level='HIGH'|'LOW'|null;
export type Stage='UPSTREAM'|'DOWNSTREAM'|null;
/** medium: what a vehicle moves through; direction: lexical direction of a named force. */
export interface ScriptEntity {id:string;role:EntityRole;heads:string[];label:string;level:Level;stage:Stage;
 /** What kind of thing the noun names; only visualizable categories reach the world layout. */
 category?:import('./mechanism').EntityCategory;medium?:'AIR'|'SPACE'|'WATER'|'GROUND';direction?:'UP'|'DOWN'|'FORWARD'|'BACKWARD'|null;mentions:{claimId:string;slot:string;span:ScriptSpan}[];claimIds:string[]}
/** Visual operation derived from what the script states (what happens), before filming. */
export type VisualAction='FLOW'|'ARRIVE'|'DEPART'|'SPIN'|'TRANSFER'|'OPEN'|'CLOSE'|'SET_STATE'|'MOVE'|'MOVE_VERTICAL'|'LEVEL'|'ACTIVATE'|'DEACTIVATE'|'BOIL'|'PUFF'|'SHOW_FORCE'|'THRUST'|'STREAM'|'DEFLECT'|'BALANCE'|'TRAVEL'|'IDENTIFY'|'HIGHLIGHT_CAUSE'|'NAME_ONLY';
export interface ClaimAction {claimId:string;action:VisualAction;entityIds:string[];state:string|null;cue:string|null}
export interface ScriptUnderstanding {
 version:string;source:ScriptSource;segments:ScriptSegment[];claims:ScriptClaim[];entities:ScriptEntity[];actions:ClaimAction[];
 mainSubjectId:string|null;refusedExtensions:{claimId:string;reason:string}[];
 /** Mechanism semantics (transfers, state/property changes, actions, controls) read alongside the clause claims. */
 mechanism?:import('./mechanism').MechRelation[];fingerprint:string;
}
