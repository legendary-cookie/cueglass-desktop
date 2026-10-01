import { createServer, type Server } from 'node:http';
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { hostId } from './host';
import type { Vault, Account } from './vault';
const issuer='https://auth.openai.com';
const resource='https://api.openai.com/v1';
const tokenEndpoint=issuer+'/api/accounts/oauth/token';
export const scopes='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random=()=>randomBytes(32).toString('base64url');
export function sameState(actual:string|null,expected:string):boolean {
 if(!actual)return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
export function callbackClient(given:string|null,previous?:string):string {
 if(previous) {if(given&&given!==previous)throw new Error('The returning client did not match this account.');return previous;}
 if(!given||given==='dynamic_agent_client'||!given.startsWith('oaiapp_'))throw new Error('Registration did not return an issued client ID.');return given;
}
export function validateIdentity(payload:JWTPayload,nonce:string,previous?:Account):void {
 if(payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub)throw new Error('Sign-in identity validation failed.');
 if(previous&&!(previous.registrationOnly&&previous.sub==='')&&payload.sub!==previous.sub)throw new Error('This sign-in belongs to a different account. Add it as a new account.');
}
export async function verifyIdentity(idToken:string,clientId:string,nonce:string,previous?:Account,jwks:Parameters<typeof jwtVerify>[1]=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'))):Promise<JWTPayload> {
 const {payload}=await jwtVerify(idToken,jwks,{issuer,audience:clientId,requiredClaims:['sub','exp','iat'],clockTolerance:5});
 validateIdentity(payload,nonce,previous);return payload;
}
export function authorizationURL(options:{hostId:string;redirect:string;state:string;nonce:string;verifier:string;previous?:Account}):URL {
 const redirect=new URL(options.redirect);if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||redirect.pathname!=='/auth/callback'||!redirect.port||redirect.search||redirect.hash||redirect.username||redirect.password)throw new Error('Sign-in requires an exact 127.0.0.1 loopback callback.');
 const previous=options.previous;const url=new URL(issuer+'/api/accounts/authorize');
 const params:Record<string,string>={client_id:previous?.clientId??'dynamic_agent_client',ext_agent_host_id:hostId(options.hostId),response_type:'code',redirect_uri:options.redirect,scope:scopes,resource,state:options.state,nonce:options.nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(options.verifier).digest('base64url')};
 if(!previous)params.agent_name_hint='Cueglass';else if(previous.idToken)params.id_token_hint=previous.idToken;
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));return url;
}
async function tokenForm(form:Record<string,string>,signal?:AbortSignal):Promise<any> {
 const r=await fetch(tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(r.status===400?'Sign-in expired or was revoked. Please sign in again.':`OpenAI sign-in service returned HTTP ${r.status}.`);
 return r.json();
}
export class ChatGPTAuth {
 private server?:Server;private timer?:ReturnType<typeof setTimeout>;private pending=false;private rejectPending?:(reason:Error)=>void;private refreshPromise?:Promise<string>;private epoch=0;private controller?:AbortController;
 constructor(private vault:Vault,private openBrowser:(url:string)=>Promise<void>,private changed:()=>void,private timeoutMs=300000){}
 isPending():boolean{return this.pending;}
 cancel():void {this.epoch++;this.controller?.abort();this.rejectPending?.(new Error('Sign-in canceled.'));this.cleanup();}
 private cleanup():void {clearTimeout(this.timer);this.server?.close();this.server?.closeAllConnections();this.server=undefined;this.controller=undefined;this.pending=false;this.rejectPending=undefined;this.changed();}
 async signIn(accountId?:string):Promise<string> {
  if(this.pending)throw new Error('A sign-in is already open. Finish or cancel it first.');
  const previous=accountId?this.vault.data.accounts.find(a=>a.id===accountId):undefined;
  if(accountId&&!previous)throw new Error('Account not found.');
  this.vault.data.hostId=hostId(this.vault.data.hostId);this.vault.save();const epoch=++this.epoch;const controller=new AbortController();this.controller=controller;
  const state=random(),nonce=random(),verifier=random();
  this.pending=true;this.changed();
  return new Promise<string>((resolve,reject)=>{
   this.rejectPending=reject;
   let consumed=false;
   const server=createServer(async(req,res)=>{
    const u=new URL(req.url??'/','http://127.0.0.1');
    res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'");
    if(req.method!=='GET'||u.pathname!=='/auth/callback'){res.writeHead(404);res.end('Not found');return;}
    if(epoch!==this.epoch||consumed||!sameState(u.searchParams.get('state'),state)){res.writeHead(400);res.end('Invalid or expired sign-in state.');return;}
    consumed=true;
    try {
     if(u.searchParams.has('error'))throw new Error(u.searchParams.get('error')==='access_denied'?'ChatGPT permission was not granted. You can try again in Cueglass.':'OpenAI rejected this sign-in attempt. Check account eligibility and the Cueglass request configuration before retrying.');
     const clientId=callbackClient(u.searchParams.get('client_id'),previous?.clientId);
     const code=u.searchParams.get('code');if(!code)throw new Error('Sign-in returned no authorization code.');
     const address=server.address();if(!address||typeof address==='string')throw new Error('Callback unavailable.');
     const redirect=`http://127.0.0.1:${address.port}/auth/callback`;
     let registration=previous;
     if(!registration){registration={id:randomUUID(),clientId,sub:'',label:'ChatGPT registration - sign-in incomplete',scopes:[],registrationOnly:true};this.vault.data.accounts.push(registration);if(!this.vault.data.active)this.vault.data.active=registration.id;this.vault.save();this.changed();}
     const tokens=await tokenForm({grant_type:'authorization_code',client_id:clientId,code,code_verifier:verifier,redirect_uri:redirect,resource},controller.signal);
     if(typeof tokens.id_token!=='string')throw new Error('OpenAI did not return an identity token.');
     const payload=await verifyIdentity(tokens.id_token,clientId,nonce,previous);if(epoch!==this.epoch)throw new Error('Sign-in was canceled.');
     const granted=typeof tokens.scope==='string'?tokens.scope.split(/\s+/):[];
     const account:Account={id:registration.id,clientId,sub:payload.sub!,label:`${typeof payload.email==='string'?payload.email:'ChatGPT account'} · ${clientId.slice(-6)}`,access:typeof tokens.access_token==='string'?tokens.access_token:undefined,refresh:typeof tokens.refresh_token==='string'?tokens.refresh_token:undefined,idToken:tokens.id_token,expires:Date.now()+Number(tokens.expires_in??3600)*1000,scopes:granted};
     this.vault.data.accounts=this.vault.data.accounts.filter(a=>a.id!==account.id);this.vault.data.accounts.push(account);this.vault.data.active=account.id;this.vault.save();
     res.end('Connected to Cueglass. You may close this browser tab.');
     resolve(granted.includes('chatgpt.tokens.use.direct')?'ChatGPT plan usage connected.':'Signed in, but ChatGPT plan usage permission is missing. Reauthorize to enable answers.');
    } catch(error) {res.writeHead(400);res.end('Sign-in could not complete. Return to Cueglass for details.');reject(error instanceof Error?error:new Error('Sign-in failed.'));}
    finally {if(epoch===this.epoch)this.cleanup();}
   });
   this.server=server;
   server.once('error',()=>{reject(new Error('Could not start the local sign-in callback.'));if(epoch===this.epoch)this.cleanup();});
   server.listen(0,'127.0.0.1',()=>{
    if(epoch!==this.epoch){server.close();return;}
    const address=server.address();if(!address||typeof address==='string')return;
    const url=authorizationURL({hostId:this.vault.data.hostId,redirect:`http://127.0.0.1:${address.port}/auth/callback`,state,nonce,verifier,previous});
    this.openBrowser(url.toString()).catch(()=>{reject(new Error('Could not open the system browser.'));if(epoch===this.epoch)this.cleanup();});
   });
   this.timer=setTimeout(()=>{if(epoch!==this.epoch)return;this.epoch++;controller.abort();reject(new Error('Sign-in timed out. Cancel any browser error page and try again in Cueglass.'));this.cleanup();},this.timeoutMs);
  });
 }
 async access():Promise<string> {
  const a=this.vault.active();if(!a?.access||!a.scopes.includes('chatgpt.tokens.use.direct')||!a.scopes.includes('resource.invoke'))throw new Error('Continue with ChatGPT and grant plan usage before requesting answers.');
  if((a.expires??0)>Date.now()+60000)return a.access;
  if(this.refreshPromise)return this.refreshPromise;
  const refresh=this.refreshAccount(a);this.refreshPromise=refresh;
  try{return await refresh;}finally{this.refreshPromise=undefined;}
 }
 private async refreshAccount(a:Account):Promise<string> {
  if(!a.refresh)throw new Error('Sign in again to renew ChatGPT access.');
  const tokens=await tokenForm({grant_type:'refresh_token',client_id:a.clientId,refresh_token:a.refresh,resource});
  if(typeof tokens.access_token!=='string')throw new Error('OpenAI did not renew access. Please sign in again.');
  // An account switch or sign-out during renewal must not resurrect that session.
  if(!a.access||!this.vault.data.accounts.includes(a))throw new Error('Account changed while renewing access.');
  a.access=tokens.access_token;a.refresh=tokens.refresh_token??a.refresh;a.expires=Date.now()+Number(tokens.expires_in??3600)*1000;
  if(typeof tokens.scope==='string')a.scopes=tokens.scope.split(/\s+/);
  this.vault.save();this.changed();return a.access!;
 }
 async signOut():Promise<string> {
  this.cancel();const a=this.vault.active();if(!a)return 'Signed out.';
  const refresh=a.refresh;delete a.access;delete a.refresh;delete a.idToken;delete a.expires;this.vault.save();this.changed();
  if(!refresh)return 'Signed out locally.';
  try {
   const discovery=await fetch(issuer+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(10000)});if(!discovery.ok)throw new Error();
   const config=await discovery.json() as {revocation_endpoint:string};const endpoint=new URL(config.revocation_endpoint);
   if(endpoint.origin!==issuer)throw new Error();
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:refresh,token_type_hint:'refresh_token',client_id:a.clientId}),signal:AbortSignal.timeout(10000)});
   if(r.status!==200)throw new Error();return 'Signed out; renewable session revoked.';
  }catch{return 'Signed out locally. Remote revocation was not confirmed; disconnect Cueglass in ChatGPT Settings.';}
 }
}
