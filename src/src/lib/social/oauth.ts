import crypto from 'node:crypto'

export const SOCIAL_PLATFORMS = ['facebook','instagram','linkedin','youtube','tiktok','x','whatsapp'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

type ProviderConfig = { authorizeUrl:string; tokenUrl:string; clientId?:string; clientSecret?:string; scopes:string[]; pkce?:boolean }

const configs: Record<SocialPlatform, ProviderConfig> = {
  facebook: { authorizeUrl:'https://www.facebook.com/v24.0/dialog/oauth', tokenUrl:'https://graph.facebook.com/v24.0/oauth/access_token', clientId:process.env.META_CLIENT_ID, clientSecret:process.env.META_CLIENT_SECRET, scopes:['pages_show_list','pages_read_engagement','pages_manage_posts'] },
  instagram: { authorizeUrl:'https://www.facebook.com/v24.0/dialog/oauth', tokenUrl:'https://graph.facebook.com/v24.0/oauth/access_token', clientId:process.env.META_CLIENT_ID, clientSecret:process.env.META_CLIENT_SECRET, scopes:['instagram_basic','instagram_content_publish','pages_show_list'] },
  linkedin: { authorizeUrl:'https://www.linkedin.com/oauth/v2/authorization', tokenUrl:'https://www.linkedin.com/oauth/v2/accessToken', clientId:process.env.LINKEDIN_CLIENT_ID, clientSecret:process.env.LINKEDIN_CLIENT_SECRET, scopes:['openid','profile','w_member_social'] },
  youtube: { authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl:'https://oauth2.googleapis.com/token', clientId:process.env.GOOGLE_CLIENT_ID, clientSecret:process.env.GOOGLE_CLIENT_SECRET, scopes:['openid','profile','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.upload'] },
  tiktok: { authorizeUrl:'https://www.tiktok.com/v2/auth/authorize/', tokenUrl:'https://open.tiktokapis.com/v2/oauth/token/', clientId:process.env.TIKTOK_CLIENT_KEY, clientSecret:process.env.TIKTOK_CLIENT_SECRET, scopes:['user.info.basic','video.publish'] },
  x: { authorizeUrl:'https://twitter.com/i/oauth2/authorize', tokenUrl:'https://api.x.com/2/oauth2/token', clientId:process.env.X_CLIENT_ID, clientSecret:process.env.X_CLIENT_SECRET, scopes:['tweet.read','tweet.write','users.read','offline.access'], pkce:true },
  whatsapp: { authorizeUrl:'https://www.facebook.com/v24.0/dialog/oauth', tokenUrl:'https://graph.facebook.com/v24.0/oauth/access_token', clientId:process.env.META_CLIENT_ID, clientSecret:process.env.META_CLIENT_SECRET, scopes:['whatsapp_business_management','whatsapp_business_messaging'] },
}

export function getProvider(platform:string){
  if(!SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) throw new Error('Unsupported social platform')
  return configs[platform as SocialPlatform]
}

export function buildPkceVerifier(){ return crypto.randomBytes(32).toString('base64url') }
export function buildPkceChallenge(verifier:string){ return crypto.createHash('sha256').update(verifier).digest('base64url') }

export function buildAuthorizationUrl(platform:string, state:string, redirectUri:string, pkceVerifier?:string){
  const provider=getProvider(platform)
  if(!provider.clientId) throw new Error(`Provider credentials are not configured for ${platform}`)
  const url=new URL(provider.authorizeUrl)
  url.searchParams.set('client_id',provider.clientId)
  url.searchParams.set('redirect_uri',redirectUri)
  url.searchParams.set('response_type','code')
  url.searchParams.set('state',state)
  url.searchParams.set('scope',provider.scopes.join(' '))
  if(platform==='youtube'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent')}
  if(provider.pkce){
    if(!pkceVerifier) throw new Error('PKCE verifier required')
    url.searchParams.set('code_challenge',buildPkceChallenge(pkceVerifier))
    url.searchParams.set('code_challenge_method','S256')
  }
  return url.toString()
}

export async function exchangeCode(platform:string, code:string, redirectUri:string, pkceVerifier?:string){
  const provider=getProvider(platform)
  if(!provider.clientId || !provider.clientSecret) throw new Error(`Provider credentials are not configured for ${platform}`)
  const params:Record<string,string>={grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:provider.clientId,client_secret:provider.clientSecret}
  if(provider.pkce){if(!pkceVerifier)throw new Error('PKCE verifier required');params.code_verifier=pkceVerifier}
  const response=await fetch(provider.tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)})
  const data=await response.json().catch(()=>({})) as Record<string,unknown>
  if(!response.ok) throw new Error(typeof data.error_description==='string'?data.error_description:typeof data.error==='string'?data.error:`Provider token exchange failed (${response.status})`)
  return data
}

export function hashToken(token:string){ return crypto.createHash('sha256').update(token).digest('hex') }
