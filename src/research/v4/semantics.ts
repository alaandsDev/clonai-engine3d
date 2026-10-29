import {normalize} from '../../semantics/normalize';
import type {CanonicalFact, Evidence, FactCandidate, ResearchPolicy, SourceDocument, PublisherIdentity} from '../contracts';
import {parseDelimited} from '../structured';
import type {DatasetEntityMatch, EntityTypeFitness, PackData, SourceEcosystem} from './contracts';

export const normalized = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Literal presence semantics only. Numeric census counts alone are deliberately insufficient. */
export function residencyV4(text: string) {
 const t=normalized(text), year=text.match(/\b(?:in|as of|since|by|census(?: of)?)\s+((?:1[6-9]|20)\d{2})\b/i)?.[1]??null;
 const historical=/\b(?:was|were|had|formerly|used to|historical)\b/.test(t)&&!/\b(?:is|are|has|have|currently|today|remains|still)\b/.test(t);
 let residency: CanonicalFact['residency']=null, semantic='UNKNOWN';
 if (/\b(?:no|without) (?:permanent |usual )?(?:population|residents|inhabitants)\b|\buninhabited\b|\babandoned settlement\b/.test(t)) {residency='UNINHABITED';semantic='ABSENCE';}
 else if (/\b(?:seasonal|rotating|temporary) (?:research )?(?:workers|staff|personnel|residents|population|scientists)\b|seasonally inhabited/.test(t)) {residency=/research|scientist/.test(t)?'TEMPORARY_RESEARCH_STAFF':/seasonal/.test(t)?'SEASONAL_PRESENCE':'TEMPORARY_STAFF';semantic=residency;}
 else if (/\bresearch (?:staff|personnel|station|base)\b|\bscientists\b/.test(t)&&!/\b(?:permanent civilian residents|usual residents)\b/.test(t)) {residency='RESEARCH_STAFF';semantic='RESEARCH_STAFF';}
 else if (/\bmilitary (?:staff|personnel)|\btourists\b|\bvisitors\b/.test(t)&&!/\b(?:permanent civilian residents|usual residents)\b/.test(t)) {residency='TEMPORARY_STAFF';semantic=/military/.test(t)?'MILITARY_STAFF':'VISITORS';}
 else if (/\busual residents\b|\bpermanent (?:civilian )?(?:population|residents|inhabitants)\b|\bpermanently (?:inhabited|populated)\b|\byear-round (?:civilian )?(?:population|residents)\b|\binhabited year-round\b/.test(t)) {residency='PERMANENT_POPULATION';semantic=/usual/.test(t)?'USUAL_RESIDENTS':/civilian/.test(t)?'PERMANENT_CIVILIAN_RESIDENTS':'EXPLICIT_PERMANENT_PRESENCE';}
 else if (/\bpermanent settlement\b/.test(t)) {residency='PERMANENT_SETTLEMENT';semantic='SETTLEMENT_NOT_POPULATION';}
 else if (/\bcensus\b|\bpopulation\b/.test(t)) semantic='NUMERIC_OR_CENSUS_COUNT_ONLY';
 return {residency,historical,year,semantic};
}

