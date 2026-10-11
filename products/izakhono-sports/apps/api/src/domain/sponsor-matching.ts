export type SponsorBrief={sport?:string; geography?:string; audience?:string; objective?:string; budget:number};
export type Inventory={id:string;sport?:string;geography?:string;audience?:string;objective?:string;price:number};
const hit=(a?:string,b?:string)=>!a||!b?0:a.toLowerCase()===b.toLowerCase()?1:0;
export function scoreSponsorMatch(s:SponsorBrief,i:Inventory){const score=100*(.20*hit(s.sport,i.sport)+.15*hit(s.geography,i.geography)+.25*hit(s.audience,i.audience)+.20*hit(s.objective,i.objective)+.20*(s.budget>=i.price?1:Math.max(0,1-(i.price-s.budget)/Math.max(i.price,1))));return Math.round(score*100)/100;}
