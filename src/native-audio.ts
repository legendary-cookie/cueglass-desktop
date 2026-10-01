import {spawn} from 'node:child_process';
import type {ChildProcess,SpawnOptions} from 'node:child_process';
import type {AudioSelection,AudioSource} from './shared';
type Launch=(executable:string,args:string[],options:SpawnOptions)=>ChildProcess;
export class NativeAudio {
 private child?:ReturnType<typeof spawn>;private epoch=0;private meterActive=false;
 constructor(private executable:string,private onWav:(wav:ArrayBuffer,turn?:number)=>Promise<void>,private meter:(peak:number)=>void,private stopped:(message?:string)=>void,private launch:Launch=(exe,args,options)=>spawn(exe,args,options),private voice:(active:boolean,turn:number)=>void=()=>{},private dropped:()=>void=()=>{}){}
 async list(appSupported:boolean):Promise<AudioSource[]> {return new Promise((resolve,reject)=>{
  const child=this.launch(this.executable,['list'],{windowsHide:true,stdio:['ignore','pipe','ignore'],shell:false});let text='';const timer=setTimeout(()=>child.kill(),8000);
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data',chunk=>{text+=chunk;if(text.length>1000000)child.kill();});child.once('error',()=>{clearTimeout(timer);reject(new Error('Windows audio helper could not launch.'));});child.once('exit',code=>{clearTimeout(timer);try{if(code!==0)throw new Error();const data=JSON.parse(text);resolve((data.sources??[]).filter((s:any)=>s&&['microphone','output','app'].includes(s.kind)&&typeof s.id==='string'&&typeof s.name==='string').map((s:AudioSource)=>({...s,supported:s.kind!=='app'||appSupported})));}catch{reject(new Error('Windows audio sources could not be listed.'));}});
 });}
 async start(source:AudioSelection):Promise<void> {
  this.stop();const epoch=this.epoch;
  await new Promise<void>((resolve,reject)=>{const child=this.launch(this.executable,['capture',source.kind,source.id],{windowsHide:true,stdio:['pipe','pipe','ignore'],shell:false});this.child=child;let buffer='',ready=false,queued=false;const timer=setTimeout(()=>{if(!ready&&epoch===this.epoch){this.stop();reject(new Error('Audio source did not become ready.'));}},12000);
   child.stdout!.setEncoding('utf8');
   child.stdout!.on('data',chunk=>{if(epoch!==this.epoch)return;buffer+=chunk;if(buffer.length>1000000){this.stop();reject(new Error('Audio bridge sent too much data.'));return;}let newline:number;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);let event:any;try{event=JSON.parse(line);}catch{continue;}if(epoch!==this.epoch)continue;
    if(event.type==='ready'){ready=true;clearTimeout(timer);resolve();}
    if(event.type==='voice'&&typeof event.active==='boolean')this.voice(event.active,Number.isInteger(event.turn)&&event.turn>=0?event.turn:0);
    if(event.type==='meter'&&Number.isFinite(event.peak)){this.meterActive=true;this.meter(Math.max(0,Math.min(1,event.peak)));}
    if(event.type==='wav'&&ready&&typeof event.data==='string'&&event.data.length<200000){if(queued){this.dropped();continue;}const b=Buffer.from(event.data,'base64');queued=true;void this.onWav(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),Number.isInteger(event.turn)&&event.turn>=0?event.turn:0).catch(()=>{if(epoch===this.epoch)this.stopped('Local transcription failed. Pause and check the selected model.');}).finally(()=>{queued=false;});}
    if(event.type==='error'){const message=typeof event.message==='string'?event.message:'Audio source unavailable.';if(!ready)reject(new Error(message));else this.stopped(message);this.stop();}
   }});
   child.once('error',()=>{clearTimeout(timer);reject(new Error('Windows audio helper could not launch.'));});child.once('exit',()=>{clearTimeout(timer);if(!ready)reject(new Error('Windows audio source stopped before capture started.'));if(epoch===this.epoch){this.child=undefined;this.stopped('Audio source stopped. Resume manually when ready.');}});
  });
 }
 stop():void {this.epoch++;const child=this.child;this.child=undefined;if(child)child.kill();if(this.meterActive){this.meterActive=false;this.meter(0);}this.voice(false,0);}
}