/** Complement existing qualifiers without weakening the v1-v3 vocabulary. */
export function measurementContext(text: string, fact?: CanonicalFact) {
 const t=normalized(text);
 const qualifier=/heat index/.test(t)?'HEAT_INDEX':/feels like|apparent temperature/.test(t)?'FEELS_LIKE':/wind ?chill/.test(t)?'WIND_CHILL':/modelled|modeled|simulated|model prediction/.test(t)?'MODELLED_MINIMUM':/lowest maximum|lowest high/.test(t)?'LOWEST_MAXIMUM':fact?.qualifiers.find(q=>q!=='REPORTED'&&q!=='APPROXIMATE')??'UNKNOWN';
 const scope: 'STATION_RECORD'|'SETTLEMENT_RECORD'|'REGIONAL_RECORD'|'UNKNOWN'=fact?.subjectKind==='STATION'||/\b(?:station|observation site)\b/.test(t)?'STATION_RECORD':/\b(?:regional|country|national) (?:record|minimum)|\bregion-wide\b/.test(t)?'REGIONAL_RECORD':/\b(?:settlement|village|town|city)\b/.test(t)?'SETTLEMENT_RECORD':'UNKNOWN';
 return {qualifier,scope,minimumRecordedCompatible:qualifier==='MINIMUM_RECORDED',reasons:[qualifier+' is evaluated separately from other temperature statistics',scope]};
}
export function evidenceAllowedV4(e: Evidence,source?:SourceDocument,allSources:SourceDocument[]=[]): boolean {
 if(e.structured?.kind==='DATASET'&&source){
  const target=source.metadata.datasetTarget;
  if(!target||!target.proof.length||!target.proof.every(p=>allSources.find(s=>s.id===p.sourceId)?.content.slice(p.span.start,p.span.end)===p.span.text))return false;
  if(target.identifier&&!target.proof.some(p=>p.span.text.includes(target.identifier!))||target.admin&&!target.proof.some(p=>normalized(p.span.text).includes(normalized(target.admin!))))return false;
  if(!target.proof.some(p=>allSources.find(s=>s.id===p.sourceId)?.normalized.text.includes(target.name)))return false;
  const grid=parseDelimited(source.content,source.contentType==='text/csv'?',':'\t'),headers=grid.rows[0]??[],row=grid.rows[e.structured.row]??[];
  const field=(re:RegExp)=>{const i=headers.findIndex(c=>re.test(c.text.trim()));return i<0?undefined:row[i]?.text;};
  return matchDatasetEntity(target.name,{name:e.supports.subject,identifier:field(/^(?:station|site|entity|locality|place) (?:id|code|number)$/i),admin:field(/^(?:country|state|province|region|administrative context)$/i),span:e.structured.subjectSpan},{identifier:target.identifier??undefined,admin:target.admin??undefined}).status==='MATCHED';
 }
 if(e.supports.factType==='MEASUREMENT'&&['HEAT_INDEX','FEELS_LIKE','MODELLED_MINIMUM','LOWEST_MAXIMUM'].includes(measurementContext([e.normalizedText,...(e.structured?.headerSpans??[]).map(s=>s.text)].join(' '),e.supports).qualifier))return false;
 if(e.supports.factType==='RESIDENCY') {
  const semantic=residencyV4(e.normalizedText);
  if(semantic.residency&&semantic.residency!==e.supports.residency)return false;
 }
 return true;
}
export function sourceEcosystem(source: SourceDocument, publisherName: string|null=null): {sourceId:string;ecosystem:SourceEcosystem;reasons:string[]} {
 const text=normalized([publisherName??'',source.title,source.publisher,...source.normalized.text.slice(0,16000).split('\n').filter(l=>/produced by|publisher|copyright/.test(normalized(l)))].join(' '));
 const ecosystem:SourceEcosystem=source.sourceType==='REFERENCE'?'REFERENCE':source.sourceType==='NEWS'?'NEWS':/statistic|census|demograph/.test(text)?'NATIONAL_STATISTICS':/meteorolog|weather|climat|hydromet/.test(text)?'METEOROLOGICAL_AGENCY':/university|college/.test(text)?(/repository|theses|dissertation/.test(text)?'UNIVERSITY_REPOSITORY':'ACADEMIC'):/open data|data catalog|data catalogue|dataset registry/.test(text)?'DATA_CATALOG':/geographic|locality register|gazetteer/.test(text)?'GEOGRAPHIC_REGISTRY':/municipal|city council|town council/.test(text)?'MUNICIPALITY':/regional government|state government/.test(text)?'REGIONAL_GOVERNMENT':/local government|borough|hamlet council/.test(text)?'LOCAL_GOVERNMENT':/archive|archived/.test(text)?'ARCHIVE':source.sourceType==='ACADEMIC'?'ACADEMIC':'OTHER';
 return {sourceId:source.id,ecosystem,reasons:['Explicit snapshot/publisher vocabulary; ecosystem is a discovery category, not an authority or independence admission']};
}
export function entityTypeFitness(pack: Pick<PackData,'sources'|'evidence'|'groundedFacts'|'v3'>): EntityTypeFitness[] {
 const names=[...new Set(pack.groundedFacts.map(f=>f.canonicalFact.subject).concat(pack.v3?.entityGraph.nodes.map(n=>n.name)??[]))].sort((a,b)=>a.localeCompare(b,'en'));
 return names.map(entity=>{
  const n=normalized(entity), facts=pack.groundedFacts.filter(f=>f.canonicalFact.subject===entity), ev=pack.evidence.filter(e=>facts.some(f=>f.evidenceIds.includes(e.id))), station=facts.length>0&&facts.every(f=>f.canonicalFact.subjectKind==='STATION');
  let kind:EntityTypeFitness['kind']=station?'STATION':'UNKNOWN';const sourceIds:string[]=[],reasons:string[]=[];
  if(!station&&pack.v3?.entityGraph.nodes.some(node=>normalized(node.name)===n&&node.kind==='SETTLEMENT')){kind='SETTLEMENT';reasons.push('EntityGraph lead with a source-backed locality type');}
  if(!station&&/^(?:highest|lowest|mean|average|maximum|minimum|number of|annual|record)\b|\b(?:heat index|temperature statistic)\b/.test(n))kind='METRIC_LABEL';
  if(kind==='UNKNOWN'&&/^(?:climate data|statistics|summary|list of|extremes|population table|references|bibliography)\b/.test(n))kind='DOCUMENT_SECTION';
  if(/^(?:the|a|an|it|this|that|there|these|those|they|population|residents|people)$/.test(n))kind='DOCUMENT_SECTION';
  for(const s of pack.sources) {
   const expression=new RegExp('(?:^|[\\n.])\\s*'+escape(n)+'(?:, [^\\n.]{1,70},)? (?:is|was|remains) (?:the |an? )?(?:[^\\n.]{0,70}? )?(country|nation|city|town|village|hamlet|settlement|locality)\\b','g');
   const match=expression.exec(normalizedLines(s.normalized.text));if(!match)continue;
   const candidate=match[1]==='nation'?'COUNTRY':match[1].toUpperCase() as EntityTypeFitness['kind'];
   if(kind==='UNKNOWN'||candidate==='COUNTRY')kind=candidate;
   sourceIds.push(s.id);reasons.push('Explicit source wording: '+match[0].trim().slice(0,240));
  }
  const fit=['SETTLEMENT','LOCALITY','TOWN','VILLAGE','HAMLET','CITY'].includes(kind)?'FIT' as const:kind==='UNKNOWN'?'UNCONFIRMED' as const:'UNFIT' as const;
  return {entity,kind,fitness:fit,evidenceIds:ev.map(e=>e.id).sort(),sourceIds:[...new Set(sourceIds)].sort(),reasons:reasons.length?reasons:[kind==='UNKNOWN'?'No explicit settlement/locality type in acquired sources':kind+' does not compete with a locality target']};
 });
}
function normalizedLines(s:string){return s.split('\n').map(normalized).join('\n');}

