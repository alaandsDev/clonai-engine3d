"""Carry the previous benchmark topics/policies forward; no factual seeds or prepared sources."""
import json
from pathlib import Path
for kind,old,new in [('cold','web-v2-cold-request','web-v3-cold-request'),('population','web-v2-population-request','web-v3-population-request')]:
 data=json.loads(Path('examples/research',old+'.json').read_text(encoding='utf-8-sig'))
 request,web=data['request'],data['web'];request['id']=request['id'].replace('-v2','-v3');request['sourcePolicy']['researchVersion']=3
 if kind=='cold':
  # A documented observation site can provide the measurement; it does not become a settlement.
  request['sourcePolicy']['observationSitePolicy']='SOURCED_OBSERVATION_SITE'
  web.update(maxQueries=48,maxSearchResults=120,maxCandidateSources=48,maxFetchedSources=48,maxResearchRounds=4)
  web['v2']['budgets']={'broadDiscovery':8,'originDiscovery':18,'verification':8,'corroboration':10,'entityExpansion':4}
  web['v2']['candidatePoolTarget']=15
 else:
  web.update(maxQueries=24,maxSearchResults=72,maxFetchedSources=24)
  web['v2']['budgets']['entityExpansion']=2
 for strategy in ['CROSSREF_WORKS_SEARCH','PUBLISHER_LINK_FOLLOWING']:
  if strategy not in web['v2']['strategies']:web['v2']['strategies'].append(strategy)
 web['v2']['maxDatasetBytes']=8388608
 web['v2']['maxPublisherLinksPerSource']=2
 assert request['sourcePolicy']['minIndependentSources']==2
 assert all(q['minIndependentOrigins']==2 for q in request['sourcePolicy']['factTypeQuorum'].values())
 assert not set(request)&{'sources','entities','claims','script','ranking','sourceMaterial'}
 Path('examples/research',new+'.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(new+': same topic/metric/criterion/quorum, v3 and bounded discovery budgets only')
