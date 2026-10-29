import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/library.tsx',[
 [`import {Color} from 'three';`,`import {Color} from 'three';
import {StylizedBackdrop,ContactShadow,PALETTE,type EnvironmentStyle} from './assemblies';`],
 [`export function Environment({ id, state }: { id: string;state?:EnvironmentState }) {`,`export function Environment({ id, state, style }: { id: string;state?:EnvironmentState;style?:EnvironmentStyle }) {`],
 [`      <ambientLight intensity={1.3} />`,`      <ambientLight intensity={style?0.55:1.3} />`],
 [`      {(state?.groundCutaway??0)>0?<>`,`      {style?<StylizedBackdrop style={style} ground={'#'+new Color(PALETTE.GRASS).multiply(new Color(state?.tint??'#ffffff')).getHexString()} sky={['#7fb8e6','#e6f2ec']}/>:(state?.groundCutaway??0)>0?<>`],
 [`            <group key={n} position={[x, 0, z]}>
              <Box at={[0, 1, 0]} size={[0.18, 2, 0.18]} color="#5f7274" />`,`            <group key={n} position={[x, 0, z]}>
              {style&&<ContactShadow at={[0,0,0]} radius={0.85}/>}
              <Box at={[0, 1, 0]} size={[0.18, 2, 0.18]} color={style?"#6b4f3a":"#5f7274"} />`]]);
edit('src/engine3d/renderer.tsx',[
 [`worldExtras,environmentState }: { shot: ShotSpec;`,`worldExtras,environmentState,environmentStyle }: { shot: ShotSpec;`],
 [`worldExtras?:React.ReactNode;environmentState?:EnvironmentState }) {`,`worldExtras?:React.ReactNode;environmentState?:EnvironmentState;environmentStyle?:EnvironmentStyle }) {`],
 [`<Environment id={shot.environment.resourceId} state={environmentState}/>`,`<Environment id={shot.environment.resourceId} state={environmentState} style={environmentStyle}/>`],
 [`          <Character key={i.instanceId} instance={i} shot={shot} t={t} directedPose={directed?.poses[i.instanceId]}/>`,`          <React.Fragment key={i.instanceId}>{environmentStyle&&directed?.poses[i.instanceId]&&<ContactShadow at={[directed.poses[i.instanceId].position[0],0,directed.poses[i.instanceId].position[2]]} radius={0.42*(i.scale?.[0]??1)} opacity={0.3}/>}<Character instance={i} shot={shot} t={t} directedPose={directed?.poses[i.instanceId]}/></React.Fragment>`],
 [`import type {EnvironmentState} from './demonstration-contracts';`,`import type {EnvironmentState} from './demonstration-contracts';
import {ContactShadow,type EnvironmentStyle} from './assemblies';`]]);
