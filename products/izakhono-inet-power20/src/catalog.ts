import type { ServiceManifest } from './types.js';

export const power20: ServiceManifest[] = [
  ['search','I-NET Search','information','/search',['web','inet','news','images','video','commerce'],['read:profile'],['preferences'],'personal'],
  ['ai','IZAKHONO AI','ai','/ai',['agents','memory','automation'],['read:profile','read:files'],['identity','preferences','business'],'restricted'],
  ['mail','IZAKHONO Mail','communications','/mail',['mail','anti-phishing','translation'],['read:mail','send:mail'],['communications','identity'],'sensitive'],
  ['cloud','IZAKHONO Cloud','storage','/cloud',['sync','sharing','recovery'],['read:files','write:files'],['business','media'],'sensitive'],
  ['docs','IZAKHONO Documents','productivity','/docs',['collaboration','research','ai-editing'],['read:files','write:files'],['business'],'personal'],
  ['sheets','IZAKHONO Sheets','productivity','/sheets',['calculation','forecasting','automation'],['read:files','write:files'],['business'],'personal'],
  ['slides','IZAKHONO Presentations','productivity','/slides',['storytelling','design','data-visualisation'],['read:files','write:files'],['business','media'],'personal'],
  ['calendar','IZAKHONO Calendar','productivity','/calendar',['scheduling','travel','workflow'],['read:calendar','write:calendar'],['identity','business','location'],'sensitive'],
  ['contacts','IZAKHONO Contacts','identity','/contacts',['relationship-management','deduplication'],['read:contacts','write:contacts'],['identity','preferences'],'sensitive'],
  ['maps','IZAKHONO NAV','mobility','/maps',['navigation','safety','offline','road-intelligence'],['read:location'],['location','security'],'restricted'],
  ['browser','I-NET Browser','web','/browser',['inet','internet','privacy-controls'],['read:profile'],['preferences'],'personal'],
  ['video','KORA NETWORK','media','/video',['watch','publish','discover'],['read:media','publish:media'],['media','preferences'],'personal'],
  ['music','Allegro','media','/music',['stream','discover','creator-tools'],['read:media','publish:media'],['media','payments'],'personal'],
  ['meet','IZAKHONO Meet','communications','/meet',['video','audio','transcripts'],['read:profile','read:files'],['communications','business'],'sensitive'],
  ['chat','IZAKHONO Chat','communications','/chat',['messages','channels','collaboration'],['read:contacts','read:files'],['communications','identity'],'sensitive'],
  ['work','IZAKHONO WORK','business','/work',['projects','crm','workflow','documents'],['read:business','write:business'],['business','communications'],'sensitive'],
  ['enterprise','IZAKHONO Enterprise','enterprise','/enterprise',['teams','approvals','administration'],['read:business','write:business'],['business','identity','security'],'restricted'],
  ['id','IZAKHONO ID','identity','/id',['identity','permissions','portability'],['read:profile','write:profile'],['identity','security'],'restricted'],
  ['fortress','FORTRESS','security','/fortress',['zero-trust','threat-detection','audit'],['read:profile'],['security','identity'],'restricted'],
  ['developer','I-NET Developer Cloud','platform','/developers',['apis','sdk','sandbox','registry'],['read:business','write:business'],['business','security'],'restricted'],
].map(([id,name,category,route,capabilities,permissions,dataDomains,privacyClass]) => ({
  id, name, category, version: '1.0.0', route,
  capabilities: capabilities as string[],
  permissions: permissions as ServiceManifest['permissions'],
  dataDomains: dataDomains as ServiceManifest['dataDomains'],
  privacyClass: privacyClass as ServiceManifest['privacyClass'],
  ownedFirst: true,
  externalAdaptersReplaceable: true,
}));

export function getService(id: string) {
  return power20.find(service => service.id === id);
}
