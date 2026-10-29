import type {FactPolicy,Arc} from '../writer/contracts';
import type {FactType} from '../research/contracts';
/** Phase 24 Topic Intelligence. Opt-in planning layer between a user topic and
 * Research/Writer. It classifies and routes; it never fetches, executes, or
 * treats topic text as evidence. */
export const TOPIC_PLAN_VERSION='topic-plan/1.0.0';
export type ContentIntent='EXPLANATION'|'PROCESS'|'RANKING'|'COMPARISON'|'HISTORICAL'|'BIOGRAPHICAL'|'SCIENTIFIC'|'TECHNICAL'|'GEOGRAPHIC'|'BIOLOGICAL'|'HYPOTHETICAL'|'NARRATIVE'|'FICTION'|'LIST'|'CAUSE_EFFECT'|'MYTH_CHECK'|'UNKNOWN';
export const CONTENT_INTENTS:ContentIntent[]=['EXPLANATION','PROCESS','RANKING','COMPARISON','HISTORICAL','BIOGRAPHICAL','SCIENTIFIC','TECHNICAL','GEOGRAPHIC','BIOLOGICAL','HYPOTHETICAL','NARRATIVE','FICTION','LIST','CAUSE_EFFECT','MYTH_CHECK','UNKNOWN'];
export type ContentMode='FACTUAL'|'FACTUAL_EXPLANATORY'|'FACTUAL_COMPARATIVE'|'FACTUAL_RANKING'|'FACTUAL_HYPOTHETICAL'|'CREATIVE'|'HYBRID'|'UNKNOWN';
export type EpistemicMode='FACTUAL'|'STRUCTURAL'|'SUPPORTED_INFERENCE'|'HYPOTHETICAL'|'CREATIVE'|'UNKNOWN';
export type ClaimRisk='LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
export type ResearchRequirementLevel='NONE'|'LIGHT'|'STANDARD'|'HEAVY'|'STRICT';
export const RESEARCH_LEVELS:ResearchRequirementLevel[]=['NONE','LIGHT','STANDARD','HEAVY','STRICT'];
export type ClaimFamily='DEFINITION'|'MECHANISM'|'CAUSAL'|'PHYSICAL_PRINCIPLE'|'BIOLOGICAL_MECHANISM'|'TECHNICAL_COMPONENT'|'STRUCTURAL_STEP'|'HISTORICAL_EVENT'|'EVENT_DATE'|'PERSON_FACT'|'LOCATION'|'QUANTITY'|'MEASUREMENT'|'RESIDENCY'|'RANKING_ORDER'|'COMPARISON_VALUE'|'MYTH_VERDICT'|'COUNTERFACTUAL_CONSEQUENCE'|'HYPOTHETICAL_PREMISE'|'FICTIONAL_EVENT'|'SETTING_FACT';
export type EvidenceRequirement='NONE'|'OPTIONAL_SOURCE'|'SOURCE_SPAN'|'GROUNDED_PREMISES'|'GROUNDED_FACT'|'CORROBORATED_FACT';
export type WriterRouteKind='GROUNDED_ONLY'|'SOURCE_ONLY'|'STRUCTURAL_ONLY'|'CREATIVE_ISOLATED'|'HYBRID_SEPARATED'|'CLARIFICATION_REQUIRED';
export interface SignalMatch {id:string;intent:ContentIntent|null;feature:string;start:number;end:number;text:string}
export interface FactualityProfile {
 epistemicModes:EpistemicMode[];requiresExternalFacts:boolean;topicIsEvidence:false;
 hypotheticalPremise:{text:string;preserved:true;asserted:false}|null;fictionalPremise:boolean;
 realWorldAnchors:string[];negated:boolean;question:boolean;
}
export interface ComparisonProfile {kind:'NONE'|'SUPERLATIVE_RANKING'|'PAIRWISE'|'LIST';rankingCount:number|null;direction:'MOST'|'LEAST'|null;dimension:string|null;scope:'SESSION_CANDIDATES'|null;globalSuperlativeGuard:boolean}
export interface TemporalProfile {kind:'TIMELESS'|'CURRENT'|'HISTORICAL'|'HYPOTHETICAL'|'FICTIONAL'|'UNSPECIFIED';currentnessRequired:boolean;explicitYears:number[]}
export interface CreativeProfile {fiction:boolean;narrativePremise:string|null;fictionalEventsAreEvidence:false;realSettingAnchors:string[]}
export interface ClaimRequirementProfile {
 claimFamily:ClaimFamily;factualRisk:ClaimRisk;epistemicMode:EpistemicMode;evidenceRequirement:EvidenceRequirement;corroborationRequirement:number;
 temporalRequirement:'NONE'|'CURRENT'|'EVENT_DATE'|'OBSERVATION_PERIOD';rankingRequirement:'NONE'|'COMPLETE_SESSION_RANKING';
 allowedWriterPolicy:(FactPolicy|'CREATIVE_ISOLATED')[];visualProofExpectation:'NONE'|'STRUCTURAL_ILLUSTRATION'|'SOURCE_BACKED'|'SYMBOLIC';
 researchFactTypes:FactType[];createsFactGap:boolean;reasonCodes:string[];
}
export interface TopicAnalysis {
 topic:string;normalizedTopic:string;language:'pt'|'en'|'mixed';primaryIntent:ContentIntent;secondaryIntents:ContentIntent[];contentMode:ContentMode;
 factualityProfile:FactualityProfile;comparisonProfile:ComparisonProfile;temporalProfile:TemporalProfile;creativeProfile:CreativeProfile;
 expectedClaimFamilies:ClaimFamily[];researchRequirement:ResearchRequirementLevel;writerRequirement:WriterRouteKind;
 riskFlags:string[];reasonCodes:string[];interpretations:ContentIntent[];signals:SignalMatch[];
}
export interface ResearchRoute {
 level:ResearchRequirementLevel;execute:'NONE'|'OPTIONAL'|'REQUIRED';researchGoal:'RANKING'|'PROCESS'|'FACTS'|null;researchVersion:4|null;
 desiredFactTypes:FactType[];constraints:{rankingCount?:number;residencyCriterion?:'PERMANENT_POPULATION';metric?:'TEMPERATURE'|'POPULATION';qualifier?:string}|null;
 quorum:{minIndependentSources:number;minPrimaryQuality:'MEDIUM'|'HIGH';factTypeQuorum:Record<string,number>};
 evidenceRequirements:{claimFamily:ClaimFamily;factTypes:FactType[];requirement:EvidenceRequirement;corroboration:number;temporal:ClaimRequirementProfile['temporalRequirement']}[];
 excludedFamilies:{claimFamily:ClaimFamily;reason:string}[];blockingRules:string[];reasonCodes:string[];
}
export interface WriterRoute {
 kind:WriterRouteKind;factPolicy:FactPolicy|null;requiresCompleteResearch:boolean;groundingFamilies:ClaimFamily[];structuralFamilies:ClaimFamily[];
 creativeFamilies:ClaimFamily[];epistemicSeparation:boolean;strategyHint:Arc|null;blockedWhen:string[];reasonCodes:string[];
}
export interface VisualPlanningHint {kind:'PROCESS_DIAGRAM'|'CAUSE_CHAIN'|'TIMELINE'|'MAP_CONTEXT'|'RANKED_ORDER'|'COMPARISON_SPLIT'|'COUNTERFACTUAL_BEFORE_AFTER'|'SCENE'|'PORTRAIT_CONTEXT'|'OBJECT_CUTAWAY';arc:Arc|null;proof:ClaimRequirementProfile['visualProofExpectation'];note:string}
export interface TopicPlanningRequest {
 topicPlanningVersion:1;topic:string;language?:'pt-BR'|'en';
 overrides?:{researchRequirement?:ResearchRequirementLevel;contentMode?:ContentMode;writerRoute?:WriterRouteKind;reason?:string};
}
export interface OverrideRecord {field:'researchRequirement'|'contentMode'|'writerRoute';requested:string;computed:string;applied:boolean;reason:string}
export interface TopicPlan {
 version:string;topicPlanningVersion:1;request:TopicPlanningRequest;analysis:TopicAnalysis;claimRequirements:ClaimRequirementProfile[];
 researchRoute:ResearchRoute;writerRoute:WriterRoute;visualHints:VisualPlanningHint[];overrides:OverrideRecord[];structuralSignature:string;fingerprint:string;
}
