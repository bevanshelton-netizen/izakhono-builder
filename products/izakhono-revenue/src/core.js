export const CREATOR_PLATFORM_FEE_BPS=1000;

export function creatorSplit(grossMinor,{feeBps=CREATOR_PLATFORM_FEE_BPS}={}){
  const gross=Number(grossMinor),bps=Number(feeBps);
  if(!Number.isInteger(gross)||gross<0)throw new Error('grossMinor must be a non-negative integer');
  if(!Number.isInteger(bps)||bps<0||bps>10000)throw new Error('feeBps must be between 0 and 10000');
  const platform=Math.round(gross*bps/10000);
  return {gross_minor:gross,platform_fee_minor:platform,creator_minor:gross-platform,fee_bps:bps};
}

export function classifyRevenue(input={}){
  const kind=String(input.kind||'').trim();
  if(['radio_advertising','show_sponsorship','platform_subscription','academy_fee','platform_service'].includes(kind)){
    return {beneficial_owner:'izakhono',creator_split:false};
  }
  if(['creator_royalty','creator_booking','creator_marketplace','creator_content_revenue','creator_sponsorship_share'].includes(kind)){
    return {beneficial_owner:'creator',creator_split:true};
  }
  return {beneficial_owner:'review',creator_split:false};
}

export function canOverrideCreatorFee({agreementReference,approved=false}={}){
  return Boolean(approved&&String(agreementReference||'').trim().length>=3);
}

export function bookingTransition(current,next){
  const graph={
    submitted:['accepted','rejected','cancelled'],
    accepted:['in_progress','cancelled'],
    in_progress:['delivered','cancelled'],
    delivered:['closed'],
    rejected:[],closed:[],cancelled:[]
  };
  if(!graph[current]?.includes(next))throw new Error(`Invalid booking transition: ${current} -> ${next}`);
  return next;
}
