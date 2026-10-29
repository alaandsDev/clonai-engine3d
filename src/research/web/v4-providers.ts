import {jsonHash} from '../../editorial/fingerprint';
import {canonicalUrl} from './security';
import type {SecureHttpClient} from './http';
import type {SearchProvider,SearchQuery,SearchResult} from './contracts';
import type {DatasetIdentity} from '../v4/contracts';

async function json(client:SecureHttpClient,url:string){
 const {response}=await client.get(url,1048576,{allowedMimes:['application/json']});
 if(response.status!==200||!response.headers['content-type']?.includes('json'))throw Error('PROVIDER_UNAVAILABLE HTTP '+response.status);
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(response.body));
}
function result(client:SecureHttpClient,q:SearchQuery,provider:string,endpoint:string,url:string,title:string,dataset:DatasetIdentity):SearchResult{
 const raw={queryId:q.id,rank:1,title:title.slice(0,300),url:canonicalUrl(url),snippet:'',displayDomain:new URL(url).hostname,provider,retrievedMetadata:{retrievedAt:new Date(client.env.now()).toISOString(),endpoint},datasetIdentity:dataset};
 return {...raw,fingerprint:jsonHash(raw)};
}
const safe=(url:unknown)=>{try{return canonicalUrl(String(url));}catch{return null;}};
/** Public DataCite DOI metadata. Even title/abstract/date/counts are discovery only. */
export class DataCiteDatasetProvider implements SearchProvider{
 readonly kind='DATACITE_DATASET_SEARCH';
 constructor(private client:SecureHttpClient,private endpoint='https://api.datacite.org/dois'){}
 async search(q:SearchQuery,limit:number){const start=this.client.env.now();try{
  const u=new URL(this.endpoint);u.search=new URLSearchParams({query:q.text,'page[size]':String(Math.max(1,Math.min(limit,4))),...(q.v4?.queryKind==='REVERSE_CITATION'?{}:{'resource-type-id':'dataset'})}).toString();
  const data=await json(this.client,u.href),results:SearchResult[]=[];
  for(const row of Array.isArray(data.data)?data.data:[]){
   const a=row?.attributes??{},landing=safe(a.url)??safe('https://doi.org/'+String(a.doi??row.id??''));
   const related:DatasetIdentity['related']=[];
   for(const r of Array.isArray(a.relatedIdentifiers)?a.relatedIdentifiers:[]){const url=safe(r.relatedIdentifierType==='DOI'?'https://doi.org/'+String(r.relatedIdentifier??''):r.relatedIdentifier);if(url)related.push({url,relation:String(r.relationType??'UNKNOWN')});}
   const resources=(Array.isArray(a.contentUrl)?a.contentUrl:[]).map(safe).filter((x:unknown):x is string=>typeof x==='string');
   for(const url of resources.length?resources:landing?[landing]:[]){const dataset:DatasetIdentity={id:String(a.doi??row.id??'').slice(0,200),publisher:typeof a.publisher==='string'?a.publisher.slice(0,200):a.publisher?.name??null,version:a.version?String(a.version).slice(0,80):null,date:a.publicationYear?String(a.publicationYear):null,schema:(Array.isArray(a.formats)?a.formats:[]).filter((x:unknown):x is string=>typeof x==='string').slice(0,12),resourceUrl:url,related:related.slice(0,16),discoveryOnly:true};results.push(result(this.client,q,this.kind,u.href,url,String(a.titles?.[0]?.title??''),dataset));}
  }
  return {results:results.slice(0,limit).map((r,i)=>{const {fingerprint,...raw}=r;return {...raw,rank:i+1,fingerprint:jsonHash({...raw,rank:i+1})};}),diagnostic:results.length?null:'DATACITE_NO_DATASET',latencyMs:this.client.env.now()-start};
 }catch(e){return {results:[],diagnostic:'DATACITE_UNAVAILABLE '+String(e),latencyMs:this.client.env.now()-start};}}
}
/** Generic CKAN action API; resource URLs are acquired separately with the full source guards. */
export class CkanDatasetProvider implements SearchProvider{
 readonly kind='CKAN_DATASET_SEARCH';
 constructor(private client:SecureHttpClient,private endpoint='https://data.gov.uk/api/action/package_search'){}
 async search(q:SearchQuery,limit:number){const start=this.client.env.now();try{
  const u=new URL(this.endpoint);u.search=new URLSearchParams({q:q.text,rows:String(Math.max(1,Math.min(limit,4)))}).toString();
  const data=await json(this.client,u.href);if(data.success!==true)throw Error('CKAN_UNSUCCESSFUL');
  const results:SearchResult[]=[];
  for(const row of Array.isArray(data.result?.results)?data.result.results:[])for(const resource of Array.isArray(row.resources)?row.resources:[]){
   const url=safe(resource.url);if(!url)continue;
   const format=String(resource.format??'').toUpperCase();if(format&&!['CSV','TSV','HTML','TXT','TEXT','TEXT/CSV','TEXT/HTML'].includes(format))continue;
   const dataset:DatasetIdentity={id:String(row.id??row.name??'').slice(0,200),publisher:row.organization?.title?String(row.organization.title).slice(0,200):null,version:row.version?String(row.version).slice(0,80):null,date:row.metadata_modified?String(row.metadata_modified).slice(0,40):null,schema:format?[format]:[],resourceUrl:url,related:[],discoveryOnly:true};
   results.push(result(this.client,q,this.kind,u.href,url,String(row.title??resource.name??''),dataset));
  }
  return {results:results.slice(0,limit).map((r,i)=>{const{fingerprint,...raw}=r;return {...raw,rank:i+1,fingerprint:jsonHash({...raw,rank:i+1})};}),diagnostic:results.length?null:'CKAN_NO_TEXTUAL_RESOURCE',latencyMs:this.client.env.now()-start};
 }catch(e){return {results:[],diagnostic:'CKAN_UNAVAILABLE '+String(e),latencyMs:this.client.env.now()-start};}}
}
