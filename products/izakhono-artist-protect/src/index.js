import {clearance,contractRisk,registrationTasks,requiredContracts,survivalPlan,validateSplits} from './core.js';

const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const fail=(m,s=400,c='bad_request')=>json({ok:false,error:{code:c,message:m}},s);
const id=p=>`${p}_${crypto.randomUUID().replaceAll('-','')}`;
const clean=(v,n=255)=>typeof v==='string'?v.trim().slice(0,n):'';

async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function authorize(req,env){
  const slug=clean(req.headers.get('x-izakhono-app'),60).toLowerCase();
  const key=clean(req.headers.get('x-izakhono-key'),512);
  const userRef=clean(req.headers.get('x-izakhono-user'),160);
  if(!slug||!key||!userRef)return null;
  const hash=await sha256(key);
  const app=await env.DB.prepare("SELECT slug,display_name FROM artist_protect_apps WHERE slug=? AND api_key_hash=? AND status='active'").bind(slug,hash).first();
  return app?{app,userRef}:null;
}
function admin(req,env){return Boolean(env.ADMIN_SECRET&&req.headers.get('x-admin-secret')===env.ADMIN_SECRET);}
async function body(req){if(!(req.headers.get('content-type')||'').includes('application/json'))throw new Error('Expected application/json');return req.json();}
async function profileFor(env,slug,userRef){
  return env.DB.prepare('SELECT * FROM creator_profiles WHERE app_slug=? AND user_ref=?').bind(slug,userRef).first();
}
async function audit(env,{creatorId=null,workId=null,contractId=null,type,detail='',hash=null}){
  await env.DB.prepare('INSERT INTO protection_events(id,creator_id,work_id,contract_id,event_type,detail,evidence_sha256) VALUES(?,?,?,?,?,?,?)')
    .bind(id('evt'),creatorId,workId,contractId,type,String(detail).slice(0,1000),hash).run();
}
function passportSummary(profile,works,contracts,disputes){
  const openDisputes=(disputes||[]).filter(x=>['open','under_review','legal_hold'].includes(x.status)).length;
  const lawyerRequired=(contracts||[]).filter(x=>x.status==='lawyer_required').length;
  const blockedWorks=(works||[]).filter(x=>['blocked','disputed','takedown'].includes(x.release_status)).length;
  return {
    identity_verified:Boolean(profile?.identity_verified),
    works_total:(works||[]).length,
    blocked_works:blockedWorks,
    open_disputes:openDisputes,
    lawyer_required_contracts:lawyerRequired,
    protection_status:!profile?.identity_verified?'identity_required':openDisputes||lawyerRequired||blockedWorks?'attention_required':'protected'
  };
}

