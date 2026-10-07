export type BuilderIssue={number:number;title:string;body?:string;state:'open'|'closed';html_url?:string};
export type QueueClassification={priority:number;risk:'low'|'medium'|'high';workerId:string;dependencyIds:string[];humanGate?:string};

const SEED:Record<number,QueueClassification>={
  359:{priority:100,risk:'medium',workerId:'portfolio-orchestrator',dependencyIds:[],humanGate:'infrastructure_change'},
  367:{priority:99,risk:'low',workerId:'task-dispatcher',dependencyIds:["359"],},
  335:{priority:95,risk:'low',workerId:'portfolio-orchestrator',dependencyIds:["367"]},
  338:{priority:90,risk:'medium',workerId:'repo-worker',dependencyIds:["359"],humanGate:'registry_change'},
  337:{priority:89,risk:'high',workerId:'provision-worker',dependencyIds:["336","338"],humanGate:'domain_registration'},
  336:{priority:88,risk:'high',workerId:'provision-worker',dependencyIds:["338"],humanGate:'domain_registration'},
  201:{priority:80,risk:'low',workerId:'state-reconciler',dependencyIds:["335","367"]},
  113:{priority:70,risk:'low',workerId:'seo-worker',dependencyIds:["201"],humanGate:'site_publish'},
  319:{priority:65,risk:'low',workerId:'attribution-worker',dependencyIds:[]},
  385:{priority:60,risk:'high',workerId:'crm-worker',dependencyIds:[],humanGate:'institutional_contract'}
};

export function classifyBuilderIssue(issue:BuilderIssue):QueueClassification{
 const seeded=SEED[issue.number]; if(seeded)return seeded;
 const text=`${issue.title} ${issue.body??''}`.toLowerCase();
 if(/payment|refund|settlement|purchase|charge/.test(text))return{priority:50,risk:'high',workerId:'payment-worker',dependencyIds:[],humanGate:'payment_release'};
 if(/dns|domain|registrar|tls|ssl/.test(text))return{priority:50,risk:'medium',workerId:'dns-worker',dependencyIds:[],humanGate:'infrastructure_change'};
 if(/deploy|production|release/.test(text))return{priority:50,risk:'high',workerId:'deployment-worker',dependencyIds:[],humanGate:'production_deploy'};
 if(/security|credential|secret|privacy/.test(text))return{priority:50,risk:'high',workerId:'vulnerability-worker',dependencyIds:[]};
 if(/seo|landing|marketing|content/.test(text))return{priority:40,risk:'low',workerId:'seo-worker',dependencyIds:[]};
 if(/test|qa|build|code|bug/.test(text))return{priority:40,risk:'low',workerId:'build-worker',dependencyIds:[]};
 return{priority:30,risk:'low',workerId:'workspace-worker',dependencyIds:[]};
}

export async function discoverBuilderQueue(fetcher:typeof fetch=fetch):Promise<BuilderIssue[]>{
 const response=await fetcher('https://api.github.com/repos/bevanshelton-netizen/izakhono-builder/issues?state=open&per_page=100',{headers:{accept:'application/vnd.github+json','user-agent':'izakhono-builder-supervisor'}});
 if(!response.ok)throw new Error(`Builder queue discovery failed: ${response.status}`);
 const items=await response.json() as Array<{number:number;title:string;body?:string|null;state:string;html_url?:string;pull_request?:unknown}>;
 return items.filter(i=>!i.pull_request).map(i=>({number:i.number,title:i.title,body:i.body??undefined,state:i.state==='closed'?'closed':'open',html_url:i.html_url}));
}

export function shouldIngest(issue:BuilderIssue){return issue.state==='open';}
