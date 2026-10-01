import {languagePreferences,languageDefaults,whisperArguments} from './languages';
import {realtimeSettings,realtimeDefaults} from './realtime';
import {savedSelections,providerPreference} from './experience';
import type {ExperiencePreferences,ExperiencePatch,Selection} from './shared';
import {sendIfAlive} from './event-lifecycle';
import {ModelManager} from './model-manager';
import speechCatalog from './speech-catalog.json';
import type {SpeechModel} from './model-manager';
import {capabilities,fallbackCatalog,resolveSelection} from './capabilities';
import {NativeAudio} from './native-audio';
import {validateImage} from './vision';
import type {AudioSelection,AudioSource} from './shared';
import { app, BrowserWindow, ipcMain, globalShortcut, session, shell, dialog, desktopCapturer, screen, Tray, Menu, nativeImage } from 'electron';

import { join, extname } from 'node:path';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';

import { spawn } from 'node:child_process';

import { tmpdir, release, setPriority, constants } from 'node:os';

import { Vault } from './vault';

import { ChatGPTAuth } from './auth';

import { providers, listModels } from './providers';

import { Runner } from './runner';

import { fitBounds, overlayDefaults, overlayPreferences, requireRecovery } from './overlay';

import type { OverlayPreferences } from './overlay';

import { trayCommands,toggleTray,closeToTray } from './tray-controls';
import { shortcutDefaults, shortcutPreferences, rebind, recoveryCandidates } from './shortcuts';
import type { Shortcuts, ShortcutAction } from './shortcuts';
import { CaptureControl } from './core';

import type { AssistRequest, Model, ProviderId, Status } from './shared';

if(process.argv.includes('--smoke')){const profile=process.argv.find(arg=>arg.startsWith('--smoke-profile='))?.slice('--smoke-profile='.length);if(profile&&!/^[a-z0-9-]{1,48}$/i.test(profile))throw new Error('Invalid isolated smoke profile name.');app.setPath('userData',profile?join(process.cwd(),'test-user-data',profile):join(process.cwd(),'test-user-data'));}

const single=app.requestSingleInstanceLock();if(!single)app.quit();

let window:BrowserWindow;let vault:Vault;let auth:ChatGPTAuth;let runner:Runner;

const audio=new CaptureControl();const catalogs=new Map<ProviderId,Model[]>();const notes=new Map<ProviderId,string>();const hotkeys:Record<string,boolean>={};const hotkeyBindings:Record<string,string>={};

let nativeAudio:NativeAudio;let modelManager:ModelManager;let audioChoice:AudioSelection={kind:'microphone',id:'default'};let audioCatalog:AudioSource[]=[];let nativeQueued=false;let visionBusy=false;let audioGeneration=0;
function resource(...parts:string[]):string{return join(app.isPackaged?process.resourcesPath:process.cwd(),'bundled',...parts);}
function whisperSettings(){return {whisperExe:vault.data.settings.whisperExe||resource('whisper','whisper-cli.exe'),whisperModel:vault.data.settings.whisperModel||resource('whisper','ggml-base-q5_1.bin')};}
let experience:ExperiencePreferences={languages:{...languageDefaults},realtime:{...realtimeDefaults},preferredModels:{}};let experienceFile='';
let quitting=false;let shortcutFile='';let shortcuts:Shortcuts={...shortcutDefaults};
const callbacks:Record<ShortcutAction,()=>void>={assist:()=>action('assist'),visibility:()=>{if(window.isVisible())hide();else recover();},pause:()=>stopAudio('paused'),cancel:()=>{runner.cancel();action('cancel');},capture:()=>{recover();action('capture');}};
let ui:OverlayPreferences={...overlayDefaults};let clickThrough=false;let recoveryTimer:ReturnType<typeof setTimeout>|undefined;let geometryTimer:ReturnType<typeof setTimeout>|undefined;let tray:Tray|undefined;let uiFile='';

function areas(){return screen.getAllDisplays().map(d=>d.workArea);}

function saveUI():void {if(uiFile)writeFileSync(uiFile,JSON.stringify(ui),'utf8');}

