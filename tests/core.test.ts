import { describe,it,expect } from 'vitest';
import { AssistDetector,CaptureControl,capContext,route,likelyQuestion } from '../src/core';
import { callbackClient,sameState,validateIdentity } from '../src/auth';
import { pcmWav } from '../src/ui/audio';
describe('question detection',()=>{
 it('waits for a pause and offers one question once',()=>{const d=new AssistDetector();d.update('How would you solve this?',0);expect(d.offer(1000,true,true,false)).toBeUndefined();expect(d.offer(1401,true,true,false)).toBe('How would you solve this?');expect(d.offer(10000,true,true,false)).toBeUndefined();});
 it('ignores candidate speech, disabled automation, busy state and statements',()=>{const d=new AssistDetector();d.update('Tell me about your experience',0);expect(d.offer(2000,true,false,false)).toBeUndefined();expect(d.offer(2000,false,true,false)).toBeUndefined();expect(d.offer(2000,true,true,true)).toBeUndefined();d.update('I worked on a database for three years.',2500);expect(d.offer(5000,true,true,false)).toBeUndefined();});
 it('resets debounce on changed text and enforces cooldown',()=>{const d=new AssistDetector();d.update('What did you build?',0);d.update('What did you build last year?',1000);expect(d.offer(2000,true,true,false)).toBeUndefined();expect(d.offer(2500,true,true,false)).toBeTruthy();d.update('Why did you choose that?',2600);expect(d.offer(5000,true,true,false)).toBeUndefined();expect(d.offer(8600,true,true,false)).toBeTruthy();});
 it('recognizes prompts without punctuation',()=>{expect(likelyQuestion('Walk me through your design')).toBe(true);expect(likelyQuestion('Yes?')).toBe(false);});
});
describe('routing and context',()=>{
 it('deduplicates and denies paid routing until enabled',()=>{expect(route([{provider:'practice',model:'offline-coach'},{provider:'practice',model:'offline-coach'}],false)).toHaveLength(1);expect(()=>route([{provider:'claude',model:'test-model'}],false)).toThrow('paid provider');expect(route([{provider:'claude',model:'test-model'}],true)).toHaveLength(1);});
 it('caps large context but preserves current question and newest conversation',()=>{const p=capContext('What should I do next?','x'.repeat(30000),[{id:'1',speaker:'Interviewer',text:'Old '+ 'y'.repeat(10000),at:0},{id:'2',speaker:'You',text:'Newest detail',at:1}],1000);expect(p.length).toBeLessThanOrEqual(1000);expect(p).toContain('What should I do next?');expect(p).toContain('Newest detail');expect(p).not.toContain('Old ');});
});
describe('capture consent and controls',()=>{
 it('never records without consent and hiding pauses',()=>{const c=new CaptureControl();expect(c.state).toBe('stopped');expect(()=>c.set('recording','system',false)).toThrow('permission');c.set('recording','system',true);c.hide();expect(c.state).toBe('paused');c.set('stopped','system',false);expect(()=>c.set('paused','system',false)).toThrow('Start');});
 it('creates valid 16 kHz PCM for the local runtime',()=>{const wav=pcmWav(new Float32Array(48000).fill(.5),48000);const v=new DataView(wav);expect(wav.byteLength).toBe(32044);expect(v.getUint32(24,true)).toBe(16000);expect(v.getUint16(34,true)).toBe(16);expect(v.getInt16(44,true)).toBeGreaterThan(16000);});
});
describe('official sign-in callback protections',()=>{
 it('rejects missing, mismatched and dynamic callback credentials',()=>{expect(sameState(null,'secret-state')).toBe(false);expect(sameState('x','secret-state')).toBe(false);expect(sameState('secret-state','secret-state')).toBe(true);expect(()=>callbackClient('dynamic_agent_client')).toThrow();expect(()=>callbackClient(null)).toThrow();expect(()=>callbackClient('oaiapp_other','oaiapp_original')).toThrow();expect(callbackClient(null,'oaiapp_original')).toBe('oaiapp_original');});
 it('requires nonce and matching subject on reauthorization',()=>{expect(()=>validateIdentity({sub:'alice',nonce:'wrong'},'nonce')).toThrow();expect(()=>validateIdentity({sub:'bob',nonce:'nonce'},'nonce',{id:'a',clientId:'oaiapp_a',sub:'alice',label:'a',scopes:[]})).toThrow('different account');expect(()=>validateIdentity({sub:'alice',nonce:'nonce'},'nonce')).not.toThrow();});
});