export function matchDatasetEntity(target:string,row:{name:string;identifier?:string;admin?:string;span?:DatasetEntityMatch['rowSpan']},context:{identifier?:string;admin?:string;aliases?:{name:string;supported:boolean}[]}={}):DatasetEntityMatch {
 let status:DatasetEntityMatch['status']='CANDIDATE',proof='Name similarity/exact name alone has no identifying context';
 if(row.identifier&&context.identifier){status=row.identifier===context.identifier?'MATCHED':'REJECTED';proof='Explicit identifier comparison';}
 else if(row.admin&&context.admin){status=normalized(row.admin)===normalized(context.admin)&&(normalized(row.name)===normalized(target)||(context.aliases??[]).some(a=>a.supported&&normalized(a.name)===normalized(row.name)))?'MATCHED':'REJECTED';proof='Explicit administrative context plus exact name or supported alias';}
 return {status,proof,rowSubject:row.name,target,rowSpan:row.span??null};
}
/** Distinct, explicit observation windows explain a value difference; absent context never does. */
export function separateMeasurementContexts(a:CanonicalFact,b:CanonicalFact){
 if(a.factType!=='MEASUREMENT'||b.factType!=='MEASUREMENT')return false;
 if(a.subjectKind!==b.subjectKind)return true;
 return Boolean(a.observationPeriod&&b.observationPeriod&&a.observationPeriod!==b.observationPeriod);
}
export function temporalAssessment(e:Evidence,policy:ResearchPolicy) {
 const f=e.supports, y=f.temporalContext?.match(/(?:1[6-9]|20)\d{2}/)?.[0];
 return f.qualifiers.includes('HISTORICAL')?'HISTORICAL' as const:y&&policy.evaluationDate&&policy.residencyMaxAgeYears&&Number(policy.evaluationDate.slice(0,4))-Number(y)>policy.residencyMaxAgeYears?'STALE' as const:residencyV4(e.normalizedText).residency?'CURRENT' as const:'UNKNOWN' as const;
}
/** Explicit cross-domain publisher identity and declared dataset lineage only reduce independence. */
export function v4SourceLineage(sources:SourceDocument[],publishers:PublisherIdentity[]):SourceDocument[]{
 return sources.map(s=>{
  const identity=publishers.find(p=>p.sourceId===s.id),keys=[...(s.provenance.sharedOriginKeys??[]),'v4-locator:'+s.canonicalLocator];
  if(identity?.name&&identity.name.length>=6&&identity.signals.some(x=>x.span))keys.push('v4-publisher:'+normalized(identity.name));
  for(const related of s.metadata.dataset?.related??[])if(/IsDerivedFrom|IsIdenticalTo|IsVersionOf|Cites|References/i.test(related.relation))keys.push('v4-locator:'+related.url);
  return {...s,provenance:{...s.provenance,sharedOriginKeys:[...new Set(keys)].sort()}};
 });
}
