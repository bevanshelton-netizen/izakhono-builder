export const CONTRACT_RED_FLAGS={
  copyright_assignment:5,
  master_assignment:5,
  perpetual_exclusivity:5,
  broad_360:4,
  unilateral_options:4,
  vague_royalty_base:4,
  cross_collateralisation:4,
  no_audit_right:3,
  broad_power_of_attorney:5,
  unlimited_indemnity:5,
  rerecord_restriction:3,
  no_termination_right:3
};

export function validateSplits(shares=[]){
  const errors=[];
  if(!Array.isArray(shares)||shares.length===0)return {ok:false,total_bps:0,errors:['missing_splits']};
  let total=0;
  const seen=new Set();
  for(const s of shares){
    const party=String(s.party_id||'').trim();
    const bps=Number(s.share_bps);
    if(!party)errors.push('missing_party');
    if(seen.has(party))errors.push('duplicate_party');
    seen.add(party);
    if(!Number.isInteger(bps)||bps<0||bps>10000)errors.push('invalid_share');
    else total+=bps;
  }
  if(total!==10000)errors.push('splits_must_equal_100_percent');
  return {ok:errors.length===0,total_bps:total,errors};
}

export function contractRisk(answers={}){
  const flags=[];
  let score=0;
  for(const [key,weight] of Object.entries(CONTRACT_RED_FLAGS)){
    if(answers[key]===true){flags.push(key);score+=weight;}
  }
  const level=score>=8?'lawyer_required':score>=4?'review_required':'standard_review';
  return {score,level,flags};
}

export function registrationTasks(profile={}){
  const roles=new Set(Array.isArray(profile.roles)?profile.roles:[]);
  const tasks=[];
  if(roles.has('writer')||roles.has('composer')||roles.has('publisher')){
    tasks.push({code:'samro',label:'Check SAMRO performing-rights membership/registration'});
    tasks.push({code:'capasso',label:'Check CAPASSO mechanical-rights membership/registration'});
  }
  if(roles.has('performer')||roles.has('featured_performer')||roles.has('session_performer')||roles.has('master_owner')||roles.has('record_company')){
    tasks.push({code:'sampra',label:'Check SAMPRA needletime/neighbouring-rights membership/registration'});
  }
  return tasks;
}

export function clearance(input={}){
  const blockers=[],review=[];
  if(!input.identity_verified)blockers.push('identity_not_verified');
  if(!input.master_owner_declared)blockers.push('master_owner_not_declared');

  const composition=validateSplits(input.composition_splits||[]);
  const master=validateSplits(input.master_splits||[]);
  if(!composition.ok)blockers.push('composition_splits_incomplete');
  if(!master.ok)blockers.push('master_splits_incomplete');
  if(input.required_contributor_signatures_complete!==true)blockers.push('contributor_signatures_incomplete');
  if(input.contains_samples&&!input.sample_clearance_complete)blockers.push('sample_clearance_missing');
  if(input.is_cover&&!input.cover_clearance_complete)blockers.push('cover_clearance_missing');
  if(input.involves_minor&&!input.guardian_approval_complete)blockers.push('minor_guardian_approval_missing');
  if(input.active_dispute)blockers.push('active_rights_dispute');
  if(!input.platform_licence_granted)blockers.push('platform_licence_missing');
  if(input.ai_generated_or_assisted&&!input.ai_source_disclosure_complete)review.push('ai_source_review');
  if(input.radio_requested&&!input.radio_clearance_confirmed)review.push('radio_clearance_required');

  return {
    status:blockers.length?'blocked':review.length?'review':'cleared',
    blockers,review,
    composition_splits:composition,
    master_splits:master
  };
}

export function survivalPlan(input={}){
  const tax=Number(input.tax_reserve_bps??1500);
  const emergency=Number(input.emergency_reserve_bps??1000);
  const reinvest=Number(input.reinvestment_bps??1000);
  for(const n of [tax,emergency,reinvest])if(!Number.isInteger(n)||n<0||n>10000)throw new Error('Reserve basis points must be integers from 0 to 10000');
  const reserved=tax+emergency+reinvest;
  if(reserved>10000)throw new Error('Reserve percentages cannot exceed 100%');
  return {
    tax_reserve_bps:tax,
    emergency_reserve_bps:emergency,
    reinvestment_bps:reinvest,
    available_bps:10000-reserved,
    disclaimer:'Tax reserve is a budgeting estimate, not a tax assessment or legal withholding instruction.'
  };
}

export const CONTRACT_LIBRARY=[
  {code:'songwriter-split',title:'Songwriter / Composer Split Agreement',risk:'standard_review',required_for:['co_written_composition']},
  {code:'producer-services',title:'Producer Services & Master Contribution Agreement',risk:'review_required',required_for:['producer']},
  {code:'featured-performer',title:'Featured Performer Agreement',risk:'review_required',required_for:['featured_performer']},
  {code:'session-performer',title:'Session Performer Consent & Release',risk:'standard_review',required_for:['session_performer']},
  {code:'platform-licence',title:'Limited IZAKHONO Platform Licence',risk:'standard_review',required_for:['platform_use']},
  {code:'sample-clearance',title:'Sample / Beat Clearance Licence',risk:'review_required',required_for:['sample_or_beat']},
  {code:'live-booking',title:'Live Performance / Booking Agreement',risk:'standard_review',required_for:['live_booking']},
  {code:'management-review',title:'Artist Management Agreement Guardrail',risk:'lawyer_required',required_for:['management']},
  {code:'minor-consent',title:'Parent / Guardian Consent',risk:'review_required',required_for:['minor']},
  {code:'dispute-notice',title:'Rights Dispute / Takedown Notice',risk:'standard_review',required_for:['dispute']}
];

export function requiredContracts(facts={}){
  const needs=new Set();
  if((facts.writer_count||0)>1)needs.add('songwriter-split');
  if(facts.producer)needs.add('producer-services');
  if(facts.featured_performer)needs.add('featured-performer');
  if(facts.session_performer)needs.add('session-performer');
  if(facts.platform_use!==false)needs.add('platform-licence');
  if(facts.sample_or_beat)needs.add('sample-clearance');
  if(facts.live_booking)needs.add('live-booking');
  if(facts.management)needs.add('management-review');
  if(facts.minor)needs.add('minor-consent');
  if(facts.dispute)needs.add('dispute-notice');
  return CONTRACT_LIBRARY.filter(x=>needs.has(x.code));
}
