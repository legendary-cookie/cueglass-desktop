import {likelyQuestion,normalize} from './core';
export type RealtimeSettings={pauseMs:number;cooldownMs:number};
export const realtimeDefaults:RealtimeSettings={pauseMs:1000,cooldownMs:6000};
export function realtimeSettings(value:unknown,base=realtimeDefaults):RealtimeSettings {const v=value&&typeof value==='object'?value as Partial<RealtimeSettings>:{};const clamp=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.round(Math.min(max,Math.max(min,n))):fallback;return {pauseMs:clamp(v.pauseMs,base.pauseMs,600,3000),cooldownMs:clamp(v.cooldownMs,base.cooldownMs,3000,30000)};}
// Energy VAD + stable transcript/question intent. This is not Smart Turn or a
// semantic completion model. Silence alone does not prove a complete question.
export class TurnGate {
 private speaking=false;private endedAt=0;private changedAt=0;private text='';private offered=new Set<string>();private lastOffer=-Infinity;
 voice(active:boolean,now:number):boolean {const started=active&&!this.speaking;this.speaking=active;if(!active)this.endedAt=now;return started;}
 update(text:string,now:number):boolean {const changed=normalize(text)!==normalize(this.text);if(changed){this.text=text;this.changedAt=now;}return changed;}
 offer(now:number,settings:RealtimeSettings,enabled:boolean,interviewer:boolean,busy:boolean):string|undefined {const key=normalize(this.text);if(!enabled||!interviewer||busy||this.speaking||now-Math.max(this.endedAt,this.changedAt)<settings.pauseMs||now-this.lastOffer<settings.cooldownMs||this.offered.has(key)||!likelyQuestion(this.text))return;this.offered.add(key);this.lastOffer=now;return this.text;}
 reset():void {this.speaking=false;this.endedAt=0;this.changedAt=0;this.text='';this.offered.clear();this.lastOffer=-Infinity;}
}
