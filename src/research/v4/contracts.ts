import type {EvidencePack, SourceType, Residency} from '../contracts';
import type {DiscoveryStrategy, CandidateEntity, CorroborationTask} from '../web/contracts';

export type PackData = Omit<EvidencePack, 'fingerprint'>;
export type SourceEcosystem = 'NATIONAL_STATISTICS' | 'LOCAL_GOVERNMENT' | 'METEOROLOGICAL_AGENCY' | 'ACADEMIC' | 'UNIVERSITY_REPOSITORY' | 'DATA_CATALOG' | 'GEOGRAPHIC_REGISTRY' | 'MUNICIPALITY' | 'REGIONAL_GOVERNMENT' | 'ARCHIVE' | 'REFERENCE' | 'NEWS' | 'OTHER';
export type GapKind = 'MISSING_SECOND_ORIGIN' | 'MISSING_PRIMARY_AUTHORITY' | 'MISSING_CURRENT_RESIDENCY' | 'MISSING_PERMANENT_POPULATION' | 'MISSING_MINIMUM_RECORDED' | 'MISSING_TEMPORAL_ANCHOR' | 'MISSING_STATION_RELATION' | 'MISSING_ENTITY_IDENTITY' | 'CONFLICT_REQUIRES_RESOLUTION' | 'SOURCE_FORMAT_BLOCKED' | 'SOURCE_LANGUAGE_BLOCKED' | 'SOURCE_FETCH_BLOCKED';
export type GapStatus = 'OPEN' | 'CLOSED' | 'PARTIAL' | 'EXHAUSTED' | 'BLOCKED_FORMAT' | 'BLOCKED_LANGUAGE' | 'BLOCKED_FETCH' | 'CONFLICTED' | 'BUDGET_EXHAUSTED';
export interface EligibilityGainEstimate {distance: number; nearEligible: boolean; expectedGain: number; independentYield: number; authorityProbability: number; fetchability: number; diversity: number; failurePenalty: number; cost: number; score: number; reasons: string[]}
export interface FactGap {
 id: string; factKey: string | null; entity: string; metric: string | null; qualifier: string | null; kind: GapKind;
 existingEvidence: string[]; existingOrigins: string[]; existingLocators:string[]; knownCitationTargets:string[]; excludedOrigins: string[]; existingEcosystems: SourceEcosystem[];
 missingRequirement: string; preferredSourceClasses: SourceType[]; preferredAcquisitionStrategies: SourceEcosystem[];
 priority: number; gain: EligibilityGainEstimate; attemptHistory: string[]; budget: number; status: GapStatus;
}
export interface TemporalEvidenceRequirement {kind: 'CURRENT' | 'HISTORICAL' | 'OBSERVATION_PERIOD' | 'EVENT_DATE' | 'CENSUS_DATE' | 'PUBLICATION_DATE'; required: boolean; evaluationDate: string | null; maxAgeYears: number | null; publicationDateCanSubstitute: false; reason: string}
export interface EvidenceRequirementPlan {id: string; gapId: string; entity: string; factKey: string | null; evidenceType: string; metric: string | null; qualifier: string | null; temporal: TemporalEvidenceRequirement[]; entityMatch: string; minimumNewOrigins: number; preferredEcosystems: SourceEcosystem[]; closeWhen: string[]; forbiddenSubstitutions: string[]}
export interface ProviderCapability {
 provider: DiscoveryStrategy; ecosystems: SourceEcosystem[]; queryTypes: string[]; metadata: string[];
 maxResults: number; requestCost: number; contentAvailability: 'LANDING_PAGE' | 'DATASET_RESOURCES' | 'METADATA_ONLY';
 independenceExpectation: string; enabled: boolean; reason: string; documentation: string;
}
export interface QueryFamily {id: string; gapId: string; ecosystem: SourceEcosystem; kind: 'METRIC' | 'RECORD' | 'DATASET' | 'CENSUS' | 'LOCALITY_REGISTER' | 'HISTORICAL_RECORD' | 'OBSERVATION_STATION' | 'CITATION_ORIGIN' | 'REVERSE_CITATION'; queries: string[]; attempts: number; failures: number; exhausted: boolean}
export interface SourceStrategy {id: string; gapId: string; requirementId: string; familyId: string; ecosystem: SourceEcosystem; provider: DiscoveryStrategy; queryPurpose: string; whyIndependent: string; excludedOrigins: string[]; expectedEvidenceType: string; estimatedCost: number; expectedValue: number; attemptBudget: number; queries: string[]; executable: boolean; reason: string}
export interface ResidencyEvidenceAssessment {evidenceId: string; presenceType: Residency | null; currentness: 'CURRENT' | 'HISTORICAL' | 'STALE' | 'UNKNOWN'; populationSemantic: string; authority: string; origin: string | null; entityMatch: string; admissibleSemantics: boolean; reasons: string[]}
export interface MeasurementContextAssessment {evidenceId: string; qualifier: string; scope: 'STATION_RECORD' | 'SETTLEMENT_RECORD' | 'REGIONAL_RECORD' | 'UNKNOWN'; eventDate: string | null; observationPeriod: string | null; publicationDate: string | null; minimumRecordedCompatible: boolean; reasons: string[]}
export interface EntityTypeFitness {entity: string; kind: 'SETTLEMENT' | 'LOCALITY' | 'TOWN' | 'VILLAGE' | 'HAMLET' | 'CITY' | 'STATION' | 'COUNTRY' | 'METRIC_LABEL' | 'DOCUMENT_SECTION' | 'DATASET_NAME' | 'UNKNOWN'; fitness: 'FIT' | 'UNFIT' | 'UNCONFIRMED'; evidenceIds: string[]; sourceIds: string[]; reasons: string[]}
export interface ConflictResolutionTask {id: string; conflictId: string; factKeys: string[]; entity: string; status: 'UNRESOLVED' | 'SEMANTIC_CONTEXT_SEPARATED'; investigate: string[]; evidenceIds: string[]; automaticAuthorityOverride: false; reason: string}
export interface CitationPursuitTask {id: string; sourceId: string | null; fromUrl: string; targetUrl: string; relation: 'CITES' | 'REVERSE_CITATION' | 'DATASET_LINEAGE'; evidenceIds: string[]; originIndependence: 'UNPROVEN'; reason: string}
export interface DatasetIdentity {id: string; publisher: string | null; version: string | null; date: string | null; schema: string[]; resourceUrl: string; related: {url: string; relation: string}[]; discoveryOnly: true}
export interface DatasetEntityMatch {status: 'MATCHED' | 'CANDIDATE' | 'REJECTED'; proof: string; rowSubject: string; target: string; rowSpan: {start: number; end: number; text: string} | null}
/** Recorded acquisition inputs; result counters are derived independently from these and snapshots. */
export interface AcquisitionIntent {id: string; gapId: string; strategyId: string; familyId: string; provider: DiscoveryStrategy; ecosystem: SourceEcosystem; queryId: string | null; query: string; resultUrls: string[]; fetchAttemptIds: string[]; beforeSourceIds: string[]; afterSourceIds: string[]; diagnostic: string | null; timestamp: string; rejectedSameOrigin: string[]}
export interface AcquisitionAttempt extends AcquisitionIntent {resultCount: number; acceptedSources: string[]; newOrigins: number; newEvidence: number; newEvidenceIds: string[]; gapClosed: boolean; failureReason: string | null}
export interface CorroborationYield {queriesPerNewIndependentOrigin: number | null; fetchesPerNewIndependentOrigin: number | null; newIndependentOrigins: number; newOriginsPerEcosystem: Record<string, number>; factsZeroToOne: number; factsOneToTwo: number; insufficientToSupported: number; supportedToCorroborated: number; eligibleItemsGained: number; wastedSameOriginDiscoveries: number; nearCopiesRejected: number; nearCopyRejectionRate: number; independentOriginYield: number; gapClosureRate: number; usefulEvidenceRate: number}
export interface ResearchV4Section {version: string; gaps: FactGap[]; requirements: EvidenceRequirementPlan[]; strategies: SourceStrategy[]; queryFamilies: QueryFamily[]; ecosystems: {sourceId: string; ecosystem: SourceEcosystem; reasons: string[]}[]; entityFitness: EntityTypeFitness[]; residency: ResidencyEvidenceAssessment[]; measurements: MeasurementContextAssessment[]; conflicts: ConflictResolutionTask[]; fingerprint: string}
export interface ResearchSessionV4 {
 version: string; bootstrapSourceIds: string[]; intents: AcquisitionIntent[]; attempts: AcquisitionAttempt[];
 model: ResearchV4Section; providers: ProviderCapability[]; candidateEntityPool: CandidateEntity[]; corroborationTasks: CorroborationTask[];
 citations: CitationPursuitTask[]; datasets: DatasetIdentity[]; yield: CorroborationYield; stopReason: string;
 fingerprints: Record<'model' | 'attempts' | 'pool' | 'tasks' | 'citations' | 'datasets' | 'yield', string>;
}
export interface WebResearchV4Config {providers: DiscoveryStrategy[]; bootstrapFetches: number; maxAttemptsPerGap: number; maxFetchesPerStrategy: number; maxFamiliesPerRound: number; maxFailedFamilyAttempts: number; dataCiteEndpoint: string; ckanEndpoint: string}
