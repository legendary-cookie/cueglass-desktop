import { describe,it,expect,beforeAll } from 'vitest';
import { generateKeyPair,exportJWK,createLocalJWKSet,SignJWT } from 'jose';
import { verifyIdentity } from '../src/auth';
let privateKey:CryptoKey;let jwks:ReturnType<typeof createLocalJWKSet>;
beforeAll(async()=>{const keys=await generateKeyPair('RS256');privateKey=keys.privateKey;jwks=createLocalJWKSet({keys:[{...await exportJWK(keys.publicKey),kid:'fixture-key'}]});});
async function token({iss='https://auth.openai.com',aud='oaiapp_fixture',nonce='fixture-nonce',expires='2m'}={}):Promise<string>{return new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'fixture-key'}).setIssuer(iss).setAudience(aud).setSubject('fixture-subject').setIssuedAt().setExpirationTime(expires).sign(privateKey);}
describe('cryptographic sign-in validation (offline fixtures)',()=>{
 it('accepts only a signed identity bound to the issued client and nonce',async()=>{const payload=await verifyIdentity(await token(),'oaiapp_fixture','fixture-nonce',undefined,jwks);expect(payload.sub).toBe('fixture-subject');});
 it('rejects a different issuer',async()=>{await expect(verifyIdentity(await token({iss:'https://untrusted.invalid'}),'oaiapp_fixture','fixture-nonce',undefined,jwks)).rejects.toThrow();});
 it('rejects a different client audience',async()=>{await expect(verifyIdentity(await token({aud:'oaiapp_other'}),'oaiapp_fixture','fixture-nonce',undefined,jwks)).rejects.toThrow();});
 it('rejects expired or mismatched nonce tokens',async()=>{await expect(verifyIdentity(await token({expires:'-1m'}),'oaiapp_fixture','fixture-nonce',undefined,jwks)).rejects.toThrow();await expect(verifyIdentity(await token({nonce:'other'}),'oaiapp_fixture','fixture-nonce',undefined,jwks)).rejects.toThrow();});
 it('rejects an altered signature',async()=>{const valid=await token();const parts=valid.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await expect(verifyIdentity(parts.join('.'),'oaiapp_fixture','fixture-nonce',undefined,jwks)).rejects.toThrow();});
});