function recover():void {clearTimeout(recoveryTimer);clickThrough=false;window.setIgnoreMouseEvents(false);window.setFocusable(true);window.setBounds(fitBounds(window.getBounds(),areas(),ui.compact));window.setAlwaysOnTop(ui.topmost);window.setSkipTaskbar(true);if(window.isMinimized())window.restore();window.show();window.focus();changed();}

function patchUI(patch:unknown):void {const compactBefore=ui.compact;ui=overlayPreferences(patch,ui);if(patch&&typeof patch==='object'&&'bounds' in patch)window.setBounds(fitBounds(ui.bounds,areas(),ui.compact));window.setAlwaysOnTop(ui.topmost);window.setMovable(!ui.positionLocked);if(ui.compact!==compactBefore){const b=window.getBounds();window.setBounds(fitBounds({...b,width:ui.compact?520:960,height:ui.compact?480:760},areas(),ui.compact));}ui.bounds=window.getBounds();saveUI();changed();}

function setClickThrough(on:boolean):void {if(typeof on!=='boolean')throw new Error('Invalid interaction setting.');if(!on){recover();return;}requireRecovery(hotkeys.recover===true);clearTimeout(recoveryTimer);clickThrough=true;window.setIgnoreMouseEvents(true,{forward:true});window.setFocusable(false);recoveryTimer=setTimeout(recover,30000);changed();}

let transcribing=false;let transcriptionProcess:ReturnType<typeof spawn>|undefined;let lastWavAt=0;

function captureNote():string {

 if(process.platform!=='win32')return 'Windows capture exclusion is unavailable on this OS.';

 const build=Number(release().split('.')[2]);return build>=19041?'OS exclusion requested. Teams, Meet and Zoom share modes still need a separate check.':'Older Windows: protected captures may show a black rectangle.';

}

function providerNote(id:ProviderId):string {
 if(id==='practice')return 'Explicit offline practice: a local template, no AI request.';
 if(id!=='chatgpt')return 'Separate provider key and billing required.';
 const a=vault.active();if(!a?.access)return a?'Saved ChatGPT account has no completed local session. Review Accounts; registration/consent is preserved.':'No local ChatGPT session. Connect in Accounts only when you choose.';
 if(!a.scopes.includes('chatgpt.tokens.use.direct')||!a.scopes.includes('resource.invoke'))return 'Saved ChatGPT session lacks the required plan-usage permission. Review the existing account authorization; no grant was changed.';
 if((a.expires??0)<Date.now()&&!a.refresh)return 'Saved ChatGPT session expired and has no renewal token. Existing account is preserved; review Accounts before reauthorizing.';
 return 'Signed in locally. Refresh the account model catalog if needed; live inference has not been verified by development tests.';
}
function status():Status {

 return {version:app.getVersion(),trayOnly:true,experience,providers:(Object.keys(providers) as ProviderId[]).map(id=>({id,name:providers[id].name,connected:id==='practice'||(id==='chatgpt'?Boolean(vault.active()?.access&&vault.active()?.scopes.includes('chatgpt.tokens.use.direct')&&vault.active()?.scopes.includes('resource.invoke')):Boolean(vault.data.keys[id])),models:catalogs.get(id)?.length?catalogs.get(id)!:(fallbackCatalog[id]??[]).map(model=>({id:model,name:model+' · documented fallback (access unverified)',capabilities:capabilities(id,model)})),note:notes.get(id)??providerNote(id)})),accounts:vault.data.accounts.map(a=>({id:a.id,label:a.label,active:a.id===vault.data.active,connected:Boolean(a.access)})),capture:window?.isContentProtected()??false,captureNote:captureNote(),hotkeys,hotkeyBindings,audio:audio.state,audioSource:audio.source,whisper:Boolean(existsSync(whisperSettings().whisperExe)&&existsSync(whisperSettings().whisperModel)),requestCount:runner?.requestCount??0,usage:runner?.usage??{input:0,output:0},authPending:auth?.isPending()??false,overlay:{...ui,clickThrough,recovery:hotkeyBindings.recover??'',recoveryAvailable:hotkeys.recover===true}};

}

