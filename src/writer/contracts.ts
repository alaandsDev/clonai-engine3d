import type {CapabilityNode} from '../autodirector/contracts';
import type {SourceSpan} from '../semantics/contracts';
import type {SemanticNarrativeGraph} from '../semantics/narrative-contracts';
import type {PartialExecutionPlan,CompiledNarrative} from '../narrative/contracts';
export const WRITER_VERSION='topic-writer/1.0.0';
export type FactPolicy='SOURCE_ONLY'|'STRUCTURAL_ONLY'|'GROUNDED_ONLY'|'UNVERIFIED_CREATIVE';
export interface TopicScriptRequest {
 version:1; id:string;topic:string;language:'pt-BR';format?:'vertical_short';factPolicy?:FactPolicy;
 targetWords?:{min:number;max:number};targetDurationSeconds?:{min:number;max:number};
 sourceMaterial?:{id:string;text:string;provenance:string;allowedForClaims:boolean}[];
 constraints?:{minExecutableTimelineRate?:number;maxPrimaryGapRate?:number;maxRevisions?:number;maxPrimaryClaims?:number;maxCentralEntities?:number;maxDomains?:number;allowSourceOmissions?:boolean};
 style?:{tone?:'CLEAR'|'CONVERSATIONAL'};
}
export interface WriterPolicy {version:string;minExecutableTimelineRate:number;maxPrimaryGapRate:number;maxRevisions:number;maxPrimaryClaims:number;maxCentralEntities:number;maxDomains:number;allowSourceOmissions:boolean}
export interface WriterCapabilityProfile {
 version:string;subjects:string[];operations:string[];relations:string[];proofTypes:string[];
 bundles:{id:string;operations:string[];requirements:string[];evidenceNodeIds:string[]}[];
 snapshot:CapabilityNode[];fingerprint:string;
}
export interface TopicAnalysis {
 rawTopic:string;normalizedTopic:string;entities:string[];requestedRelation:string[];requestedProcess:string[];requestedTransformation:string[];questionType:string;
 knownFromInput:{text:string;provenance:'TOPIC'|'SOURCE';sourceMaterialId:string|null;sourceSpan:SourceSpan}[];
 unknownRequirements:string[];candidateDomains:string[];confidence:'HIGH'|'MEDIUM'|'LOW';
 family:'TRANSFER'|'ACCUMULATION'|'SOURCE'|'UNKNOWN';sourceGraphFingerprints:string[];
}
export interface TopicCapabilityMatch {status:'SUPPORTED'|'PARTIALLY_SUPPORTED'|'UNSUPPORTED'|'AMBIGUOUS';missingConcepts:string[];missingCapabilities:string[];reason:string;possibleSupportedAngles:string[]}
export type Arc='PROCESS_EXPLAINER'|'STATE_TRANSFORMATION'|'BEFORE_AFTER'|'PATH_JOURNEY'|'QUANTITY_PROGRESSION'|'RANKING'|'COMPARISON'|'OBJECT_EXPLAINER'|'QUESTION_REVEAL';
export interface VisualNarrativeStrategy {id:Arc;eligible:boolean;requirements:string[];missingRequirements:string[];hook:string;centralSubject:string;visualGoal:string;supportedProcesses:string[];supportedStateChanges:string[];supportedQuantities:string[];narrativeArc:string[];estimatedCapabilityCoverage:number;reason:string}
export interface Permission {kind:'TOPIC_STRUCTURE'|'SOURCE_FACT'|'EDITORIAL'|'VISUAL_CONVENTION';sourceMaterialId:string|null;sourceSpan:SourceSpan|null;reason:string}
export interface OutlineBlock {id:string;purpose:string;targetClaims:string[];requiredCapabilities:string[];estimatedWords:number;risk:'LOW'|'MEDIUM';visualIntent:string;operation:string|null;permission:Permission;textSeed:string|null;canonicalSubject:string|null}
export interface ScriptOutline {strategyId:Arc;hookType:string;conclusionType:string;blocks:OutlineBlock[];centralEntities:string[];domains:string[]}
export interface Utterance {blockId:string;purpose:string;operation:string|null;text:string;canonicalText:string;sourceSpan:SourceSpan;permission:Permission;canonicalSubject:string|null}
export interface ScriptCandidate {id:string;provider:'DETERMINISTIC_LOCAL';strategy:VisualNarrativeStrategy;outline:ScriptOutline;script:string;utterances:Utterance[];estimatedGapRisk:number;fingerprint:string}
export interface FactAudit {passed:boolean;unsupportedFactCount:number;untraceableSpecificClaimCount:number;sourceGroundingRate:number;issues:{code:string;text:string;reason:string}[];claimProvenance:{claimId:string;sourceMaterialId:string|null;sourceSpan:SourceSpan|null;kind:Permission['kind'];reason:string}[];omissions:{sourceMaterialId:string;sourceSpan:SourceSpan;reason:string}[]}
export interface ScriptQualityReport {
 wordCount:number;estimatedDuration:number;sentenceCount:number;primaryClaimCount:number;entityCount:number;domainCount:number;ambiguousReferenceCount:number;semanticHighConfidenceRate:number;executableClaimRate:number;directProofRate:number;gapRate:number;executableTimelineRate:number;repetitionRisk:number;naturalness:number;sourceGroundingRate:number;unsupportedFactCount:number;untraceableSpecificClaimCount:number;warnings:string[];
}
export interface CandidatePreflight {candidateId:string;graph:SemanticNarrativeGraph;plan:PartialExecutionPlan;compiled:CompiledNarrative;facts:FactAudit;quality:ScriptQualityReport;acceptance:'ACCEPTABLE_CANDIDATE'|'REJECTED_CANDIDATE';hardRejections:string[];score:number;scoreBreakdown:Record<string,number>;fingerprint:string}
export interface Revision {candidateId:string;iteration:number;operation:string;before:string;after:string;reason:string;affectedGapIds:string[];semanticImpact:string;provenance:Permission[];beforeFingerprint:string;afterFingerprint:string}
export interface SelectionResult {selectedCandidateId:string|null;score:number|null;reason:string;alternatives:{candidateId:string;score:number;acceptance:string;reasons:string[]}[];rejectedCandidates:string[];revisionHistory:Revision[]}
export interface WriterResult {version:string;request:TopicScriptRequest;policy:WriterPolicy;topicAnalysis:TopicAnalysis;capabilityProfile:WriterCapabilityProfile;capabilityMatch:TopicCapabilityMatch;strategies:VisualNarrativeStrategy[];candidates:ScriptCandidate[];candidatePreflights:CandidatePreflight[];revisionHistory:Revision[];selection:SelectionResult;similarity:{candidateA:string;candidateB:string;similarity:number;warning:boolean}[];finalCandidate:ScriptCandidate|null;finalPreflight:CandidatePreflight|null;status:'READY'|'UNSUPPORTED_TOPIC'|'SOURCE_REQUIRED'|'NO_ACCEPTABLE_CANDIDATE';reason:string;fingerprint:string}
export interface ScriptWriterProvider {readonly kind:'DETERMINISTIC_LOCAL'|'LOCAL_MODEL'|'EXTERNAL_LLM';generate(request:TopicScriptRequest,capabilityProfile:WriterCapabilityProfile):ScriptCandidate[]}
