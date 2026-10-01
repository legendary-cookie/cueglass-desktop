import {_electron as electron} from 'playwright';
import {resolve,join} from 'node:path';
import {mkdir,rm,writeFile} from 'node:fs/promises';

const version=process.env.CUEGLASS_VERSION??'0.5.3';
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid packaged test version.');
const executable=resolve(`release/${version}/win-unpacked/Cueglass.exe`);
const profileName=`glance-v${version.replaceAll('.','-')}`;
const profile=resolve('test-user-data',profileName);
const findings={version,isolatedSyntheticProfile:true,realRecording:false,realProviderRequests:false,uiErrors:[]};
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
await mkdir(profile,{recursive:true});await mkdir('evidence',{recursive:true});
// Clear only this named smoke profile's synthetic key, never a normal app profile.
await rm(join(profile,'secure-store.bin'),{force:true});
await writeFile(join(profile,'ui-preferences.json'),JSON.stringify({compact:false,topmost:true,opacity:.88,transparent:true,textSize:15,bounds:{x:100,y:70,width:960,height:740}}));
await writeFile(join(profile,'experience-preferences.json'),JSON.stringify({preferredProvider:'practice',preferredModels:{},languages:{uiLocale:'en',speechLanguage:'auto',answerLanguage:'auto',mixedSpeech:false},realtime:{pauseMs:600,cooldownMs:3000}}));
let app=await electron.launch({executablePath:executable,args:['--smoke',`--smoke-profile=${profileName}`],cwd:process.cwd(),timeout:30000});
try{
 const page=await app.firstWindow();page.on('pageerror',error=>findings.uiErrors.push(error.message));
 await page.waitForSelector('#answers');await page.waitForFunction(expected=>window.cue.status().then(s=>s.version===expected),version);
 const state=await page.evaluate(()=>window.cue.status());
 assert(state.audio==='stopped'&&!state.providers.find(p=>p.id==='deepseek').connected,'Isolated profile started with unexpected credentials or recording.');
 assert(await page.locator('#conversation-details').evaluate(node=>!node.open),'Conversation drawer should start collapsed.');
 assert(await page.locator('#question').isHidden(),'Manual prompt should not occupy the main answer view.');
 assert(await page.locator('#answers .answer-placeholder').isVisible(),'Answer-first placeholder is missing.');
 findings.answerFirstCollapsedContext=true;

 // Stub main-process fetch before adding the synthetic BYOK key or asking for a catalog.
 const transportReady=await app.evaluate(()=>{
  const fixture={requests:[],aborted:0,slowNext:false,modelRequests:0};
  fixture.fetcher=async(input,options={})=>{
   const url=String(input);
   if(url==='https://api.deepseek.com/models'){
    fixture.modelRequests++;
    return new globalThis.Response(JSON.stringify({data:[{id:'fixture-fast'},{id:'fixture-slow'},{id:'fixture-failing'}]}));
   }
   if(url!=='https://api.deepseek.com/chat/completions')throw new Error('Unexpected provider request blocked by isolated fixture.');
   const request=JSON.parse(options.body);fixture.requests.push({model:request.model,body:request});
   if(request.model==='fixture-failing')return new globalThis.Response(JSON.stringify({error:'Synthetic failure'}),{status:503});
   const slow=request.model==='fixture-slow'&&fixture.slowNext;if(slow)fixture.slowNext=false;
   const delay=slow?1800:160;const encoder=new globalThis.TextEncoder();let timer;
   const body=new globalThis.ReadableStream({start(controller){
    controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:'A clear answer starts here. '}}]})+'\n\n'));
    timer=setTimeout(()=>{controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:'This is a separately streamed synthetic response.'}}]})+'\n\n'));controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\n'));controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();},delay);
    options.signal?.addEventListener('abort',()=>{fixture.aborted++;clearTimeout(timer);try{controller.error(new globalThis.DOMException('Canceled','AbortError'));}catch{/* stream already closed */}},{once:true});
   },cancel(){clearTimeout(timer);}});
   return new globalThis.Response(body,{headers:{'Content-Type':'text/event-stream'}});
  };
  globalThis.cueGlanceFixture=fixture;globalThis.fetch=fixture.fetcher;
  return globalThis.fetch===fixture.fetcher;
 });
 assert(transportReady,'Could not install the isolated main-process provider stub.');
 const stubProbe=await app.evaluate(async()=>await (await globalThis.fetch('https://api.deepseek.com/models')).json());
 assert(stubProbe.data.length===3,'Isolated catalog transport probe failed.');
 await app.evaluate(()=>{globalThis.cueGlanceFixture.modelRequests=0;});
 findings.providerTransportMocked=true;

 await keyboardSelect(page,'#model-selectors select[aria-label="Provider for answer 1"]','deepseek');
 await page.locator('[data-tab="accounts"]').click();
 const deepseek=page.locator('.provider-config').filter({hasText:'DeepSeek'});
 await deepseek.getByRole('textbox',{name:'DeepSeek API key'}).fill('synthetic-fixture-key-only');
 await deepseek.getByRole('button',{name:'Save key'}).click();
 await page.locator('[data-tab="controls"]').click();await page.locator('#paid').check();await page.locator('[data-tab="session"]').click();
 await poll(page,async()=>(await window.cue.status()).providers.find(p=>p.id==='deepseek').connected);
 await page.getByRole('button',{name:'Refresh catalog',exact:true}).click();
 await poll(page,async()=>(await window.cue.status()).providers.find(p=>p.id==='deepseek').models.length===3);
 assert(await app.evaluate(()=>globalThis.cueGlanceFixture.modelRequests)>=1,'Catalog did not use the mock transport.');
 await keyboardSelect(page,'#model-selectors select[aria-label="Model for answer 1"]','fixture-fast');findings.mouseKeyboardProviderPicker=true;
 await page.locator('#share-text').check();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('speech-text',{text:'How should one model answer without a typed prompt?',speaker:'Interviewer',turn:'manual-one'}));
 await page.getByRole('button',{name:/Answer now/}).click();
 await page.locator('.answer-card[data-key="deepseek:fixture-fast"][data-state="complete"]').waitFor();
 assert(await page.locator('.answer-card').count()===1,'One selected model did not produce exactly one response.');
 assert((await page.locator('.answer-card .answer-top strong').first().textContent()).includes('DeepSeek')&&(await page.locator('.answer-card .answer-top strong').first().textContent()).includes('fixture-fast'),'Response is not labeled with its provider and model.');
 assert((await app.evaluate(()=>globalThis.cueGlanceFixture.requests[0].body.messages[1].content)).includes('How should one model answer'),'Manual Answer required a typed prompt instead of using the latest interviewer transcript.');
 findings.singleModelNoQuestionEntry=true;findings.streamingVisible=(await page.locator('.answer-card .answer-body').textContent()).includes('A clear answer starts here.');

 await keyboardSelect(page,'#model-selectors select[aria-label="Model for answer 1"]','fixture-slow');
 await app.evaluate(()=>{globalThis.cueGlanceFixture.slowNext=true;});
 await page.getByRole('button',{name:'+ Add model'}).click();
 await keyboardSelect(page,'#model-selectors select[aria-label="Provider for answer 2"]','deepseek');
 await keyboardSelect(page,'#model-selectors select[aria-label="Model for answer 2"]','fixture-failing');
 await page.getByRole('button',{name:/Answer now/}).click();
 const failed=page.locator('.answer-card[data-key="deepseek:fixture-failing"]');const slow=page.locator('.answer-card[data-key="deepseek:fixture-slow"]');
 await failed.locator('.answer-error[role="alert"]').waitFor();await poll(page,()=>window.document.querySelector('.answer-card[data-key="deepseek:fixture-slow"]')?.getAttribute('data-state')==='streaming');
 assert((await slow.locator('.answer-body').textContent()).includes('A clear answer starts here.'),'The slow answer partial stream was not displayed.');
 assert((await failed.locator('.answer-top strong').textContent()).includes('fixture-failing'),'Failed model was not independently labeled.');
 assert(await page.locator('.answer-card').count()===2,'Two selected models did not produce two distinct answer cards.');
 findings.partialFailureDoesNotBlockStreaming=true;
 await poll(page,()=>window.document.querySelector('.answer-card[data-key="deepseek:fixture-slow"]')?.getAttribute('data-state')==='complete',5000);
 await page.screenshot({path:resolve('evidence/glance-multi-model.png')});

 // The test-only meter protocol synthesizes audio events; no microphone/system stream is opened.
 await page.locator('#auto').check();await app.evaluate(()=>globalThis.cueAudioTest.start());
 await poll(page,async()=>(await window.cue.status()).audio==='recording');
 const inject=(turn,text)=>app.evaluate(({BrowserWindow},v)=>{const c=BrowserWindow.getAllWindows()[0].webContents;c.send('audio-voice',{active:true,turn:v.turn});c.send('speech-text',{text:v.text,speaker:'Interviewer',turn:v.turn});c.send('audio-voice',{active:false,turn:v.turn});},{turn,text});
 await app.evaluate(()=>{globalThis.cueGlanceFixture.slowNext=true;});
 await inject('auto-one','How should a slow answer respond to the first synthetic question?');
 await waitForRequestCount(app,4,6000);
 await poll(page,()=>window.document.querySelector('.answer-card[data-key="deepseek:fixture-slow"]')?.getAttribute('data-state')==='streaming');
 const abortsBefore=await app.evaluate(()=>globalThis.cueGlanceFixture.aborted);
 await app.evaluate(()=>{globalThis.cueGlanceFixture.slowNext=false;});
 await inject('auto-two','How should the newer question replace the old synthetic answer?');
 await waitForAbortCount(app,abortsBefore,4000);
 await waitForRequestCount(app,5,7000);
 await poll(page,()=>window.document.querySelector('.answer-card[data-key="deepseek:fixture-slow"]')?.getAttribute('data-state')==='complete',5000);
 assert((await app.evaluate(()=>globalThis.cueGlanceFixture.requests.at(-1).body.messages[1].content)).includes('newer question'),'The next answer used stale question context.');
 findings.newSpeechCancelsStaleAndRepeatedAnswerCompletes=true;
 await app.evaluate(()=>globalThis.cueAudioTest.stop());await poll(page,async()=>(await window.cue.status()).audio==='stopped');
 assert(!await page.locator('#auto').isChecked(),'Synthetic recording stop did not disarm automatic answers.');findings.syntheticAudioStopped=true;

 await app.close();app=await electron.launch({executablePath:executable,args:['--smoke',`--smoke-profile=${profileName}`],cwd:process.cwd(),timeout:30000});const reopened=await app.firstWindow();await reopened.waitForSelector('#answers');await poll(reopened,async()=>(await window.cue.status()).experience.preferredProvider==='deepseek');assert(await reopened.locator('#model-selectors select[aria-label="Provider for answer 1"]').inputValue()==='deepseek','Provider choice did not persist across offline restart.');assert(await reopened.locator('#model-selectors select[aria-label="Model for answer 1"]').inputValue()==='fixture-failing','Per-provider model preference did not persist across offline restart.');findings.providerAndModelPersistOffline=true;
 assert(!findings.uiErrors.length,'Renderer errors occurred.');findings.passed=true;
 await writeFile(`evidence/glance-smoke-${version}.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));
}catch(error){
 findings.error=String(error);
 try{const page=await app.firstWindow();findings.state=await page.evaluate(async()=>{const status=await window.cue.status();return {audio:status.audio,drawerOpen:window.document.querySelector('#conversation-details')?.open,auto:window.document.querySelector('#auto')?.checked,cards:[...window.document.querySelectorAll('.answer-card')].map(card=>({key:card.dataset.key,state:card.dataset.state,error:card.querySelector('.answer-error')?.textContent})),providers:status.providers.map(p=>({id:p.id,connected:p.connected,models:p.models.length,note:p.note}))};});findings.fixture=await app.evaluate(()=>({requests:globalThis.cueGlanceFixture?.requests.length??0,modelRequests:globalThis.cueGlanceFixture?.modelRequests??0,aborted:globalThis.cueGlanceFixture?.aborted??0}));await writeFile(`evidence/glance-smoke-failure-${version}.json`,JSON.stringify(findings,null,2));}catch{/* isolated test process already closed */}
 throw error;
}finally{try{await app.evaluate(()=>globalThis.cueAudioTest.stop());}catch{/* fixture audio was not started */}try{await app.evaluate(()=>window.cue.deleteKey('deepseek'));}catch{/* synthetic fixture key was never stored */}await app.close();await rm(join(profile,'secure-store.bin'),{force:true});}

async function poll(page,fn,timeout=12000){const until=Date.now()+timeout;do{if(await page.evaluate(fn))return;await page.waitForTimeout(40);}while(Date.now()<until);throw new Error('Timed out waiting for isolated UI state.');}
async function keyboardSelect(page,selector,wanted){
 const control=page.locator(selector);const index=await control.locator('option').evaluateAll((options,value)=>options.findIndex(option=>option.value===value),wanted);
 assert(index>=0,`Picker option ${wanted} is unavailable.`);await control.click();await page.keyboard.press('Home');for(let position=0;position<index;position++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(({selector,value})=>window.document.querySelector(selector)?.value===value,{selector,value:wanted});
}
async function waitForRequestCount(app,count,timeout){const end=Date.now()+timeout;do{if(await app.evaluate(()=>globalThis.cueGlanceFixture.requests.length)>=count)return;await new Promise(resolve=>setTimeout(resolve,40));}while(Date.now()<end);throw new Error('Timed out waiting for mocked provider request.');}
async function waitForAbortCount(app,previous,timeout){const end=Date.now()+timeout;do{if(await app.evaluate(()=>globalThis.cueGlanceFixture.aborted)>previous)return;await new Promise(resolve=>setTimeout(resolve,40));}while(Date.now()<end);throw new Error('Fresh speech did not abort the older mocked stream.');}
