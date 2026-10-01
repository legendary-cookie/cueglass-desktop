import {_electron as electron} from 'playwright';
import {resolve,join} from 'node:path';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const exe=resolve(process.env.CUEGLASS_TEST_EXE??'release/0.6.0/win-unpacked/Cueglass.exe');
const source=resolve(process.env.CUEGLASS_SYNTHETIC_WAV??'.publish/installer-synthetic.wav');
const ids=['tiny-q5_1','base-q5_1','small-q5_1'];const labels=['Fast','Balanced','Higher accuracy'];
const profile='installer-models-v0-6-0';const findings={version:'0.6.0',syntheticOnly:true,realRecording:false,providerRequests:false,uiErrors:[],models:[]};
const launch=()=>electron.launch({executablePath:exe,args:['--smoke',`--smoke-profile=${profile}`],cwd:process.cwd(),timeout:30000});
const assert=(ok,message)=>{if(!ok)throw Error(message);};
await mkdir('evidence',{recursive:true});await rm(join('test-user-data',profile,'secure-store.bin'),{force:true});let app=await launch();
try{
 const page=await app.firstWindow();await page.waitForSelector('#answers');page.on('pageerror',e=>findings.uiErrors.push(e.message));
 await app.evaluate(()=>{globalThis.fetch=async()=>{throw Error('Network blocked by offline bundled-model test.');};});
 const state=await page.evaluate(()=>window.cue.status());assert(state.version==='0.6.0'&&state.audio==='stopped','Unexpected version/audio state');
 const models=await page.evaluate(()=>window.cue.speechModels());assert(ids.every(id=>models.find(m=>m.id===id)?.installed),'All three models must be installed before any download.');
 const bytes=await readFile(source);findings.fixtureBytes=bytes.length;findings.fixtureSHA256=createHash('sha256').update(bytes).digest('hex');
 await page.getByRole('button',{name:'Controls',exact:true}).click();
 for(const [index,id] of ids.entries()){
  const button=page.getByRole('button',{name:'Use '+labels[index],exact:true});await button.click();
  let selected=false;for(let attempt=0;attempt<100;attempt++){selected=await page.evaluate(id=>window.cue.speechModels().then(ms=>ms.find(m=>m.id===id)?.selected),id);if(selected)break;await page.waitForTimeout(100);}assert(selected,'Preset selection did not complete');
  const model=models.find(m=>m.id===id);const settings=await page.evaluate(()=>window.cue.settings());
  const modelBytes=await readFile(settings.whisperModel);const actualHash=createHash('sha256').update(modelBytes).digest('hex');assert(modelBytes.length===model.bytes&&actualHash===model.sha256,'Bundled checksum mismatch: '+JSON.stringify({id,expectedBytes:model.bytes,actualBytes:modelBytes.length,expectedHash:model.sha256,actualHash}));
  const output=resolve('evidence',`offline-${id}-0.6.0`);const start=performance.now();
  execFileSync(settings.whisperExe,['-m',settings.whisperModel,'-f',source,'-otxt','-of',output,'-nt','-l','en','-t','2','-ng'],{windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:120000});
  const ms=performance.now()-start;const text=(await readFile(output+'.txt','utf8')).trim();assert(text.toLowerCase().includes('problem'),'Synthetic speech did not transcribe the intended topic');
  findings.models.push({id,bytes:model.bytes,sha256:model.sha256,elapsedMs:Math.round(ms),text});
  assert((await page.evaluate(()=>window.cue.status())).audio==='stopped','Recording started unexpectedly');
 }
 await app.close();app=await launch();const second=await app.firstWindow();await second.waitForSelector('#answers');
 assert((await second.evaluate(()=>window.cue.speechModels())).find(m=>m.id==='small-q5_1')?.selected,'Offline selected model did not persist');findings.offlineSelectionPersisted=true;assert(findings.uiErrors.length===0,'UI errors occurred');findings.passed=true;
 await writeFile('evidence/bundled-models-smoke-0.6.0.json',JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));
}finally{await app.close();}
