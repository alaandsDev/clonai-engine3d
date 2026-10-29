from pathlib import Path
import json
for kind in ['cold','population']:
 data=json.loads(Path(f'examples/research/web-v3-{kind}-request.json').read_text(encoding='utf-8'))
 data['request']['id']=data['request']['id'].replace('-v3','-v4');data['request']['sourcePolicy']['researchVersion']=4
 data['web']['v2']['strategies']=[s for s in data['web']['v2']['strategies'] if s!='OPENALEX_ACADEMIC_SEARCH']
 data['web']['v4']={'providers':['MEDIAWIKI_REFERENCE_SEARCH','REFERENCE_FOLLOWING','WIKIDATA_ENTITY_DISCOVERY','CROSSREF_WORKS_SEARCH','DATACITE_DATASET_SEARCH','CKAN_DATASET_SEARCH'],'bootstrapFetches':6 if kind=='cold' else 4,'maxAttemptsPerGap':4,'maxFetchesPerStrategy':2,'maxFamiliesPerRound':4 if kind=='cold' else 3,'maxFailedFamilyAttempts':1,'dataCiteEndpoint':'https://api.datacite.org/dois','ckanEndpoint':'https://data.gov.uk/api/action/package_search'}
 Path(f'examples/research/web-v4-{kind}-request.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
