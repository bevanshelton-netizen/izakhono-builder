import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { buildAuthorizationUrl, SOCIAL_PLATFORMS } from '@/lib/social/oauth'

export const runtime='nodejs'

function admin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) throw new Error('Server-side Supabase credentials are not configured')
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
}

export async function POST(request:NextRequest){
  try{
    const authorization=request.headers.get('authorization')
    const accessToken=authorization?.startsWith('Bearer ')?authorization.slice(7):''
    if(!accessToken) return NextResponse.json({error:'Authentication required'},{status:401})
    const body=await request.json().catch(()=>({})) as {platform?:string;workspaceId?:string}
    if(!body.platform||!SOCIAL_PLATFORMS.includes(body.platform as (typeof SOCIAL_PLATFORMS)[number])||!body.workspaceId) return NextResponse.json({error:'Valid platform and workspaceId are required'},{status:400})

    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!supabaseUrl||!publishableKey) throw new Error('Supabase public configuration is missing')
    const authClient=createClient(supabaseUrl,publishableKey,{auth:{autoRefreshToken:false,persistSession:false}})
    const {data:{user},error:userError}=await authClient.auth.getUser(accessToken)
    if(userError||!user) return NextResponse.json({error:'Invalid authentication token'},{status:401})

    const db=admin()
    const {data:workspace}=await db.from('social_workspaces').select('id').eq('id',body.workspaceId).eq('owner_id',user.id).maybeSingle()
    if(!workspace) return NextResponse.json({error:'Workspace not found'},{status:404})

    const state=crypto.randomBytes(32).toString('base64url')
    const base=process.env.SOCIAL_OAUTH_BASE_URL||new URL(request.url).origin
    const redirectUri=`${base}/api/social/oauth/callback`
    const {error:sessionError}=await db.from('social_oauth_sessions').insert({owner_id:user.id,workspace_id:workspace.id,platform:body.platform,state,status:'pending',redirect_uri:redirectUri})
    if(sessionError) throw new Error(sessionError.message)
    const {error:connectorError}=await db.from('social_channel_connectors').upsert({owner_id:user.id,workspace_id:workspace.id,platform:body.platform,display_name:body.platform[0].toUpperCase()+body.platform.slice(1),status:'pending',error_message:null,updated_at:new Date().toISOString()},{onConflict:'workspace_id,platform,account_external_id',ignoreDuplicates:false})
    if(connectorError) throw new Error(connectorError.message)
    return NextResponse.json({authorizationUrl:buildAuthorizationUrl(body.platform,state,redirectUri)})
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Unable to start OAuth'},{status:500})
  }
}
