export const serviceContracts = Object.freeze({
  search:{capabilities:['web_search','local_discovery','content_discovery'],readOnly:true},
  connecta:{capabilities:['profiles','feed','communities','messaging'],readOnly:false},
  ai:{capabilities:['reasoning','generation','automation'],readOnly:false},
  cloud:{capabilities:['storage','documents','workspace'],readOnly:false},
  commerce:{capabilities:['catalog','orders','payments'],readOnly:false},
  nav:{capabilities:['navigation','safety','fleet','offline'],readOnly:false},
  fortress:{capabilities:['identity','policy','audit','threat_detection'],readOnly:false}
});

export function resolveService(slug){
  const contract=serviceContracts[slug];
  if(!contract) return null;
  return {slug,apiVersion:'v1',policyClass:'foundation',enabled:true,...contract};
}

export function supports(slug,capability){
  return Boolean(serviceContracts[slug]?.capabilities.includes(capability));
}
