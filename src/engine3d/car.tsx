import React from 'react';
import { Color } from 'three';
import type { Vec3 } from './contracts';
import { carStates } from './demonstration-contracts';
const Cube = ({ at, size, color, opacity = 1 }: {
    at: Vec3;
    size: Vec3;
    color: string;
    opacity?: number;
}) => <mesh position={at}><boxGeometry args={size}/><meshToonMaterial color={color} transparent={opacity < 1} opacity={opacity}/></mesh>;
/** One low-poly unbranded resource; 12 bounded surface frost patches, no particle emitter. */
export function CarGeometry({ frost = 0 }: {
    frost?: number;
}) {
    const palette = frost <= .45 ? [carStates[0], carStates[1], frost / .45] as const : [carStates[1], carStates[2], (frost - .45) / .55] as const;
    const body = '#' + new Color(palette[0].visualModifiers.tint).lerp(new Color(palette[1].visualModifiers.tint), palette[2]).getHexString(), glass = '#' + new Color('#326b85').lerp(new Color('#9bc5d6'), frost).getHexString();
    return <><Cube at={[0, .65, 0]} size={[3.2, .7, 1.4]} color={body}/><Cube at={[-.15, 1.22, 0]} size={[1.65, .65, 1.25]} color={body}/>
 <Cube at={[-.15, 1.3, .636]} size={[1.38, .4, .03]} color={glass}/><Cube at={[-.15, 1.3, -.636]} size={[1.38, .4, .03]} color={glass}/>
 <Cube at={[.71, 1.28, 0]} size={[.035, .43, 1.08]} color={glass}/><Cube at={[-1.01, 1.28, 0]} size={[.035, .43, 1.08]} color={glass}/>
 {[-1.05, 1.05].flatMap(x => [-.68, .68].map(z => <mesh key={x + ':' + z} position={[x, .35, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.35, .35, .18, 12]}/><meshToonMaterial color={frost > .8 ? '#6b91a3' : '#192330'}/></mesh>))}
 {[-1, 1].map(side => <Cube key={side} at={[side * 1.61, .72, 0]} size={[.04, .17, 1.1]} color={side === 1 ? '#fff4b4' : '#b53832'}/>)}
 {Array.from({ length: 12 }, (_, i) => { const row = Math.floor(i / 4), col = i % 4, x = -1.14 + col * .74, z = (row - 1) * .47, threshold = i / 16, amount = Math.max(0, Math.min(1, (frost - threshold) * 3)); return amount > 0 ? <Cube key={i} at={[x, (Math.abs(x) < .8 ? 1.57 : 1.03) + amount * .025, z]} size={[.62, .04 + amount * .08, .42]} color="#f7feff" opacity={amount}/> : null; })}</>;
}
