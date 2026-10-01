import {_electron as electron} from 'playwright';
import {resolve,join} from 'node:path';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const target=resolve('.publish/installer-validation-target-v2');const unrelated=resolve('.publish/installer-unrelated-target-v2');
const old=resolve('.publish/installer-old-validation/Cueglass-Installer-Validation.exe');const setup=resolve('release/0.6.0/Cueglass-Installer-Validation.exe');
const profile='installer-lifecycle-v0-6-0-v2';const userData=resolve('test-user-data',profile);const findings={version:'0.6.0',isolatedTarget:true,isolatedRegistry:'CueglassInstallerValidation',realRecording:false,liveRequests:false,checks:[]};
const assert=(ok,message)=>{if(!ok)throw Error(message);findings.checks.push(message);};
// NSIS /D= and _?= must be last and unquoted, even with spaces. No shell is used.
function run(file,args){try{execFileSync(file,args,{windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore','pipe','pipe'],timeout:120000});return 0;}catch(e){if(typeof e.status==='number')return e.status;throw e;}}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let app;
try{
 await mkdir('evidence',{recursive:true});await mkdir(userData,{recursive:true});
 const sentinel=join(userData,'preserved-artificial-session.json');await writeFile(sentinel,JSON.stringify({text:'Artificial user-data preservation fixture',privateData:false}));const original=hash(await readFile(sentinel));
 await mkdir(unrelated,{recursive:true});await writeFile(join(unrelated,'unrelated.txt'),'Do not overwrite this fixture');
 assert(run(setup,['/S','/D='+unrelated])===2,'Nonempty unrelated target rejected');assert((await readFile(join(unrelated,'unrelated.txt'),'utf8'))==='Do not overwrite this fixture','Unrelated target preserved');
 assert(run(old,['/S','/D='+target])===0,'Older isolated installation succeeded');
 const exe=join(target,'Cueglass.exe');
 const launch=()=>electron.launch({executablePath:exe,args:['--smoke',`--smoke-profile=${profile}`],cwd:process.cwd(),timeout:30000});
 app=await launch();let page=await app.firstWindow();await page.waitForSelector('#answers');
 assert((await page.evaluate(()=>window.cue.status())).version==='0.5.4','Old installed fixture embedded version verified');
 await page.evaluate(()=>window.cue.overlay({theme:'dark',transparent:true,opacity:.75,textSize:17}));
 assert(run(setup,['/S','/D='+target])===2,'Upgrade refuses running target without closing it');assert((await page.evaluate(()=>window.cue.status())).version==='0.5.4','Running fixture remained alive after refused upgrade');
 assert(run(join(target,'Uninstall Cueglass.exe'),['/S','_?='+target])===2,'Uninstall refuses running target');assert((await page.evaluate(()=>window.cue.status())).audio==='stopped','Refused uninstall kept fixture alive with capture stopped');
 await app.close();app=undefined;
 assert(run(setup,['/S','/D='+target])===0,'Upgrade to 0.6.0 succeeded after fixture Quit');
 const expected=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else expected.push(p);}}const payload=resolve('release/0.6.0/win-unpacked');await walk(payload);
 for(const file of expected){const destination=join(target,file.slice(payload.length+1));assert(hash(await readFile(file))===hash(await readFile(destination)),'Installed byte match: '+file.slice(payload.length+1));}findings.verifiedPayloadFiles=expected.length;
 app=await launch();page=await app.firstWindow();await page.waitForSelector('#answers');const state=await page.evaluate(()=>window.cue.status());
 assert(state.version==='0.6.0'&&state.audio==='stopped','Installed 0.6.0 launched with capture stopped');assert(state.overlay.theme==='dark'&&state.overlay.textSize===17&&state.overlay.opacity===.75,'Upgrade preserved synthetic profile preferences');
 assert((await page.evaluate(()=>window.cue.speechModels())).filter(m=>['tiny-q5_1','base-q5_1','small-q5_1'].includes(m.id)&&m.installed).length===3,'Installed app discovers all three bundled presets offline');
 await app.evaluate(()=>{globalThis.fetch=async()=>{throw Error('Live network blocked by installer fixture');};});await app.close();app=undefined;
 assert(run(setup,['/S','/D='+target])===0,'Reinstall succeeded');
 await writeFile(join(target,'user-added-artificial-file.txt'),'Preserve an unrelated extra file');
 assert(run(join(target,'Uninstall Cueglass.exe'),['/S'])===0,'Isolated uninstall requested');
 for(let attempt=0;attempt<200;attempt++){if(await stat(exe).then(()=>false,()=>true))break;await new Promise(r=>setTimeout(r,100));}
 assert(await stat(exe).then(()=>false,()=>true),'Known installed executable removed');assert((await readFile(join(target,'user-added-artificial-file.txt'),'utf8'))==='Preserve an unrelated extra file','Uninstall preserved user-added extra file');assert(hash(await readFile(sentinel))===original,'User-data sentinel preserved through upgrade/reinstall/uninstall');
 findings.passed=true;await writeFile('evidence/installer-smoke-0.6.0.json',JSON.stringify(findings,null,2));console.log(JSON.stringify({...findings,checks:findings.checks.filter(s=>!s.startsWith('Installed byte match:'))},null,2));
}finally{if(app)await app.close();}
