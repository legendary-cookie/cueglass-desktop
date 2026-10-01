import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const profile='model-catalog-diagnostic-0-5-3';
const exe=resolve('release/0.5.4/win-unpacked/Cueglass.exe');
const launch=()=>electron.launch({executablePath:exe,args:['--smoke',`--smoke-profile=${profile}`],cwd:process.cwd(),timeout:30000});
const result={version:'0.5.4',syntheticOnly:true,liveRequests:false,checks:[]};
const assert=(value,message)=>{if(!value)throw Error(message);result.checks.push(message);};
let app=await launch();
try{
 await app.firstWindow();
 await app.evaluate(async({app,safeStorage})=>{
  const fs=process.getBuiltinModule('node:fs');const path=process.getBuiltinModule('node:path');
  fs.writeFileSync(path.join(app.getPath('userData'),'secure-store.bin'),safeStorage.encryptString(JSON.stringify({hostId:'urn:uuid:00000000-0000-4000-8000-000000000000',active:'synthetic',accounts:[{id:'synthetic',clientId:'oaiapp_fixture',sub:'fixture',label:'Synthetic catalog fixture',access:'not-a-real-token',expires:Date.now()+3600000,scopes:['resource.invoke','chatgpt.tokens.use.direct']}],keys:{},models:{},settings:{whisperExe:'',whisperModel:''}})));
 });
 await app.close();app=await launch();const page=await app.firstWindow();await page.waitForSelector('#answers');
 const ids=['gpt-6-luna','gpt-6-sol','gpt-6.1-sol'];
 await app.evaluate((_electron,ids)=>{
  globalThis.catalogFailure=false;globalThis.requests=[];
  globalThis.fetch=async url=>{
   globalThis.requests.push(String(url));if(String(url)!=='https://api.openai.com/v1/models')throw Error('Non-catalog request blocked');
   if(globalThis.catalogFailure)return new globalThis.Response('',{status:503});
   return new globalThis.Response(JSON.stringify({models:[...ids.map(slug=>({slug,display_name:slug,visibility:'list'})),{slug:'hidden-fixture',display_name:'Hidden',visibility:'hide'}]}));
  };
 },ids);
 await page.getByRole('button',{name:'Session',exact:true}).click();
 await page.getByRole('combobox',{name:'Provider for answer 1',exact:true}).selectOption('chatgpt');
 const before=await page.evaluate(()=>window.cue.status());assert(before.providers.find(p=>p.id==='chatgpt').models.length===0,'Startup is offline; account catalog is initially empty');
 await page.getByRole('button',{name:'Refresh catalog',exact:true}).click();
 await page.waitForFunction(()=>window.cue.status().then(s=>s.providers.find(p=>p.id==='chatgpt').models.length===3));
 const models=await page.getByRole('combobox',{name:'Model for answer 1',exact:true}).evaluate(node=>[...node.options].map(o=>o.value));
 assert(ids.every(id=>models.includes(id))&&!models.includes('hidden-fixture'),'All three exact catalog IDs displayed; hidden model excluded');
 for(const id of ids){await page.getByRole('combobox',{name:'Model for answer 1',exact:true}).selectOption(id);await page.waitForFunction(id=>window.cue.status().then(s=>s.experience.preferredModels.chatgpt?.model===id),id);}
 assert(true,'Each exact model selectable and persisted without alias translation');
 const picker=page.getByRole('combobox',{name:'Model for answer 1',exact:true});await picker.click();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.cue.status().then(s=>s.experience.preferredModels.chatgpt?.model==='gpt-6-luna'));assert(true,'Native mouse-open and keyboard model selection selects Luna');
 await app.evaluate(()=>{globalThis.catalogFailure=true;});await page.getByRole('button',{name:'Refresh catalog',exact:true}).click();
 const after=await page.evaluate(()=>window.cue.status());assert(after.providers.find(p=>p.id==='chatgpt').models.length===3,'Failed refresh preserves last good catalog');
 result.failedRefreshNote=after.providers.find(p=>p.id==='chatgpt').note;
 result.noteVisible=await page.locator('.model-connection-note').isVisible();assert(result.noteVisible,'Catalog refresh failure is visibly reported beside retained models');
 result.requestUrls=await app.evaluate(()=>globalThis.requests);
 assert(result.requestUrls.every(url=>url==='https://api.openai.com/v1/models'),'Only mocked catalog requests executed; no inference');
 result.audio=(await page.evaluate(()=>window.cue.status())).audio;assert(result.audio==='stopped','Audio stayed stopped');
 await mkdir('evidence',{recursive:true});await writeFile('evidence/model-picker-diagnostic-0.5.4.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();}
