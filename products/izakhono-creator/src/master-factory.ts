export type MasterAspect = '16:9'|'9:16'|'1:1'|'4:5';
export type MasterShot = { shotIndex?:number; assetId:string; kind:string; url?:string; provider?:string; durationSeconds?:number|null };
export type MasterTimeline = { schema:'izakhono.creator/timeline-v1'; fps:number; shots:MasterShot[] };
export type MasterDerivative = { id:string; aspect:MasterAspect; purpose:'master'|'social'|'thumbnail'; width:number; height:number; format:'mp4'|'jpg'; status:'planned'; sourceShotIds:string[] };
const dimensions:Record<MasterAspect,{width:number;height:number}>={
  '16:9':{width:1920,height:1080},
  '9:16':{width:1080,height:1920},
  '1:1':{width:1080,height:1080},
  '4:5':{width:1080,height:1350}
};
export function compileMasterFactory(timeline:MasterTimeline){
  const ordered=[...timeline.shots].sort((a,b)=>(a.shotIndex??999999)-(b.shotIndex??999999));
  const complete=ordered.length>0&&ordered.every(s=>Boolean(s.url));
  const totalDurationSeconds=ordered.reduce((sum,s)=>sum+(s.durationSeconds??0),0);
  const derivatives:MasterDerivative[]=(['16:9','9:16','1:1','4:5'] as MasterAspect[]).map((aspect,i)=>{const d=dimensions[aspect];return{id:`master_${aspect.replace(':','x')}_${i+1}`,aspect,purpose:aspect==='16:9'?'master':aspect==='9:16'?'social':'social',width:d.width,height:d.height,format:'mp4',status:'planned',sourceShotIds:ordered.map(s=>s.assetId)}});
  derivatives.push({id:'thumbnail_16x9',aspect:'16:9',purpose:'thumbnail',width:1280,height:720,format:'jpg',status:'planned',sourceShotIds:ordered.length?[ordered[Math.min(1,ordered.length-1)].assetId]:[]});
  return {schema:'izakhono.creator/master-factory-v1',complete,shotCount:ordered.length,totalDurationSeconds,timeline:{...timeline,shots:ordered},audio:{sync:'timeline',mix:'planned',lufsTarget:-14},derivatives};
}
