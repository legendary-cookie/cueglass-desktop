import { safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { newHostId } from './host';
import type { ProviderId, Settings } from './shared';
export type Account = { id:string; clientId:string; sub:string; label:string; access?:string; refresh?:string; idToken?:string; expires?:number; scopes:string[]; registrationOnly?:boolean };
export type VaultData = { hostId:string; active?:string; accounts:Account[]; keys:Partial<Record<ProviderId,string>>; models:Partial<Record<ProviderId,string[]>>; settings:Settings };
export class Vault {
 data:VaultData;
 constructor(private path:string) {
  this.data={hostId:newHostId(),accounts:[],keys:{},models:{},settings:{whisperExe:'',whisperModel:''}};
  if(existsSync(path)) {
   if(!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure credential storage is unavailable.');
   this.data=JSON.parse(safeStorage.decryptString(readFileSync(path)));
  }
 }
 save():void {
  if(!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure credential storage is unavailable; credentials were not saved.');
  mkdirSync(dirname(this.path),{recursive:true});
  const temporary=this.path+'.new';
  writeFileSync(temporary,safeStorage.encryptString(JSON.stringify(this.data)));renameSync(temporary,this.path);
 }
 active():Account|undefined{return this.data.accounts.find(a=>a.id===this.data.active);}
}
