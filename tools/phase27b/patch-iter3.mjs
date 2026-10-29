import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/assemblies.tsx',[
 [`fillOffset: Vec3 = [0, -open * 0.3, open * 1.6]`,`fillOffset: Vec3 = [0, -open * open * 7, open * 2.6]`],
 [`color={c} opacity={1 - open} offset={fillOffset} />)}
            <Range x={[-g.hw, g.hw]} y={[g.y0, g.y0 + 0.07]} z={[g.cutZ, g.z1]} color={grass} opacity={1 - open} offset={fillOffset} /></>}`,`color={c} offset={fillOffset} />)}
            <Range x={[-g.hw, g.hw]} y={[g.y0, g.y0 + 0.07]} z={[g.cutZ, g.z1]} color={grass} offset={fillOffset} /></>}`],
 [`const front = h ? Math.max(0, Math.min(1, style.cut ?? 0)) : 0;`,`const front = h ? Math.max(0, Math.min(1, (style.cut ?? 0) / 0.3)) : 0;`],
 [`water = tint(PALETTE.WATER, highlight), t = ctx.frame / ctx.fps;`,`water = highlight > 0 ? '#' + new Color(PALETTE.WATER).lerp(new Color('#4fb4ff'), Math.min(1, highlight * 4)).getHexString() : PALETTE.WATER, t = ctx.frame / ctx.fps;`]]);
edit('src/visual-causal/planner.ts',[[`WORLD:cam([-1.5,2.2,8.4],[0.35,0.8,-0.5]),SYSTEM:cam([0.7,1.6,6.2],[-0.5,0.85,-0.1])`,`WORLD:cam([-1.3,1.8,7.6],[0.35,0.8,-0.5]),SYSTEM:cam([0.6,1.45,5.5],[-0.5,0.95,-0.1])`]]);
