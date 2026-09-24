export function readiness({diagnostic=0, mastery=0, mock=0, recency=0, unresolvedWeakAreas=0}={}) {
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const base=clamp(diagnostic)*0.15+clamp(mastery)*0.35+clamp(mock)*0.35+clamp(recency)*0.15;
  const penalty=Math.min(30,Math.max(0,Number(unresolvedWeakAreas)||0)*3);
  const score=Math.round(Math.max(0,base-penalty));
  return {score, factors:{diagnostic:clamp(diagnostic),mastery:clamp(mastery),mock:clamp(mock),recency:clamp(recency),unresolvedWeakAreas:Math.max(0,Number(unresolvedWeakAreas)||0)}, disclaimer:"Preparation readiness indicator; not a guarantee of passing an external examination."};
}

export function nextTutorAction({correct,confidence=1,attempts=1}={}) {
  if(correct && confidence>=0.75) return "advance";
  if(attempts>=2) return "tutor-video";
  if(confidence<0.5) return "teach-from-scratch";
  return "explain-this";
}
