import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {writeTopic,validateWriterResult} from '../src/writer';
import {resolveSafeOutputPath} from '../src/engine3d/paths';
const file=process.argv[2];if(!file)throw Error('Usage: writer input.json [--out directory]');const i=process.argv.indexOf('--out'),root=path.resolve(i>=0?process.argv[i+1]:'out/engine3d/writer'),request=JSON.parse(await readFile(file,'utf8')),result=writeTopic(request);validateWriterResult(result);await mkdir(root,{recursive:true});await writeFile(resolveSafeOutputPath(root,request.id+'-writer','.json'),JSON.stringify(result,null,2));if(result.finalCandidate)await writeFile(resolveSafeOutputPath(root,request.id+'-script','.txt'),result.finalCandidate.script);console.log(result.status,result.selection.selectedCandidateId??'',result.fingerprint);
