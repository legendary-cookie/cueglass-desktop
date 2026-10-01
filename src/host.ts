import {randomUUID} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function hostId(value:unknown):string {
 if(typeof value!=='string')throw new Error('Cueglass host ID is missing. Existing registration was preserved; sign-in cannot proceed.');
 if(value.startsWith('urn:uuid:')&&uuid.test(value.slice(9)))return value;
 if(uuid.test(value))return 'urn:uuid:'+value;
 // Preserve the other documented opaque formats without deriving another app's identity.
 if(/^urn:ietf:params:oauth:jwk-thumbprint:sha-256:[A-Za-z0-9_-]{43}$/.test(value)||/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/.test(value))return value;
 throw new Error('Cueglass host ID has an unsupported format. Existing registration was preserved; do not borrow another app’s host ID.');
}
export function newHostId():string {return 'urn:uuid:'+randomUUID();}
