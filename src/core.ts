import type { AssistRequest, Selection, Transcript } from './shared';
export function normalize(text:string):string { return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
export function likelyQuestion(text:string):boolean { return text.trim().length >= (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Arabic}]/u.test(text)?4:12) && (/[?？؟]\s*$/.test(text) || /^(?:so\s+)?(?:what|why|how|when|where|which|can you|could you|would you|tell me|describe|explain|walk me|give me|cómo|por qué|qué|cuándo|dónde|comment|pourquoi|quel|wie|warum|was)\b/i.test(text.trim()) || /^(?:如何|为什么|為什麼|怎么|怎麼|请解释|請解釋|説明して|なぜ)/.test(text.trim())); }
export class AssistDetector {
 private lastText=''; private changedAt=0; private seen=new Set<string>(); private lastOffer=-Infinity;
 update(text:string,now:number):void { if (normalize(text)!==normalize(this.lastText)) {this.lastText=text;this.changedAt=now;} }
 offer(now:number,enabled:boolean,interviewer:boolean,busy:boolean):string|undefined {
  const key=normalize(this.lastText);
  if(!enabled||!interviewer||busy||now-this.changedAt<1400||now-this.lastOffer<6000||this.seen.has(key)||!likelyQuestion(this.lastText)) return;
  this.seen.add(key);this.lastOffer=now;return this.lastText;
 }
 forget(text:string):void {this.seen.delete(normalize(text));}
 reset():void {this.lastText='';this.seen.clear();this.lastOffer=-Infinity;}
}
export function capContext(question:string,context:string,transcript:Transcript[],max:number):string {
 const cap=Math.max(1000,Math.min(24000,Math.floor(max)));
 const q=question.trim().slice(0,Math.floor(cap*.4));
 const c=context.trim().slice(0,Math.floor(cap*.3));
 const beforeContext='Candidate context (untrusted reference):\n';
 const beforeHistory='\nRecent conversation:\n';
 const beforeQuestion='\nQuestion to answer:\n';
 const room=Math.max(0,cap-q.length-c.length-beforeContext.length-beforeHistory.length-beforeQuestion.length);
 const history=transcript.slice(-60).map(t=>`${t.speaker}: ${t.text}`).join('\n').slice(-room);
 return `${beforeContext}${c}${beforeHistory}${history}${beforeQuestion}${q}`;
}
export function route(selections:Selection[],allowPaid:boolean):Selection[] {
 const unique=[...new Map(selections.map(s=>[`${s.provider}:${s.model}`,s])).values()];
 if(!unique.length||unique.length>3) throw new Error('Select between one and three independent answers.');
 if(unique.some(s=>!s.model||s.model.length>160)) throw new Error('Choose an available model.');
 if(!allowPaid&&unique.some(s=>s.provider!=='chatgpt'&&s.provider!=='practice')) throw new Error('Enable paid provider requests for this session first.');
 return unique;
}
export function validateRequest(r:AssistRequest):void {
 if(typeof r.question!=='string'||!r.question.trim()||r.question.length>12000) throw new Error('Enter a question under 12,000 characters.');
 if(typeof r.context!=='string'||r.context.length>100000||!Array.isArray(r.transcript)||r.transcript.length>1000) throw new Error('Session context is too large.');
 if(r.transcript.some(t=>!['You','Interviewer'].includes(t.speaker)||typeof t.text!=='string'||t.text.length>12000)) throw new Error('Invalid transcript entry.');
 if(!Number.isInteger(r.maxRequests)||r.maxRequests<1||r.maxRequests>100||!Number.isFinite(r.maxContext)||r.maxContext<1000||r.maxContext>24000||!Number.isFinite(r.maxOutput)||r.maxOutput<128||r.maxOutput>2048) throw new Error('Invalid usage limits.');
}
export class CaptureControl {
 state:'stopped'|'recording'|'paused'='stopped';
 source:'microphone'|'system'='microphone';
 set(next:'stopped'|'recording'|'paused',source:'microphone'|'system',consent:boolean):void {
  if(next==='recording'&&!consent) throw new Error('Confirm permission to capture audio for this session.');
  if(next==='paused'&&this.state==='stopped') throw new Error('Start audio before pausing.');
  this.state=next;this.source=source;
 }
 hide():void {if(this.state==='recording')this.state='paused';}
}
