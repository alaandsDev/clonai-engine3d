import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/visual-causal/compile.ts',[[`   const lead=b.presenterIntent==='REVEAL_SYSTEM'?Math.min(12,Math.round(len*0.15)):0,`,`   const lead=b.presenterIntent==='REVEAL_SYSTEM'?Math.min(12,Math.round(len*0.15)):b.presenterIntent==='POINT_TO_SYSTEM'&&b.presenterVisible?Math.min(6,Math.round(len*0.1)):0,`]]);
