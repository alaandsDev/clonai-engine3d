import {jsonHash} from '../../editorial/fingerprint';
import {planResearch} from '../planner';
import {buildEvidencePack} from '../pack';
import {registrableDomain} from '../origins';
import {providerCapabilities,researchV4Model} from '../v4/planning';
import {buildSessionV4,acquisitionAttempt} from '../v4/session';
import type {AcquisitionIntent,AcquisitionAttempt,FactGap} from '../v4/contracts';
import type {EvidencePack,ResearchRequest,SourceInput} from '../contracts';
import type {SearchQuery,SearchResult,DiscoveryStrategy,ResearchSession,SearchProvider,WebEnvironment,WebResearchConfig,CandidateSource,FetchAttempt,ResearchSessionV2,ResearchGap} from './contracts';
import {SecureHttpClient,nodeEnvironment} from './http';
import {WebSourceProvider} from './fetcher';
import {MediaWikiSearchProvider,candidateSources} from './search';
import {WikidataEntityProvider} from './v2';
import {CrossrefWorksProvider,broadQueriesV3,sessionV3,type Finish} from './v3';
import {DataCiteDatasetProvider,CkanDatasetProvider} from './v4-providers';
import {canonicalUrl} from './security';
import type {SnapshotCache} from './cache';

export const WEB_RESEARCH_V4_VERSION='web-research/4.0.0';
export async function runWebResearchV4(request:ResearchRequest,config:WebResearchConfig,options:{env?:WebEnvironment;searchProvider?:SearchProvider;extraProviders?:Partial<Record<DiscoveryStrategy,SearchProvider>>;cache?:SnapshotCache},finish:Finish):Promise<ResearchSession>{
 const v=config.v4!,plan=planResearch(request),env=options.env??nodeEnvironment,start=env.now(),client=new SecureHttpClient(config,env);client.deadline=start+config.maxDurationMs;
 const providers:Partial<Record<DiscoveryStrategy,SearchProvider>>={MEDIAWIKI_REFERENCE_SEARCH:options.searchProvider??new MediaWikiSearchProvider(client),WIKIDATA_ENTITY_DISCOVERY:new WikidataEntityProvider(client,config.v2?.wikidataEndpoint??'https://www.wikidata.org/w/api.php'),CROSSREF_WORKS_SEARCH:new CrossrefWorksProvider(client,config.v2?.crossrefEndpoint??'https://api.crossref.org/works'),DATACITE_DATASET_SEARCH:new DataCiteDatasetProvider(client,v.dataCiteEndpoint),CKAN_DATASET_SEARCH:new CkanDatasetProvider(client,v.ckanEndpoint),...options.extraProviders};
 const fetcher=new WebSourceProvider(client,options.cache),queries:SearchQuery[]=[],results:SearchResult[]=[],trace:ResearchSession['searchTrace']=[],candidates:CandidateSource[]=[],attempts:FetchAttempt[]=[],rejected:ResearchSession['rejectedSources']=[],diagnostics:string[]=[],intents:AcquisitionIntent[]=[],derivedAttempts:AcquisitionAttempt[]=[],discovery:NonNullable<ResearchSession['v3']>['discovery']=[],cache=new Map<string,EvidencePack>();
 const tried=new Set<string>(),domainCounts=new Map<string,number>(),asked=new Set<string>(),caps=providerCapabilities();let prior:FactGap[]=[],rounds=1;
 const exhausted=()=>env.now()-start>=config.maxDurationMs||client.bytes>=config.maxTotalBytes||attempts.length>=config.maxFetchedSources;
 const snapshot=()=>fetcher.receive(plan).sources;
 const ids=()=>snapshot().map(s=>s.id).sort();
 const pack=()=>{const k=ids().join('|');let p=cache.get(k);if(!p){p=buildEvidencePack(request,fetcher);cache.set(k,p);}return p;};
 const search=async(provider:DiscoveryStrategy,q:SearchQuery,limit:number)=>{
  if(exhausted()||queries.length>=config.maxQueries||results.length>=config.maxSearchResults||asked.has(provider+'|'+q.text))return {results:[] as SearchResult[],diagnostic:'ACQUISITION_BUDGET_OR_DUPLICATE_QUERY',latencyMs:0};
  const traced={...q,provider};queries.push(traced);asked.add(provider+'|'+q.text);
  let found;try{found=await providers[provider]!.search(traced,Math.min(limit,config.maxResultsPerQuery,config.maxSearchResults-results.length));}catch(e){found={results:[],diagnostic:'PROVIDER_FAILURE '+String(e),latencyMs:0};}
  results.push(...found.results);trace.push({query:traced,resultCount:found.results.length,diagnostic:found.diagnostic,latencyMs:found.latencyMs});if(found.diagnostic)diagnostics.push(provider+' '+found.diagnostic);return found;
 };
 const fetch=async(c:CandidateSource,provider:DiscoveryStrategy,q:SearchQuery|null,meta:{gapId:string|null;factId:string|null;path:string;datasetTarget?:SourceInput['metadata']['datasetTarget']})=>{
  if(exhausted()||tried.has(c.canonicalUrl)||(domainCounts.get(c.domain)??0)>=config.maxSourcesPerDomain||candidates.length>=config.maxCandidateSources)return null;
  if(/\.pdf(?:$|[?#])/i.test(c.canonicalUrl)){diagnostics.push('SOURCE_FORMAT_BLOCKED PDF_NOT_INGESTED '+c.canonicalUrl);return null;}
  tried.add(c.canonicalUrl);domainCounts.set(c.domain,(domainCounts.get(c.domain)??0)+1);candidates.push(c);
  const via=provider==='REFERENCE_FOLLOWING'?'REFERENCE_LINK' as const:'SEARCH_RESULT' as const,independence=provider==='REFERENCE_FOLLOWING'?'REFERENCE_DERIVED' as const:provider==='MEDIAWIKI_REFERENCE_SEARCH'?'QUERY_INDEPENDENT' as const:'CORPUS_INDEPENDENT' as const;
  const got=await fetcher.fetch(c,plan,{via,referenceIds:[],strategy:provider,independence,version:4,datasetIdentity:results.find(r=>r.url===c.canonicalUrl)?.datasetIdentity,datasetTarget:meta.datasetTarget,...(/\.(?:csv|tsv|txt)(?:$|[?#])/i.test(c.canonicalUrl)&&config.v2?.maxDatasetBytes?{dataset:{maxBytes:config.v2.maxDatasetBytes,terms:pack().groundedFacts.map(f=>f.canonicalFact.subject)}}:{})});
  attempts.push(got.attempt);c.fetchStatus=got.attempt.status;if(!got.source)rejected.push({url:c.canonicalUrl,reason:got.attempt.reason});
  discovery.push({url:c.canonicalUrl,independence,path:meta.path,provider,query:q?.text??null,seedSourceId:null,seedEntityId:meta.gapId,seedFactId:meta.factId,fetchStatus:got.attempt.status,laterDerived:false});
  return got;
 };
 // Reference corpus establishes candidates only. No previous-phase snapshots or factual seeds enter acquisition.
 for(const q of broadQueriesV3(plan,config).slice(0,2))await search('MEDIAWIKI_REFERENCE_SEARCH',q,config.maxResultsPerQuery);
 for(const c of candidateSources(results,queries,config).slice(0,Math.min(v.bootstrapFetches,config.maxFetchedSources)))await fetch(c,'MEDIAWIKI_REFERENCE_SEARCH',queries.find(q=>c.queryIds.includes(q.id))??null,{gapId:null,factId:null,path:'R0 v4 bootstrap'});
 const bootstrapSourceIds=ids(),bootstrapAttempts=attempts.length;let current=pack();
 for(let round=1;round<=config.maxResearchRounds&&!exhausted()&&current.quality.productionEligibility!=='RESEARCH_READY';round++){
  rounds=round;
  for(let turn=0;turn<v.maxFamiliesPerRound&&!exhausted();turn++){
   const model=researchV4Model(current,derivedAttempts,prior,v,caps),strategy=model.strategies.filter(s=>s.executable&&v.providers.includes(s.provider)).sort((a,b)=>b.expectedValue-a.expectedValue||a.id.localeCompare(b.id,'en'))[0];
   if(!strategy){diagnostics.push('NO_EXECUTABLE_GAP_STRATEGY');break;}
   const gap=model.gaps.find(g=>g.id===strategy.gapId)!,family=model.queryFamilies.find(f=>f.id===strategy.familyId)!;
   const queryText=strategy.queries[0],beforeSourceIds=ids(),fetchIds:string[]=[],sameOrigin:string[]=[];
   const qraw={round,stage:'CORROBORATION' as const,researchQuestionIds:plan.essentialResearchQuestionIds,text:queryText,entityName:gap.entity,entitySourceIds:current.evidence.filter(e=>gap.existingEvidence.includes(e.id)).map(e=>e.sourceId),followupReason:gap.missingRequirement+'; '+strategy.whyIndependent,purpose:strategy.queryPurpose as SearchQuery['purpose'],derivedFrom:gap.id,targetGap:gap.kind,factId:gap.factKey,excludedOrigins:gap.excludedOrigins,provider:strategy.provider,v4:{gapId:gap.id,strategyId:strategy.id,familyId:strategy.familyId,ecosystem:strategy.ecosystem,queryKind:family.kind}},q:SearchQuery={...qraw,id:'Q_'+jsonHash(qraw).slice(0,16)};
   let found:SearchResult[]=[],diagnostic:string|null=null,queryId:string|null=null,selected:CandidateSource[]=[];const fetchDiagnostics:string[]=[];
   if(strategy.provider==='REFERENCE_FOLLOWING'){
    for(const url of strategy.queries)try{const u=canonicalUrl(url);selected.push({id:'C_'+jsonHash(u).slice(0,16),canonicalUrl:u,domain:new URL(u).hostname,queryIds:[],researchQuestionIds:plan.essentialResearchQuestionIds,discoveryRanks:[],title:'Cited source pursued from exact evidence',expectedSourceType:'OTHER',fetchStatus:'PENDING',selectionScore:50,reasons:['CITATION_ORIGIN_PURSUIT; not an independent origin assertion']});}catch(e){diagnostics.push('REFERENCE_URL_REJECTED '+String(e));}
   }else{
    const answer=await search(strategy.provider,q,4);found=answer.results;diagnostic=answer.diagnostic;queryId=queries.some(x=>x.id===q.id)?q.id:null;selected=candidateSources(found,queries,config);
   }
   selected.sort((a,b)=>Number(gap.excludedOrigins.includes(registrableDomain(a.domain)))-Number(gap.excludedOrigins.includes(registrableDomain(b.domain)))||b.selectionScore-a.selectionScore||a.canonicalUrl.localeCompare(b.canonicalUrl,'en'));
   for(const c of selected){
    if(fetchIds.length>=strategy.attemptBudget||exhausted())break;
    if(gap.excludedOrigins.includes(registrableDomain(c.domain)))sameOrigin.push(c.canonicalUrl);
    const contextRecord=current.v3?.records.find(r=>r.subjectCandidates.some(s=>s===gap.entity)),identifier=contextRecord?.fields.find(f=>/^(?:station|site|entity|locality|place) (?:id|code|number)$/i.test(f.label)),admin=contextRecord?.fields.find(f=>/^(?:country|state|province|region|administrative context)$/i.test(f.label));
    const datasetTarget={name:gap.entity,identifier:identifier?.value??null,admin:admin?.value??null,proof:contextRecord?[identifier,admin].filter((f):f is NonNullable<typeof f>=>Boolean(f)).map(f=>({sourceId:contextRecord.sourceId,span:f.span})):[]};
    const got=await fetch(c,strategy.provider,queryId?q:null,{gapId:gap.id,factId:gap.factKey,path:'V4 '+family.kind+' '+strategy.id,datasetTarget});if(got){fetchIds.push(got.attempt.id);if(got.attempt.status!=='SUCCESS'||/UNSUPPORTED_LANGUAGE/.test(got.attempt.reason))fetchDiagnostics.push(got.attempt.reason);}
    current=pack();if((current.groundedFacts.find(f=>f.id===gap.factKey)?.independentOriginCount??0)>=2||current.quality.productionEligibility==='RESEARCH_READY')break;
   }
   const raw={gapId:gap.id,strategyId:strategy.id,familyId:strategy.familyId,provider:strategy.provider,ecosystem:strategy.ecosystem,queryId,query:queryText,resultUrls:strategy.provider==='REFERENCE_FOLLOWING'?selected.map(c=>c.canonicalUrl):found.map(r=>r.url),fetchAttemptIds:fetchIds,beforeSourceIds,afterSourceIds:ids(),diagnostic:diagnostic??(fetchDiagnostics.join('; ')||null),timestamp:new Date(env.now()).toISOString(),rejectedSameOrigin:[...new Set(sameOrigin)].sort()},intent:AcquisitionIntent={id:'ACQ_'+jsonHash(raw).slice(0,20),...raw};
   intents.push(intent);derivedAttempts.push(acquisitionAttempt(intent,gap,cache.get(beforeSourceIds.join('|'))!,current));prior=model.gaps;
   if(current.quality.productionEligibility==='RESEARCH_READY')break;
  }
 }
 const sources=snapshot();
 const view=(p:EvidencePack,writerGaps:ResearchGap[]):ResearchSessionV2=>{
  const strategies=config.v4!.providers.map(kind=>({kind,executed:queries.some(q=>q.provider===kind)||intents.some(a=>a.provider===kind),queries:queries.filter(q=>q.provider===kind).length,results:results.filter(r=>r.provider===kind).length,candidates:candidates.filter(c=>c.queryIds.some(id=>queries.find(q=>q.id===id)?.provider===kind)).length,diagnostics:diagnostics.filter(d=>d.startsWith(kind))}));
  const gaps:ResearchGap[]=[...writerGaps,...attempts.filter(a=>a.status!=='SUCCESS'||/UNSUPPORTED_LANGUAGE/.test(a.reason)).map(a=>({code:(/UNSUPPORTED_LANGUAGE/.test(a.reason)?'UNSUPPORTED_LANGUAGE':/JS_RENDER_REQUIRED|ANTI_BOT_CHALLENGE|EMPTY_STATIC_HTML/.exec(a.reason)?.[0]??'SOURCE_FETCH_GAP') as ResearchGap['code'],subject:null,url:a.url,detail:a.status+': '+a.reason.slice(0,220)})),...(p.v2?.diagnostics??[]).map(d=>({code:(['CORROBORATION_GAP','FACT_CONFLICT'].includes(d.code)?d.code:'EVIDENCE_EXTRACTION_GAP') as ResearchGap['code'],subject:d.subject,url:null,detail:d.detail}))];
  return {version:WEB_RESEARCH_V4_VERSION,strategies,references:[],stageBudgets:[{stage:'BROAD_DISCOVERY',budget:v.bootstrapFetches,used:bootstrapAttempts,reallocatedIn:0},{stage:'CORROBORATION',budget:config.maxFetchedSources-v.bootstrapFetches,used:intents.reduce((n,a)=>n+a.fetchAttemptIds.length,0),reallocatedIn:0}],entityPool:[],gaps,metrics:{primarySources:p.v3?.authority.filter(a=>/^PRIMARY/.test(a.effectiveSourceType)).length??0,publishersAccepted:new Set(sources.map(s=>registrableDomain(new URL(s.canonicalLocator).hostname))).size,domainsFetched:new Set(attempts.map(a=>new URL(a.url).hostname)).size,domainsDiscovered:new Set(results.map(r=>r.displayDomain)).size,independentOriginGroups:p.v2?.originGroups.length??0,supportedFacts:p.groundedFacts.filter(f=>f.status==='SUPPORTED').length,corroboratedFacts:p.groundedFacts.filter(f=>f.status==='CORROBORATED').length}};
 };
 return finish({request,config,plan,queries,results,trace,candidates,attempts,acquired:sources,rejected,diagnostics,rounds,client,start,env,v2:view,v3:(p,view)=>sessionV3(p,plan,results,queries,discovery,view),v4:p=>buildSessionV4(request,sources,p,bootstrapSourceIds,intents,queries,results,attempts,config,cache)});
}