function changed():void {if(window&&!window.isDestroyed()&&vault)send('status',status());}

function action(name:string):void {send('action',name);}

function send(channel:string,value:unknown):void {
 // All asynchronous work can outlive the overlay during quit. Check before even
 // reading webContents: that getter throws after its BrowserWindow is destroyed.
 sendIfAlive(window,channel,value);
}

async function token(id:ProviderId):Promise<string> {if(id==='practice')return '';if(id==='chatgpt')return auth.access();const key=vault.data.keys[id];if(!key)throw new Error('Configure this provider key first.');return key;}

async function refresh(only?:ProviderId):Promise<void> {

 for(const id of Object.keys(providers) as ProviderId[]) {if(only&&id!==only)continue;

  if(id!=='practice'&&!(id==='chatgpt'?vault.active()?.access:vault.data.keys[id])){catalogs.delete(id);continue;}

  try {const models=await listModels(id,await token(id));catalogs.set(id,models);notes.delete(id);}catch(error){if(id!=='chatgpt'&&!catalogs.get(id)?.length)catalogs.set(id,(fallbackCatalog[id]??[]).map(model=>({id:model,name:model+' · documented fallback (access unverified)',capabilities:capabilities(id,model)})));const code=/HTTP (\d{3})/.exec(error instanceof Error?error.message:'')?.[1];notes.set(id,id==='chatgpt'?`ChatGPT catalog unavailable${code?' (HTTP '+code+')':''}. Existing login is preserved. Check account/model access and retry Refresh; no practice fallback was used.`:'Discovery unavailable. Documented fallback IDs may need account access; add an exact ID if needed. No inference has been tested.');}

  if(id!=='chatgpt') {const all=catalogs.get(id)??[];for(const model of vault.data.models[id]??[])if(!all.some(m=>m.id===model))all.push({id:model,name:model+' · configured'});catalogs.set(id,all);}

 }

 changed();

}

function stopAudio(state:'paused'|'stopped'):void {

 if(state==='paused'&&audio.state==='stopped')return;

 audioGeneration++;audio.set(state,audio.source,false);nativeAudio?.stop();transcriptionProcess?.kill();action(state==='paused'?'pause-audio':'stop-audio');changed();

}

function hide():void {audioGeneration++;clearTimeout(recoveryTimer);clickThrough=false;window.setIgnoreMouseEvents(false);window.setFocusable(true);audio.hide();nativeAudio?.stop();if(audio.state==='paused')action('pause-audio');transcriptionProcess?.kill();runner?.cancel();action('cancel');auth?.cancel();window.hide();changed();}

function handle(name:string,fn:(...args:any[])=>any):void {

 ipcMain.handle(name,async(event,...args)=>{

  if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Untrusted app frame.');

  return fn(...args);

 });

}

async function transcribe(wav:ArrayBuffer):Promise<string> {

 if(audio.state!=='recording')throw new Error('Audio capture is paused or stopped.');

 if(transcribing)return '';if(Date.now()-lastWavAt<3000)throw new Error('Audio chunks arrived too quickly.');

 if(!(wav instanceof ArrayBuffer)||wav.byteLength<44||wav.byteLength>16*16000*2+44)throw new Error('Invalid audio chunk.');

 const bytes=Buffer.from(wav);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.readUInt32LE(24)!==16000||bytes.readUInt16LE(22)!==1||bytes.readUInt16LE(34)!==16)throw new Error('Local transcription needs 16 kHz mono PCM WAV.');

 const settings=whisperSettings();if(!status().whisper)throw new Error('Choose a local whisper-cli executable and GGML model in Controls.');

 transcribing=true;lastWavAt=Date.now();const dir=await mkdtemp(join(tmpdir(),'cueglass-'));const input=join(dir,'audio.wav'),output=join(dir,'transcript');

 try {

  await writeFile(input,bytes);

  await new Promise<void>((resolve,reject)=>{

   const child=spawn(settings.whisperExe,whisperArguments(settings.whisperModel,input,output,experience.languages),{windowsHide:true,stdio:'ignore',shell:false});transcriptionProcess=child;if(child.pid)try{setPriority(child.pid,constants.priority.PRIORITY_BELOW_NORMAL);}catch{ /* CPU thread cap remains in effect */ }

   const timeout=setTimeout(()=>child.kill(),60000);

   child.once('error',()=>{clearTimeout(timeout);reject(new Error('Local Whisper could not launch. Verify its runtime dependencies.'));});

   child.once('exit',code=>{clearTimeout(timeout);transcriptionProcess=undefined;if(code===0)resolve();else reject(new Error('Local transcription stopped or failed.'));});

  });

  if(audio.state!=='recording')return '';return (await readFile(output+'.txt','utf8')).trim().slice(0,12000);

 }finally{transcribing=false;await rm(dir,{recursive:true,force:true});}

}