export default {
  async fetch(req,env){
    const url=new URL(req.url);
    try{
      if(url.pathname==='/api/health')return json({ok:true,service:'IZAKHONO ARTIST PROTECT',version:'0.1.0',env:env.APP_ENV||'production'});
      if(url.pathname==='/api/admin/apps'&&req.method==='POST'){
        if(!admin(req,env))return fail('Unauthorized',401,'unauthorized');
        const x=await body(req),slug=clean(x.slug,60).toLowerCase(),name=clean(x.display_name,120),key=clean(x.api_key,512);
        if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!name||key.length<24)return fail('Valid slug, display name and API key of at least 24 characters are required',422);
        const hash=await sha256(key);
        await env.DB.prepare("INSERT INTO artist_protect_apps(slug,display_name,api_key_hash,status) VALUES(?,?,?,'active') ON CONFLICT(slug) DO UPDATE SET display_name=excluded.display_name,api_key_hash=excluded.api_key_hash,status='active',updated_at=CURRENT_TIMESTAMP")
          .bind(slug,name,hash).run();
        return json({ok:true,slug,api_key_hash:hash},201);
      }

      const auth=await authorize(req,env);
      if(!auth)return fail('Unauthorized app/user context',401,'unauthorized');

      if(url.pathname==='/api/me/profile'&&req.method==='POST'){
        const x=await body(req);
        const legal=clean(x.legal_name,160),stage=clean(x.stage_name,160),country=clean(x.country_code||'ZA',2).toUpperCase();
        const roles=Array.isArray(x.roles)?x.roles.map(v=>clean(v,60)).filter(Boolean).slice(0,20):[];
        if(!legal)return fail('Legal name is required',422);
        let p=await profileFor(env,auth.app.slug,auth.userRef);
        if(!p){
          const pid=id('creator');
          await env.DB.prepare("INSERT INTO creator_profiles(id,app_slug,user_ref,legal_name,stage_name,country_code,roles_json) VALUES(?,?,?,?,?,?,?)")
            .bind(pid,auth.app.slug,auth.userRef,legal,stage,country,JSON.stringify(roles)).run();
          p=await profileFor(env,auth.app.slug,auth.userRef);
          await audit(env,{creatorId:pid,type:'creator.created',detail:auth.app.slug});
        }else{
          await env.DB.prepare("UPDATE creator_profiles SET legal_name=?,stage_name=?,country_code=?,roles_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(legal,stage,country,JSON.stringify(roles),p.id).run();
          p=await profileFor(env,auth.app.slug,auth.userRef);
        }
        return json({ok:true,profile:p,registration_tasks:registrationTasks({roles})});
      }

      if(url.pathname==='/api/me/passport'&&req.method==='GET'){
        const p=await profileFor(env,auth.app.slug,auth.userRef);
        if(!p)return fail('Profile not found',404,'profile_not_found');
        const [w,c,d]=await Promise.all([
          env.DB.prepare('SELECT id,title,release_status FROM protected_works WHERE creator_id=? ORDER BY created_at DESC').bind(p.id).all(),
          env.DB.prepare('SELECT id,title,status,risk_score FROM protection_contracts WHERE creator_id=? ORDER BY created_at DESC').bind(p.id).all(),
          env.DB.prepare('SELECT d.* FROM rights_disputes d JOIN protected_works w ON w.id=d.work_id WHERE w.creator_id=? ORDER BY d.opened_at DESC').bind(p.id).all()
        ]);
        return json({ok:true,passport:passportSummary(p,w.results||[],c.results||[],d.results||[]),profile:p,works:w.results||[],contracts:c.results||[],disputes:d.results||[]});
      }

      if(url.pathname==='/api/tools/contract-risk'&&req.method==='POST'){
        const x=await body(req); return json({ok:true,risk:contractRisk(x||{})});
      }
      if(url.pathname==='/api/tools/required-contracts'&&req.method==='POST'){
        const x=await body(req); return json({ok:true,contracts:requiredContracts(x||{})});
      }
      if(url.pathname==='/api/tools/splits'&&req.method==='POST'){
        const x=await body(req); return json({ok:true,result:validateSplits(x.shares||[])});
      }
      if(url.pathname==='/api/tools/survival-plan'&&req.method==='POST'){
        const x=await body(req); return json({ok:true,plan:survivalPlan(x||{})});
      }
      if(url.pathname==='/api/tools/clearance'&&req.method==='POST'){
        const x=await body(req); return json({ok:true,clearance:clearance(x||{})});
      }

      if(url.pathname==='/api/me/works'&&req.method==='POST'){
        const p=await profileFor(env,auth.app.slug,auth.userRef); if(!p)return fail('Profile required',409,'profile_required');
        const x=await body(req),title=clean(x.title,200); if(!title)return fail('Title is required',422);
        const workId=id('work');
        await env.DB.prepare(`INSERT INTO protected_works(
          id,app_slug,creator_id,title,work_type,isrc,iswc,contains_samples,is_cover,involves_minor,ai_assisted
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(
          workId,auth.app.slug,p.id,title,clean(x.work_type||'sound_recording',60),clean(x.isrc,40)||null,clean(x.iswc,40)||null,
          x.contains_samples?1:0,x.is_cover?1:0,x.involves_minor?1:0,x.ai_assisted?1:0
        ).run();
        await audit(env,{creatorId:p.id,workId,type:'work.created',detail:title});
        return json({ok:true,id:workId,title,status:'draft'},201);
      }

      const split=url.pathname.match(/^\/api\/me\/works\/([^/]+)\/splits\/(composition|master)$/);
      if(split&&req.method==='POST'){
        const p=await profileFor(env,auth.app.slug,auth.userRef); if(!p)return fail('Profile required',409);
        const work=await env.DB.prepare('SELECT * FROM protected_works WHERE id=? AND creator_id=?').bind(split[1],p.id).first();
        if(!work)return fail('Work not found',404);
        const x=await body(req),shares=Array.isArray(x.shares)?x.shares:[];
        const check=validateSplits(shares); if(!check.ok)return fail(check.errors.join(','),422,'invalid_splits');
        await env.DB.prepare('DELETE FROM rights_shares WHERE work_id=? AND rights_lane=?').bind(work.id,split[2]).run();
        for(const s of shares){
          await env.DB.prepare('INSERT INTO rights_shares(id,work_id,rights_lane,party_id,party_name,role,share_bps,society_name,society_member_ref,evidence_ref) VALUES(?,?,?,?,?,?,?,?,?,?)')
            .bind(id('share'),work.id,split[2],clean(s.party_id,160),clean(s.party_name,160),clean(s.role,80),Number(s.share_bps),clean(s.society_name,100)||null,clean(s.society_member_ref,120)||null,clean(s.evidence_ref,500)||null).run();
        }
        await audit(env,{creatorId:p.id,workId:work.id,type:`splits.${split[2]}.updated`,detail:'10000 bps'});
        return json({ok:true,work_id:work.id,lane:split[2],total_bps:10000});
      }

      const dispute=url.pathname.match(/^\/api\/me\/works\/([^/]+)\/disputes$/);
      if(dispute&&req.method==='POST'){
        const p=await profileFor(env,auth.app.slug,auth.userRef); if(!p)return fail('Profile required',409);
        const work=await env.DB.prepare('SELECT * FROM protected_works WHERE id=? AND creator_id=?').bind(dispute[1],p.id).first();
        if(!work)return fail('Work not found',404);
        const x=await body(req),summary=clean(x.claim_summary,2000),lane=clean(x.disputed_lane,40);
        if(!summary||!['composition','master','performance','mechanical','platform','other'].includes(lane))return fail('Valid dispute lane and summary required',422);
        const did=id('dispute');
        await env.DB.prepare("INSERT INTO rights_disputes(id,work_id,opened_by,disputed_lane,disputed_party_id,disputed_share_bps,claim_summary,status,payout_hold_scope) VALUES(?,?,?,?,?,?,?,'open','disputed_share_only')")
          .bind(did,work.id,p.legal_name,lane,clean(x.disputed_party_id,160)||null,Number.isInteger(x.disputed_share_bps)?x.disputed_share_bps:null,summary).run();
        await env.DB.prepare("UPDATE protected_works SET release_status='disputed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(work.id).run();
        await audit(env,{creatorId:p.id,workId:work.id,type:'dispute.opened',detail:did});
        return json({ok:true,dispute_id:did,payout_hold_scope:'disputed_share_only'},201);
      }

      return fail('Not found',404,'not_found');
    }catch(e){return fail(e instanceof Error?e.message:'Unexpected error',500,'internal_error');}
  }
};
