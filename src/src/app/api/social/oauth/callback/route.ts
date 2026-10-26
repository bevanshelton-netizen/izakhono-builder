import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCode, hashToken } from '@/lib/social/oauth'

export const runtime = 'nodejs'

function admin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) throw new Error('Server-side Supabase credentials are not configured')
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
}

function encrypt(value:string){
  const keyHex=process.env.SOCIAL_OAUTH_ENCRYPTION_KEY
  if(!keyHex||!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error('SOCIAL_OAUTH_ENCRYPTION_KEY must be a 32-byte hex key')
  const crypto=require('node:crypto') as typeof import('node:crypto')
  const key=Buffer.from(keyHex,'hex')
  const iv=crypto.randomBytes(12)
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv)
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()])
  const tag=cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export async function GET(request:NextRequest){
  const url=new URL(request.url)
  const code=url.searchParams.get('code')
  const state=url.searchParams.get('state')
  const providerError=url.searchParams.get('error')
  if(!state) return NextResponse.redirect(new URL('/channels?oauth=missing_state',url.origin))

  const db=admin()
  const {data:session,error:sessionError}=await db.from('social_oauth_sessions').select('id,owner_id,workspace_id,platform,redirect_uri,status,expires_at').eq('state',state).maybeSingle()
  if(sessionError||!session) return NextResponse.redirect(new URL('/channels?oauth=invalid_state',url.origin))
  if(session.status!=='pending'||new Date(session.expires_at).getTime()<Date.now()){
    await db.from('social_oauth_sessions').update({status:'expired'}).eq('id',session.id)
    return NextResponse.redirect(new URL('/channels?oauth=expired',url.origin))
  }
  if(providerError||!code){
    await db.from('social_oauth_sessions').update({status:'failed',completed_at:new Date().toISOString()}).eq('id',session.id)
    return NextResponse.redirect(new URL(`/channels?oauth=provider_error`,url.origin))
  }

  try{
    const token=await exchangeCode(session.platform,code,session.redirect_uri)
    const access=typeof token.access_token==='string'?token.access_token:null
    const refresh=typeof token.refresh_token==='string'?token.refresh_token:null
    if(!access) throw new Error('Provider returned no access token')
    const expiresIn=typeof token.expires_in==='number'?token.expires_in:null
    const tokenExpiresAt=expiresIn?new Date(Date.now()+expiresIn*1000).toISOString():null
    const {error:updateError}=await db.from('social_channel_connectors').update({status:'connected',error_message:null,last_checked_at:new Date().toISOString(),access_token_ciphertext:encrypt(access),refresh_token_ciphertext:refresh?encrypt(refresh):null,token_expires_at:tokenExpiresAt,token_hash:hashToken(access),scopes:typeof token.scope==='string'?token.scope.split(/[ ,]+/).filter(Boolean):undefined,updated_at:new Date().toISOString()}).eq('owner_id',session.owner_id).eq('workspace_id',session.workspace_id).eq('platform',session.platform)
    if(updateError) throw new Error(updateError.message)
    await db.from('social_oauth_sessions').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',session.id)
    return NextResponse.redirect(new URL(`/channels?oauth=connected&platform=${encodeURIComponent(session.platform)}`,url.origin))
  }catch(error){
    const message=error instanceof Error?error.message:'OAuth exchange failed'
    await db.from('social_oauth_sessions').update({status:'failed',completed_at:new Date().toISOString()}).eq('id',session.id)
    await db.from('social_channel_connectors').update({status:'error',error_message:message,updated_at:new Date().toISOString()}).eq('owner_id',session.owner_id).eq('workspace_id',session.workspace_id).eq('platform',session.platform)
    return NextResponse.redirect(new URL('/channels?oauth=failed',url.origin))
  }
}
