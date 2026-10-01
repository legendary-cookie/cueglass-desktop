import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream,existsSync} from 'node:fs';
import {mkdir,stat,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export type SpeechModel={id:string;name:string;file:string;url:string;bytes:number;sha256:string;language:string;tradeoff:string;license:'MIT'};
export type SpeechModelState=SpeechModel & {installed:boolean;selected:boolean};
export type DownloadProgress={id:string;received:number;total:number;state:'downloading'|'verifying'|'complete'|'canceled'|'error';message?:string};
export async function fileHash(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export class ModelManager {
 private controller?:AbortController;private active?:string;
 constructor(private root:string,private catalog:SpeechModel[],private bundled:Record<string,string>,private notify:(progress:DownloadProgress)=>void,private fetcher:typeof fetch=fetch){}
 private entry(id:string):SpeechModel{const e=this.catalog.find(m=>m.id===id);if(!e||!/^ggml-[a-z0-9._-]+\.bin$/.test(e.file)||!/^https:\/\/huggingface.co\/ggerganov\/whisper.cpp\/resolve\/[a-f0-9]{40}\//.test(e.url))throw new Error('Unknown compatible speech model.');return e;}
 path(id:string):string {const e=this.entry(id);return this.bundled[id]??join(this.root,e.file);}
 async list(selected:string):Promise<SpeechModelState[]>{return Promise.all(this.catalog.map(async e=>{const p=this.path(e.id);const size=await stat(p).then(s=>s.size).catch(()=>0);return {...e,installed:size===e.bytes,selected:p===selected};}));}
 async select(id:string):Promise<string>{const e=this.entry(id),p=this.path(id);if(!existsSync(p)||await fileHash(p)!==e.sha256)throw new Error('Model is missing or corrupt. Download it again before selecting.');return p;}
 cancel():void {this.controller?.abort();}
 async download(id:string):Promise<void>{const e=this.entry(id);if(this.active)throw new Error('One model download at a time. Cancel the current download first.');if(this.bundled[id]){await this.select(id);return;}
  this.active=id;const controller=new AbortController();this.controller=controller;await mkdir(this.root,{recursive:true});const partial=join(this.root,e.file+'.partial');let received=0;
  const report=(state:DownloadProgress['state'],message?:string)=>this.notify({id,received,total:e.bytes,state,message});
  try{report('downloading');const response=await this.fetcher(e.url,{signal:controller.signal});if(!response.ok||!response.body)throw new Error('Download unavailable. Your current model is unchanged.');const length=Number(response.headers.get('content-length'));if(length&&length!==e.bytes)throw new Error('Upstream file size changed; update the verified catalog.');
   let last=0;const source=Readable.fromWeb(response.body as any);source.on('data',(chunk:Buffer)=>{received+=chunk.length;if(received>e.bytes)source.destroy(new Error('Download exceeds its verified size.'));if(Date.now()-last>200){last=Date.now();report('downloading');}});
   await pipeline(source,createWriteStream(partial,{flags:'w'}),{signal:controller.signal});if(controller.signal.aborted)throw new Error('Canceled');report('verifying');if(received!==e.bytes||await fileHash(partial)!==e.sha256)throw new Error('Checksum mismatch. Partial model was discarded; your current model is unchanged.');if(controller.signal.aborted)throw new Error('Canceled');await rename(partial,join(this.root,e.file));report('complete');
  }catch(error){report(controller.signal.aborted?'canceled':'error',controller.signal.aborted?'Download canceled; current model unchanged.':error instanceof Error?error.message:'Download failed.');if(!controller.signal.aborted)throw error;
  }finally{await rm(partial,{force:true});this.active=undefined;this.controller=undefined;}
 }
}