app.whenReady().then(async()=>{

 if(!single)return;

 vault=new Vault(join(app.getPath('userData'),'secure-store.bin'));

 auth=new ChatGPTAuth(vault,async url=>{if(process.argv.includes('--smoke')){Object.assign(globalThis,{cueAuthTest:{url}});return;}await shell.openExternal(url);},changed);

 runner=new Runner(token,s=>status().providers.some(p=>p.id===s.provider&&p.connected&&p.models.some(m=>m.id===s.model)),e=>{send('answer',e);if(e.kind==='done'||e.kind==='error')changed();});

 catalogs.set('practice',[{id:'offline-coach',name:'Practice prompts · no AI request'}]);

 for(const [id,models] of Object.entries(vault.data.models))catalogs.set(id as ProviderId,(models??[]).map(id=>({id,name:id+' · configured'})));

 modelManager=new ModelManager(join(app.getPath('userData'),'models'),speechCatalog as SpeechModel[],Object.fromEntries((speechCatalog as SpeechModel[]).filter(model=>['tiny-q5_1','base-q5_1','small-q5_1'].includes(model.id)).map(model=>[model.id,resource('whisper',model.file)])),progress=>send('model-download',progress));
 nativeAudio=new NativeAudio(resource('native','CueAudio.exe'),async (wav,turn)=>{if(audio.state!=='recording'||nativeQueued)return;nativeQueued=true;const generation=audioGeneration;try{const text=await transcribe(wav);if(text&&audio.state==='recording'&&generation===audioGeneration)send('speech-text',{text,speaker:audio.source==='system'?'Interviewer':'You',turn:generation+':'+(turn??0)});}finally{nativeQueued=false;}},peak=>send('audio-meter',peak),message=>{stopAudio('stopped');if(message)action('notice:'+message);},undefined,(active,turn)=>send('audio-voice',{active,turn:audioGeneration+':'+turn}),()=>action('notice:Local transcription is busy; an audio chunk was dropped. Use a faster model or pause and correct the transcript.'));
 experienceFile=join(app.getPath('userData'),'experience-preferences.json');try{const stored=JSON.parse(readFileSync(experienceFile,'utf8'));experience={languages:languagePreferences(stored.languages),realtime:realtimeSettings(stored.realtime),preferredProvider:providerPreference(stored.preferredProvider),preferredModels:savedSelections(stored.preferredModels)};}catch{ /* safe independent defaults */ }
 uiFile=join(app.getPath('userData'),'ui-preferences.json');try{ui=overlayPreferences(JSON.parse(readFileSync(uiFile,'utf8')));}catch{ui={...overlayDefaults};}

 shortcutFile=join(app.getPath('userData'),'shortcuts.json');try{shortcuts=shortcutPreferences(JSON.parse(readFileSync(shortcutFile,'utf8')));}catch{shortcuts={...shortcutDefaults};}
 const bounds=fitBounds(ui.bounds,areas(),ui.compact);

 window=new BrowserWindow({...bounds,minWidth:Math.min(440,bounds.width),minHeight:Math.min(320,bounds.height),title:'Cueglass',frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:ui.topmost,resizable:true,movable:!ui.positionLocked,skipTaskbar:true,show:false,webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});

 const saveGeometry=()=>{clearTimeout(geometryTimer);geometryTimer=setTimeout(()=>{if(!window.isDestroyed()){ui.bounds=window.getBounds();saveUI();}},250);};window.on('move',saveGeometry);window.on('resize',saveGeometry);

 screen.on('display-removed',()=>{if(!window.isDestroyed())window.setBounds(fitBounds(window.getBounds(),areas(),ui.compact));});screen.on('display-metrics-changed',()=>{if(!window.isDestroyed())window.setBounds(fitBounds(window.getBounds(),areas(),ui.compact));});

 window.setMenuBarVisibility(false);window.setSkipTaskbar(true);window.setContentProtection(process.platform==='win32');

 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());

 window.on('show',()=>window.setSkipTaskbar(true));window.on('restore',()=>window.setSkipTaskbar(true));window.on('focus',()=>window.setSkipTaskbar(true));
 window.on('will-move',event=>{if(ui.positionLocked)event.preventDefault();});
 window.on('minimize',hide);window.on('close',event=>{clearTimeout(geometryTimer);clearTimeout(recoveryTimer);ui.bounds=window.getBounds();saveUI();stopAudio('stopped');runner.cancel();auth.cancel();if(closeToTray(quitting,Boolean(tray&&!tray.isDestroyed()))){event.preventDefault();hide();}});
 window.on('closed',()=>{clearTimeout(geometryTimer);clearTimeout(recoveryTimer);audioGeneration++;nativeAudio?.stop();transcriptionProcess?.kill();runner?.cancel();auth?.cancel();});

 session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>{

  const types=('mediaTypes' in details?details.mediaTypes:[])??[];

  callback(contents===window.webContents&&audio.state==='recording'&&(permission==='media'||permission==='display-capture')&&types.every(t=>t==='audio'||(audio.source==='system'&&t==='video')));

 });

 session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===window.webContents&&audio.state==='recording'&&(permission==='media'||permission==='display-capture'));

 session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{

  if(audio.state!=='recording'||audio.source!=='system'||!request.audioRequested||request.frame!==window.webContents.mainFrame){callback({});return;}

  try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(audio.state!=='recording'||!sources[0]){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}

 });

 handle('status',status);
 handle('experience',(patch:ExperiencePatch)=>{if(!patch||typeof patch!=='object')throw new Error('Invalid language/realtime settings.');const languageNext=languagePreferences(patch.languages,experience.languages);if(audio.state==='recording'&&(languageNext.speechLanguage!==experience.languages.speechLanguage||languageNext.mixedSpeech!==experience.languages.mixedSpeech))throw new Error('Pause audio before changing speech language.');experience={...experience,languages:languagePreferences(patch.languages,experience.languages),realtime:realtimeSettings(patch.realtime,experience.realtime)};writeFileSync(experienceFile,JSON.stringify(experience),'utf8');changed();});
 handle('save-selection',(selection:Selection,primary=true)=>{const validated=savedSelections({[selection?.provider]:selection});if(!Object.hasOwn(validated,selection?.provider))throw new Error('Invalid model preference.');experience.preferredModels={...experience.preferredModels,...validated};if(primary===true)experience.preferredProvider=selection.provider;writeFileSync(experienceFile,JSON.stringify(experience),'utf8');changed();});

 handle('capture-sources',async()=>{const sources=await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false});return sources.filter(s=>s.name!=='Cueglass'&&!s.id.startsWith('window:'+window.getNativeWindowHandle().readBigUInt64LE().toString()+':')).map(s=>({id:s.id,name:s.name,kind:s.id.startsWith('window:')?'window':'screen'}));});
 handle('capture-image',async(id:string)=>{if(visionBusy)throw new Error('A capture is already in progress.');if(typeof id!=='string'||! /^(window|screen):[a-zA-Z0-9:.-]{1,100}$/.test(id))throw new Error('Select an available window or screen.');visionBusy=true;try{const sources=await desktopCapturer.getSources({types:[id.startsWith('window:')?'window':'screen'],thumbnailSize:{width:1920,height:1080},fetchWindowIcons:false});const source=sources.find(s=>s.id===id&&s.name!=='Cueglass');if(!source||source.thumbnail.isEmpty())throw new Error('This window cannot be captured. It may be closed, minimized or protected.');const size=source.thumbnail.getSize();const bytes=source.thumbnail.toJPEG(88);const preview={dataUrl:'data:image/jpeg;base64,'+bytes.toString('base64'),width:size.width,height:size.height};validateImage(preview);return preview;}finally{visionBusy=false;}});

 handle('sign-in',async(id?:string)=>{runner.cancel();const r=await auth.signIn(id);await refresh();return r;});

 handle('cancel-sign-in',()=>auth.cancel());

 handle('switch-account',async(id:string)=>{if(!vault.data.accounts.some(a=>a.id===id))throw new Error('Account not found.');runner.cancel();auth.cancel();vault.data.active=id;vault.save();catalogs.delete('chatgpt');await refresh();});

 handle('sign-out',async()=>{runner.cancel();catalogs.delete('chatgpt');return auth.signOut();});

 handle('save-key',async(id:ProviderId,key:string)=>{if(!['claude','deepseek','glm','kimi','gemini'].includes(id)||typeof key!=='string'||key.length<10||key.length>4096)throw new Error('Enter a valid provider key.');vault.data.keys[id]=key.trim();vault.save();await refresh();});

 handle('delete-key',(id:ProviderId)=>{runner.cancel();delete vault.data.keys[id];delete vault.data.models[id];catalogs.delete(id);vault.save();changed();});

 handle('add-model',(id:ProviderId,model:string)=>{if(!['claude','deepseek','glm','kimi','gemini'].includes(id)||typeof model!=='string'||!/^[a-zA-Z0-9._:/-]{1,160}$/.test(model))throw new Error('Configure a key and enter an exact model ID from that provider.');vault.data.models[id]=[...new Set([...(vault.data.models[id]??[]),model])];vault.save();const models=catalogs.get(id)??[];if(!models.some(m=>m.id===model))models.push({id:model,name:model+' · configured'});catalogs.set(id,models);changed();});

 handle('refresh-models',(id?:ProviderId)=>{if(id!==undefined&&!Object.hasOwn(providers,id))throw new Error('Unknown provider catalog.');return refresh(id);});handle('assist',(r:AssistRequest)=>{const selections=r.selections.map(s=>resolveSelection(s,catalogs.get(s.provider)??[],Boolean(r.image)));if(new Set(selections.map(s=>s.provider+':'+s.model)).size!==selections.length)throw new Error('Auto resolved duplicate models. Choose distinct models for independent answers.');if(r.image){validateImage(r.image);const image=nativeImage.createFromDataURL(r.image.dataUrl);if(image.isEmpty()||image.getSize().width!==r.image.width||image.getSize().height!==r.image.height)throw new Error('Image preview dimensions are invalid.');}return runner.start({...r,selections});});handle('cancel',()=>runner.cancel());

 handle('protect',(on:boolean)=>{if(typeof on!=='boolean')throw new Error('Invalid capture setting.');window.setContentProtection(on&&process.platform==='win32');changed();});

 handle('pin',(on:boolean)=>{if(typeof on!=='boolean')throw new Error('Invalid position lock.');patchUI({positionLocked:on});});handle('hide',hide);handle('overlay',patchUI);handle('click-through',setClickThrough);handle('recover',recover);handle('resize-overlay',(width:number,height:number)=>{if(!Number.isFinite(width)||!Number.isFinite(height))throw new Error('Invalid overlay size.');const bounds=window.getBounds();window.setBounds(fitBounds({...bounds,width:Math.round(Math.max(440,Math.min(2400,width))),height:Math.round(Math.max(320,Math.min(1800,height)))},areas(),ui.compact));});handle('minimize',hide);handle('close',()=>window.close());

 handle('audio-sources',async()=>{const raw=await nativeAudio.list(Number(release().split('.')[2])>=20348);audioCatalog=raw;return raw;});
 handle('audio-selection',()=>audioChoice);
 handle('select-audio',(source:AudioSelection)=>{if(audio.state==='recording')throw new Error('Pause audio before changing its source.');if(!source||!['microphone','system','output','app'].includes(source.kind)||typeof source.id!=='string'||source.id.length>500)throw new Error('Invalid audio source.');if(source.id!=='default'&&!audioCatalog.some(s=>s.kind===source.kind&&s.id===source.id&&s.supported))throw new Error('Refresh sources and select an available device or supported application.');if(source.kind==='app'&&Number(release().split('.')[2])<20348)throw new Error('Application loopback needs Windows build 20348 or newer.');audioChoice={...source};});
 handle('speech-models',()=>modelManager.list(whisperSettings().whisperModel));handle('download-model',(id:string)=>modelManager.download(id));handle('cancel-model-download',()=>modelManager.cancel());handle('select-speech-model',async(id:string)=>{if(audio.state==='recording')throw new Error('Pause audio before switching speech models.');const path=await modelManager.select(id);vault.data.settings.whisperModel=path;vault.save();changed();});
 handle('audio',async(state:'recording'|'paused'|'stopped',source:'microphone'|'system',consent:boolean)=>{if(!['recording','paused','stopped'].includes(state)||!['microphone','system'].includes(source))throw new Error('Invalid audio control.');if(state==='recording'&&audio.state==='recording')throw new Error('Audio is already recording.');if(state==='recording'&&!status().whisper)throw new Error('Local Whisper runtime/model unavailable.');if(state==='recording')whisperArguments(whisperSettings().whisperModel,'language-validation.wav','language-validation',experience.languages);audio.set(state,source,consent===true);const generation=++audioGeneration;changed();if(state!=='recording'){nativeAudio.stop();transcriptionProcess?.kill();}else {try{await nativeAudio.start(audioChoice);}catch(error){if(generation===audioGeneration){audio.set('stopped',source,false);changed();}throw error;}}changed();});

 handle('transcribe',transcribe);handle('settings',whisperSettings);

 handle('pick-whisper',async()=>{

  const exe=await dialog.showOpenDialog(window,{title:'Choose whisper-cli.exe (runs locally)',filters:[{name:'Windows executable',extensions:['exe']}],properties:['openFile']});if(exe.canceled)return vault.data.settings;

  const model=await dialog.showOpenDialog(window,{title:'Choose a Whisper GGML model',filters:[{name:'GGML model',extensions:['bin']}],properties:['openFile']});if(model.canceled)return vault.data.settings;

  if(extname(exe.filePaths[0]).toLowerCase()!=='.exe'||extname(model.filePaths[0]).toLowerCase()!=='.bin')throw new Error('Choose whisper-cli.exe and a .bin GGML model.');

  vault.data.settings={whisperExe:exe.filePaths[0],whisperModel:model.filePaths[0]};vault.save();changed();return vault.data.settings;

 });

 handle('import-session',async()=>{const result=await dialog.showOpenDialog(window,{title:'Import your exported Cueglass session',filters:[{name:'Session JSON',extensions:['json']}],properties:['openFile']});if(result.canceled)return;const bytes=await readFile(result.filePaths[0]);if(bytes.length>2000000)throw new Error('Session is too large.');const data=JSON.parse(bytes.toString('utf8'));if(!data||!Array.isArray(data.transcript)||typeof data.context!=='string'||typeof data.answers!=='string')throw new Error('Invalid Cueglass session.');return {transcript:data.transcript.slice(-300).filter((t:any)=>t&&typeof t.text==='string'&&['You','Interviewer'].includes(t.speaker)).map((t:any)=>({speaker:t.speaker,text:t.text.slice(0,12000)})),context:data.context.slice(0,100000),answers:data.answers.slice(0,500000)};});
 handle('export-session',async(data:unknown)=>{const text=JSON.stringify(data,null,2);if(text.length>2000000)throw new Error('Session export is too large.');const result=await dialog.showSaveDialog(window,{defaultPath:'cueglass-session.json',filters:[{name:'Session JSON',extensions:['json']}]});if(!result.canceled&&result.filePath)await writeFile(result.filePath,text,'utf8');});

 handle('manage-usage',()=>shell.openExternal('https://chatgpt.com/#settings/Usage'));

 for(const name of Object.keys(shortcuts) as ShortcutAction[]){hotkeyBindings[name]=shortcuts[name];hotkeys[name]=globalShortcut.register(shortcuts[name],callbacks[name]);}
 for(const key of recoveryCandidates){hotkeyBindings.recover=key;if(globalShortcut.register(key,recover)){hotkeys.recover=true;break;}}hotkeys.recover??=false;
 handle('shortcut',(name:ShortcutAction,key:string)=>{const old=shortcuts[name];if(key===old&&!hotkeys[name]){if(!globalShortcut.register(key,callbacks[name]))throw new Error('Shortcut is occupied by another app.');}else shortcuts=rebind(globalShortcut,shortcuts,name,key,callbacks[name]);hotkeyBindings[name]=shortcuts[name];hotkeys[name]=true;writeFileSync(shortcutFile,JSON.stringify(shortcuts),'utf8');changed();});
 handle('reset-shortcuts',()=>{for(const name of Object.keys(shortcuts) as ShortcutAction[])try{shortcuts=rebind(globalShortcut,shortcuts,name,shortcutDefaults[name],callbacks[name]);hotkeyBindings[name]=shortcuts[name];hotkeys[name]=globalShortcut.isRegistered(shortcuts[name]);}catch{ /* retain working binding if default is occupied */ }writeFileSync(shortcutFile,JSON.stringify(shortcuts),'utf8');changed();});
 const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const offset=(y*32+x)*4;const round=(x<4&&y<4)||(x>27&&y<4)||(x<4&&y>27)||(x>27&&y>27);if(round)continue;const ring=Math.hypot(x-15.5,y-15.5);const mark=ring>7&&ring<11&&!(x>19&&y>8&&y<18);pixels[offset]=mark?255:174;pixels[offset+1]=mark?255:91;pixels[offset+2]=mark?255:46;pixels[offset+3]=255;}
 const icon=nativeImage.createFromBitmap(pixels,{width:32,height:32});tray=new Tray(icon);tray.setToolTip('Cueglass - show / hide overlay');
 const commands={visible:()=>window.isVisible(),show:recover,hide,settings:()=>{recover();action('settings');},pause:()=>stopAudio('paused'),quit:()=>app.quit()};
 tray.setContextMenu(Menu.buildFromTemplate(trayCommands(commands)));tray.on('click',()=>toggleTray(commands));
 // Named commands are shared by tray actions and isolated acceptance tests.
 if(process.argv.includes('--smoke'))Object.assign(globalThis,{cueTrayTest:{commands,iconValid:!icon.isEmpty(),trayAlive:()=>Boolean(tray&&!tray.isDestroyed()),bounds:()=>tray?.getBounds(),activate:()=>tray?.emit('click')}});
 if(process.argv.includes('--smoke')){
  const fixture=new NativeAudio(resource('native','CueAudio.exe'),async()=>{},peak=>send('audio-meter',peak),message=>{if(message)action('notice:'+message);},(exe,_args,options)=>spawn(exe,['fixture-stream'],options));
  Object.assign(globalThis,{cueAudioTest:{start:async()=>{nativeAudio=fixture;audio.set('recording','system',true);await fixture.start({kind:'system',id:'default'});changed();},stop:()=>stopAudio('stopped'),late:()=>{send('audio-meter',.5);action('notice:Synthetic late event');changed();}}});
 }

 await window.loadFile(join(__dirname,'ui','index.html'));window.setSkipTaskbar(true);window.show();window.setSkipTaskbar(true);

 // Launch is offline. Refresh account catalogs only when the user requests it.

}).catch(()=>{dialog.showErrorBox('Cueglass could not start','Secure storage or the app runtime is unavailable. Rebuild or inspect the installation.');app.quit();});

app.on('second-instance',()=>{if(window){recover();}});

app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{if(quitting||!tray||tray.isDestroyed())app.quit();});

app.on('will-quit',()=>{clearTimeout(recoveryTimer);clearTimeout(geometryTimer);modelManager?.cancel();nativeAudio?.stop();tray?.destroy();globalShortcut.unregisterAll();transcriptionProcess?.kill();});
