import {contrast,speechPresets,themes,initialSelection,selectPalette} from '../experience';
import {speechLanguages} from '../languages';
import {TurnGate} from '../realtime';
import {applyLocale,message} from '../i18n';
import type {SpeechLanguage} from '../languages';
import {recordedKey,shortcutDefaults} from '../shortcuts';
import type {ShortcutAction} from '../shortcuts';
import './style.css';
import { AssistDetector } from '../core';
import {VisionUI} from './vision-ui';
import {capabilities,autoModel} from '../capabilities';
import type {GenerationMode} from '../capabilities';
import type {AudioSelection} from '../shared';
import type { AnswerEvent, ProviderId, Selection, Status, Transcript } from '../shared';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const checked=(id:string)=>el<HTMLInputElement>(id).checked;
const value=(id:string)=>el<HTMLInputElement>(id).value;
let selectionsInitialized=false;let providerTouched=false;let lastSpeechEntry='';let current:Status;const selections:Selection[]=[{provider:'practice',model:'offline-coach'}];let transcript:Transcript[]=[];let busy=false,activeRun='',pendingEvents:AnswerEvent[]=[];let expected=0,finished=0;let signature='';
const detector=new AssistDetector();const turnGate=new TurnGate();let automaticRun=false;let assistSequence=0;let latestVoiceActive=false;let latestVoiceTurn='';let lastSpeechTurn='';const speechEntries=new Map<string,string>();
const cards=new Map<string,{body:HTMLElement;status:HTMLElement;card:HTMLElement}>();
const vision=new VisionUI(notice,()=>{if(current)renderSelectors();});let audioSources:AudioSelection[]=[];
function notice(message:string):void {const box=el('notice');box.textContent=message.replace(/^Error invoking remote method '[^']+': Error: /,'');box.hidden=false;}
async function perform(fn:()=>Promise<unknown>):Promise<void> {try{await fn();}catch(error){notice(error instanceof Error?error.message:'This action could not complete.');}}
function textElement(tag:string,text:string,className?:string):HTMLElement{const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;}
function button(text:string,fn:()=>void,className?:string):HTMLButtonElement{const b=document.createElement('button');b.textContent=text;if(className)b.className=className;b.onclick=fn;return b;}
function rememberSelection(selection:Selection,index=0):void {providerTouched=true;void perform(()=>window.cue.saveSelection({...selection},index===0));}
function renderSelectors():void {
 const host=el('model-selectors');host.replaceChildren();
 selections.forEach((selection,index)=>{
  const row=textElement('div','','model-choice');const providerSelect=document.createElement('select');providerSelect.className='provider-select';providerSelect.setAttribute('aria-label',`Provider for answer ${index+1}`);
  for(const provider of current.providers)providerSelect.add(new Option(provider.name+(provider.connected?'':' · connect in Accounts'),provider.id));providerSelect.value=selection.provider;
  const provider=current.providers.find(item=>item.id===selection.provider)!;const models=provider.models;const modelSelect=document.createElement('select');modelSelect.setAttribute('aria-label',`Model for answer ${index+1}`);
  modelSelect.add(new Option('Auto · prefer lower usage / latency','auto'));for(const model of models)modelSelect.add(new Option(model.name+(model.capabilities?.vision?' · image':''),model.id));
  if(selection.model!=='auto'&&!models.some(model=>model.id===selection.model))modelSelect.add(new Option(selection.model+' · saved selection, availability unverified',selection.model));modelSelect.value=selection.model;
  const selected=selection.model==='auto'?autoModel(models,Boolean(vision.image)):models.find(model=>model.id===selection.model);const caps=selected?.capabilities??capabilities(selection.provider,selection.model);
  const modeSelect=document.createElement('select');modeSelect.setAttribute('aria-label',`Generation mode for answer ${index+1}`);for(const id of caps.modes)modeSelect.add(new Option(id==='default'?'Provider default':id==='fast'?'Fast · lower reasoning':'Reasoning · higher effort',id));if(!caps.modes.includes(selection.mode??'default'))selection.mode='default';modeSelect.value=selection.mode??'default';modeSelect.title=caps.source;
  modeSelect.onchange=()=>{selection.mode=modeSelect.value as GenerationMode;rememberSelection(selection,index);};
  providerSelect.onchange=()=>{selection.provider=providerSelect.value as ProviderId;const saved=current.experience.preferredModels[selection.provider];selection.model=saved?.model??'auto';selection.mode=saved?.mode??'default';renderSelectors();rememberSelection(selection,index);};
  modelSelect.onchange=()=>{selection.model=modelSelect.value;selection.mode='default';renderSelectors();rememberSelection(selection,index);};
  row.append(providerSelect,modelSelect,modeSelect);
  const actions=textElement('div','','model-actions');
  if(provider.id!=='practice')actions.append(button('Refresh catalog',()=>void perform(async()=>{const control=actions.querySelector<HTMLButtonElement>('.refresh-choice')!;control.disabled=true;control.textContent='Refreshing…';try{await window.cue.refreshModels(selection.provider);await window.cue.status().then(updateStatus);renderSelectors();}finally{control.disabled=false;control.textContent='Refresh catalog';}}),'refresh-choice'));
  if(selections.length>1){const remove=button('×',()=>{selections.splice(index,1);renderSelectors();},'remove-model');remove.setAttribute('aria-label',`Remove answer ${index+1}`);actions.append(remove);}
  row.append(actions);
  const info=textElement('p',provider.note,'model-connection-note');info.hidden=provider.id==='practice'&&provider.connected&&models.length>0;row.append(info);
  host.append(row);
 });el<HTMLButtonElement>('add-answer').disabled=selections.length>=3||busy;
}
function answerTitle(key:string):string {
 if(key==='comparison')return 'Answer comparison';
 const split=key.indexOf(':');if(split<0)return key;
 const providerId=key.slice(0,split) as ProviderId;const modelId=key.slice(split+1);
 const provider=current.providers.find(item=>item.id===providerId);const model=provider?.models.find(item=>item.id===modelId);
 if(providerId==='practice')return 'Offline practice template';
 return `${provider?.name??providerId} · ${model?.name??modelId}`;
}
function renderAccounts():void {
 const accounts=el('account-list');accounts.replaceChildren();accounts.className='account-list';
 for(const a of current.accounts){const row=textElement('div','','account-row');row.append(textElement('span',a.label+(a.active?' · active':'')+(a.connected?'':' · signed out')));if(!a.active)row.append(button('Use account',()=>void perform(()=>window.cue.switchAccount(a.id))));row.append(button('Reauthorize',()=>void signIn(a.id)));accounts.append(row);}
 el<HTMLButtonElement>('sign-out').disabled=!current.accounts.some(a=>a.active&&a.connected);el<HTMLButtonElement>('sign-in').disabled=current.authPending;el('cancel-sign-in').hidden=!current.authPending;
 el('add-account').hidden=!current.accounts.length;el<HTMLButtonElement>('add-account').disabled=current.authPending;
}
function renderProviders():void {
 const host=el('provider-settings');host.replaceChildren();
 for(const p of current.providers.filter(p=>!['chatgpt','practice'].includes(p.id))){
  const row=textElement('section','','provider-config');row.append(textElement('h3',`${p.name} · ${p.connected?'key stored':'not configured'}`),textElement('p',p.note,'muted'));
  const fields=textElement('div','','provider-fields');const key=document.createElement('input');key.type='password';key.autocomplete='off';key.placeholder='Provider API key';key.setAttribute('aria-label',p.name+' API key');
  const save=button('Save key',()=>{const secret=key.value;key.value='';void perform(()=>window.cue.saveKey(p.id,secret));});const remove=button('Remove',()=>void perform(()=>window.cue.deleteKey(p.id)));fields.append(key,save,remove);row.append(fields);
  const modelFields=textElement('div','','provider-fields');const model=document.createElement('input');model.placeholder='Exact model ID from your provider account';model.setAttribute('aria-label',p.name+' model ID');modelFields.append(model,button('Add model ID',()=>void perform(()=>window.cue.addModel(p.id,model.value.trim()))));row.append(modelFields);host.append(row);
 }
}
function updateStatus(status:Status):void {
 const controls=selectPalette(status.overlay.colors);for(const [key,value] of Object.entries({'--select-bg':controls.background,'--select-fg':controls.text,'--select-scheme':controls.scheme}))document.documentElement.style.setProperty(key,value);
 const oldAudio=current?.audio;current=status;if(!selectionsInitialized||!providerTouched&&selections[0]?.provider==='practice'&&!status.experience.preferredProvider&&status.providers.some(p=>p.id==='chatgpt'&&p.connected)){selections[0]=initialSelection(status.experience,status.providers);selectionsInitialized=true;renderSelectors();}
 const ui=status.overlay;document.documentElement.style.setProperty('--glass-alpha',String(ui.transparent?ui.opacity:1));document.documentElement.style.setProperty('--text-size',`${ui.textSize}px`);document.body.classList.toggle('compact',ui.compact);
 el('pin').textContent=message(ui.positionLocked?'unpin':'pin');el('pin').setAttribute('aria-pressed',String(ui.positionLocked));el('top').textContent=message(ui.topmost?'top':'untop');el('top').setAttribute('aria-pressed',String(ui.topmost));document.body.classList.toggle('position-locked',ui.positionLocked);el<HTMLInputElement>('position-locked').checked=ui.positionLocked;
 const colors=ui.colors;const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');document.documentElement.style.setProperty('--panel-rgb',rgb(colors.background));document.documentElement.style.setProperty('--ink',colors.text);document.documentElement.style.setProperty('--muted',colors.muted);document.documentElement.style.setProperty('--blue',colors.accent);document.documentElement.style.setProperty('--on-accent',contrast(colors.accent,'#ffffff')>=contrast(colors.accent,'#000000')?'#ffffff':'#000000');el<HTMLSelectElement>('theme').value=ui.theme;for(const key of ['background','text','muted','accent'] as const)if(document.activeElement!==el('color-'+key))el<HTMLInputElement>('color-'+key).value=colors[key];const ratio=Math.min(contrast(colors.text,colors.background),contrast(colors.muted,colors.background),contrast(colors.accent,colors.background));el('contrast-note').textContent=`Opaque background contrast: ${ratio.toFixed(2)}:1. ${ratio<4.5?'Below the 4.5:1 text recommendation; reset readable colors or adjust text/background.':'Text/accent contrast meets the 4.5:1 recommendation.'} Transparency/backdrop can reduce real contrast.`;
 const lang=status.experience.languages;el<HTMLSelectElement>('ui-language').value=lang.uiLocale;el<HTMLSelectElement>('speech-language').value=lang.speechLanguage;el<HTMLInputElement>('mixed-speech').checked=lang.mixedSpeech;el<HTMLSelectElement>('speech-language').disabled=lang.mixedSpeech;el<HTMLSelectElement>('answer-language').value=lang.answerLanguage;el<HTMLInputElement>('turn-pause').value=String(status.experience.realtime.pauseMs);el<HTMLInputElement>('turn-cooldown').value=String(status.experience.realtime.cooldownMs);applyLocale(document.documentElement,lang.uiLocale);el('compact').textContent=ui.compact?'Expand':'Compact';el('compact').setAttribute('aria-pressed',String(ui.compact));
 el<HTMLInputElement>('topmost').checked=ui.topmost;el<HTMLInputElement>('compact-setting').checked=ui.compact;el<HTMLInputElement>('transparent').checked=ui.transparent;el<HTMLInputElement>('opacity').disabled=!ui.transparent;el<HTMLInputElement>('opacity').value=String(100-Math.round(ui.opacity*100));el<HTMLInputElement>('opacity-number').disabled=!ui.transparent;if(document.activeElement!==el('opacity-number'))el<HTMLInputElement>('opacity-number').value=String(100-Math.round(ui.opacity*100));el('transparency-warning').hidden=!ui.transparent||ui.opacity>=.55;el('opacity-value').textContent=ui.transparent?`${100-Math.round(ui.opacity*100)}%`:'Off (solid)';el<HTMLInputElement>('text-size').value=String(ui.textSize);el('text-size-value').textContent=`${ui.textSize} px`;
 document.querySelectorAll<HTMLInputElement>('#shortcut-settings input').forEach(input=>{if(document.activeElement!==input)input.value=status.hotkeyBindings[input.dataset.action!]??'';});
 el('app-version').textContent='v'+status.version+' · drag here to move';
 el('version-status').textContent=`Cueglass ${status.version} · Tray only. Windows chooses whether the icon appears inside the overflow arrow.`;
 document.querySelectorAll('.assist-binding').forEach(e=>e.textContent=(status.hotkeyBindings.assist??'').replace('Control','Ctrl').replaceAll('+',' '));
 el('hide').title=`Show again: ${status.hotkeyBindings.visibility}`;
 const shortcut=ui.recovery.replace('CommandOrControl','Ctrl').replace('Control','Ctrl').replaceAll('+',' ');el('recovery-note').textContent=ui.recoveryAvailable?`Restore interaction: ${shortcut}, the tray icon, or reopen Cueglass. Click-through ends automatically after 30 seconds.`:'Recovery shortcuts are occupied. Click-through is disabled. The tray icon can always restore the overlay.';
 el<HTMLButtonElement>('click-through').disabled=!ui.recoveryAvailable;el('click-through').textContent=ui.clickThrough?'Restore interaction':'Enable click-through for 30 seconds';el('interaction-status').hidden=!ui.clickThrough;el('interaction-status').textContent=`Click-through active - ${shortcut} restores interaction - auto reset in 30 seconds`;

 el('usage-pill').textContent=`${status.requestCount} requests · ${status.usage.input+status.usage.output} reported tokens`;
 el('capture-title').textContent=status.capture?'Capture exclusion requested':'Capture exclusion is off';el('capture-note').textContent=status.captureNote;el<HTMLInputElement>('protect').checked=status.capture;
 el('audio-label').textContent=`Audio ${status.audio}`;el('audio-detail').textContent=`Audio ${status.audio} · ${status.audioSource==='system'?'system playback':'microphone'}${status.audio==='recording'?' · transcribing locally':''}`;
 document.querySelector('.dot')?.classList.toggle('recording',status.audio==='recording');
 if(status.audio!=='recording'&&oldAudio==='recording')el<HTMLMeterElement>('audio-meter').value=0;
 if(oldAudio==='recording'&&status.audio!=='recording'){turnGate.reset();if(busy&&automaticRun)cancel();el<HTMLInputElement>('auto').checked=false;el('turn-state').textContent='Realtime paused with audio. Enable it deliberately to resume.';}
 el('whisper-status').textContent=status.whisper?'Local Whisper ready. Bundled multilingual base Q5_1 is the default; audio is processed on this computer.':'Local runtime/model unavailable. Check the complete release folder.';
 const failed=Object.entries(status.hotkeys).filter(([,registered])=>!registered).map(([key])=>key);el('hotkey-status').textContent=failed.length?`Shortcut unavailable: ${failed.join(', ')}. Another app may already use it.`:'Global shortcuts registered.';
 el('cancel-shortcut').textContent=(status.hotkeyBindings.cancel??'Ctrl+Shift+X').replace('CommandOrControl','Ctrl').replaceAll('+',' ');
 el('footer-state').textContent=`${status.audio==='recording'?'Audio recording locally':status.audio==='paused'?'Audio paused':'Audio stopped'} · ${busy?'assisting':'ready'}`;
 renderAccounts();
 const nextSignature=JSON.stringify(status.providers);if(nextSignature!==signature){signature=nextSignature;
  renderSelectors();renderProviders();
 }
 el<HTMLButtonElement>('start-audio').disabled=status.audio==='recording';el<HTMLButtonElement>('pause-audio').disabled=status.audio!=='recording';el<HTMLButtonElement>('stop-audio').disabled=status.audio==='stopped';
}
function renderTranscript():void {
 const host=el('transcript');host.replaceChildren();for(const t of transcript){const row=textElement('div','','transcript-entry');const use=button(t.speaker+' · '+new Date(t.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),()=>{el<HTMLTextAreaElement>('question').value=t.text;},'text-button');use.setAttribute('aria-label','Use this transcript entry as an optional prompt');row.append(use,textElement('p',t.text));const edit=button(message('edit'),()=>{const input=document.createElement('textarea');input.value=t.text;input.maxLength=12000;input.setAttribute('aria-label','Correct transcript');const save=button(message('save'),()=>{const next=input.value.trim();if(!next){notice('A correction cannot be empty.');return;}if(automaticRun&&busy)cancel();if(value('question')===t.text)el<HTMLTextAreaElement>('question').value=next;detector.forget(t.text);t.text=next;const latest=transcript.at(-1)?.text??'';detector.update(latest,Date.now());turnGate.update(latest,Date.now());renderTranscript();notice('Transcript corrected locally. Review before sharing.');});row.replaceChildren(input,save,button(message('cancel'),renderTranscript));input.focus();},'text-button');edit.setAttribute('aria-label','Edit transcript entry');row.append(edit);host.append(row);}host.scrollTop=host.scrollHeight;el('conversation-count').textContent=transcript.length?`${transcript.length} transcript ${transcript.length===1?'entry':'entries'}`:'No transcript yet';
}
function addEntry(text:string,speaker:'Interviewer'|'You',turn?:string):void {
 if(!text.trim())return;let entry=turn?transcript.find(t=>t.id===speechEntries.get(turn)):undefined;if(entry)entry.text=(entry.text+' '+text.trim()).slice(0,12000);else{entry={id:crypto.randomUUID(),speaker,text:text.trim().slice(0,12000),at:Date.now()};transcript.push(entry);if(turn)speechEntries.set(turn,entry.id);}if(transcript.length>300)transcript=transcript.slice(-300);if(speechEntries.size>400)speechEntries.clear();if(turn){lastSpeechEntry=entry.id;lastSpeechTurn=turn;}renderTranscript();
 const changed=turnGate.update(entry.text,Date.now());if(changed&&busy&&automaticRun&&(speaker==='Interviewer'||entry.id===lastSpeechEntry))cancel();detector.update(entry.text,Date.now());
}
function setBusy(on:boolean):void {busy=on;el<HTMLButtonElement>('assist').disabled=on;el<HTMLButtonElement>('cancel').disabled=!on;el<HTMLButtonElement>('add-answer').disabled=on||selections.length>=3;el('footer-state').textContent=on?'Assisting · streaming responses':'Ready · manual override available';}
function answerEvent(event:AnswerEvent):void {
 if(!busy)return;if(!activeRun){pendingEvents.push(event);return;}if(event.run!==activeRun)return;
 let entry=cards.get(event.key);
 if(event.kind==='start'){
  const card=textElement('article','','answer-card'+(event.key==='comparison'?' comparison':''));card.dataset.key=event.key;card.setAttribute('aria-label',answerTitle(event.key));card.dataset.state='connecting';const top=textElement('div','','answer-top');const status=textElement('span','Waiting for response','answer-status');status.setAttribute('role','status');top.append(textElement('strong',answerTitle(event.key)),status);const body=textElement('div','','answer-body');card.append(top,body);el('answers').append(card);entry={body,status,card};cards.set(event.key,entry);
 }
 if(!entry&&event.kind==='error'){answerEvent({...event,kind:'start'});entry=cards.get(event.key);}
 if(!entry)return;
 if(event.kind==='delta'){entry.card.dataset.state='streaming';entry.body.textContent+=event.text??'';entry.status.textContent=event.firstTokenMs!==undefined?`${(event.firstTokenMs/1000).toFixed(2)}s · streaming`:'Streaming';}
 if(event.kind==='done'||event.kind==='error'){
  const canceled=event.kind==='error'&&event.text?.startsWith('Canceled.');entry.card.dataset.state=event.kind==='done'?'complete':canceled?'canceled':'failed';entry.status.textContent=event.kind==='done'?'Complete':canceled?'Stopped':'Failed';if(event.kind==='error'){const failure=textElement('div',event.text??'Provider failed.','answer-error');failure.setAttribute('role',canceled?'status':'alert');entry.body.append(failure);}else if(event.inputTokens||event.outputTokens)entry.status.title=`${event.inputTokens??0} input · ${event.outputTokens??0} output tokens`;
  finished++;if(finished>=expected){setBusy(false);void window.cue.status().then(updateStatus);}
 }
}
async function assist(automatic=false,automaticQuestion=''):Promise<void> {
 const missing=selections.find(s=>!current.providers.find(p=>p.id===s.provider)?.connected);if(missing){notice('Connect '+(current.providers.find(p=>p.id===missing.provider)?.name??missing.provider)+' in Accounts before requesting an answer. Your model selection is preserved.');return;}const latestInterviewer=[...transcript].reverse().find(entry=>entry.speaker==='Interviewer')?.text??'';const question=automaticQuestion.trim()||value('question').trim()||latestInterviewer.trim();const image=automatic?undefined:vision.image;if(!question){notice('Add interviewer words in Conversation & optional prompt, or open it to enter an optional manual prompt.');el('conversation-details').setAttribute('open','');el<HTMLTextAreaElement>('utterance').focus();return;}
 if(selections.some(s=>s.provider!=='practice')&&!checked('share-text')){notice('Allow selected providers to receive this session text before requesting an online answer.');return;}
 if(new Set(selections.map(s=>`${s.provider}:${s.model}`)).size!==selections.length){notice('Choose a different model for each independent answer.');return;}
 const sequence=++assistSequence;automaticRun=automatic;setBusy(true);activeRun='';pendingEvents=[];finished=0;expected=selections.length+(checked('compare')&&selections.length>1?1:0);el('answers').replaceChildren();cards.clear();el('notice').hidden=true;el('suggestion').hidden=true;
 try{const run=await window.cue.assist({answerLanguage:current.experience.languages.answerLanguage,image,shareImage:image?checked('share-image'):false,question,transcript,context:value('context'),selections:selections.map(s=>({...s})),compare:checked('compare'),shareText:checked('share-text'),allowPaid:checked('paid'),maxRequests:Number(value('max-requests')),maxContext:Number(value('max-context')),maxOutput:Number(value('max-output'))});if(sequence!==assistSequence)return;activeRun=run;const queued=pendingEvents;pendingEvents=[];queued.forEach(answerEvent);}catch(error){if(sequence!==assistSequence)return;setBusy(false);notice(error instanceof Error?error.message:'Could not start assistance.');}
}
function cancel():void{assistSequence++;automaticRun=false;setBusy(false);activeRun='';pendingEvents=[];for(const entry of cards.values())if(entry.card.dataset.state==='streaming'||entry.card.dataset.state==='connecting'){entry.card.dataset.state='canceled';entry.status.textContent='Stopped';const stopped=textElement('div','Stopped. Any partial answer is retained.','answer-error');stopped.setAttribute('role','status');entry.body.append(stopped);}void perform(()=>window.cue.cancel());}
async function signIn(id?:string):Promise<void>{await perform(async()=>{notice('Complete sign-in and permission approval in your browser. No inference request will be sent.');notice(await window.cue.signIn(id));});}
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===tab.dataset.tab));});
el('utterance-form').onsubmit=event=>{event.preventDefault();addEntry(value('utterance'),value('speaker') as 'Interviewer'|'You');el<HTMLTextAreaElement>('utterance').value='';};
el('assist').onclick=()=>void assist();el('cancel').onclick=cancel;
el('sample').onclick=()=>{const question='Tell me about a time you solved a difficult problem with limited information.';el<HTMLTextAreaElement>('question').value=question;addEntry(question,'Interviewer');};
el('add-answer').onclick=()=>{const unused=current.providers.map(p=>({provider:p.id,model:p.id==='practice'?'offline-coach':'auto'})).find(s=>!selections.some(existing=>existing.provider===s.provider&&existing.model===s.model));if(!unused){notice('Choose another available provider/model pair for an independent answer.');return;}selections.push(unused);renderSelectors();};
el('sign-in').onclick=()=>void signIn(current.accounts.find(a=>a.active)?.id);el('add-account').onclick=()=>void signIn();el('sign-out').onclick=()=>void perform(async()=>notice(await window.cue.signOut()));el('cancel-sign-in').onclick=()=>void perform(()=>window.cue.cancelSignIn());el('manage-usage').onclick=()=>void perform(()=>window.cue.manageUsage());el('refresh-models').onclick=()=>void perform(()=>window.cue.refreshModels());
el('protect').onchange=()=>void perform(()=>window.cue.protect(checked('protect')));el('pin').onclick=()=>void perform(()=>window.cue.pin(!current.overlay.positionLocked));el('top').onclick=()=>void perform(()=>window.cue.overlay({topmost:!current.overlay.topmost}));el('position-locked').onchange=()=>void perform(()=>window.cue.pin(checked('position-locked')));el('hide').onclick=()=>void perform(()=>window.cue.hide());
el('appearance').onclick=()=>{el('overlay-settings').hidden=!el('overlay-settings').hidden;if(!el('overlay-settings').hidden)el('opacity').focus();};
el('dismiss-appearance').onclick=()=>{el('overlay-settings').hidden=true;el('appearance').focus();};
el('compact').onclick=()=>void perform(()=>window.cue.overlay({compact:!current.overlay.compact}));
el('topmost').onchange=()=>void perform(()=>window.cue.overlay({topmost:checked('topmost')}));el('compact-setting').onchange=()=>void perform(()=>window.cue.overlay({compact:checked('compact-setting')}));
el('opacity-number').onchange=()=>void perform(async()=>{const input=value('opacity-number');const percent=Number(input);if(!input.trim()||!Number.isFinite(percent)||percent<0||percent>90)throw new Error('Enter a transparency percentage from 0 to 90.');await window.cue.overlay({opacity:1-percent/100});});
el('transparent').onchange=()=>void perform(()=>window.cue.overlay({transparent:checked('transparent')}));
 el('opacity').oninput=()=>void perform(()=>window.cue.overlay({opacity:1-Number(value('opacity'))/100}));el('text-size').oninput=()=>void perform(()=>window.cue.overlay({textSize:Number(value('text-size'))}));
el('click-through').onclick=()=>void perform(()=>window.cue.clickThrough(!current.overlay.clickThrough));
el('reset-overlay').onclick=()=>void perform(async()=>{await window.cue.overlay({topmost:true,positionLocked:false,theme:'light',transparent:true,opacity:0.88,textSize:15,compact:false,bounds:{x:80,y:60,width:960,height:760}});await window.cue.recover();});
el('minimize').onclick=()=>void perform(()=>window.cue.minimize());el('close').onclick=()=>void perform(()=>window.cue.close());
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!el('overlay-settings').hidden){el('overlay-settings').hidden=true;el('appearance').focus();}void perform(()=>window.cue.recover());}});
el('import').onclick=()=>void perform(async()=>{const data=await window.cue.importSession();if(!data)return;for(const entry of data.transcript)addEntry(entry.text,entry.speaker);el<HTMLTextAreaElement>('context').value=data.context;if(data.answers){el('answers').replaceChildren(textElement('article',data.answers,'answer-body'));}notice('Session imported locally. Online sharing and audio consent remain under your control.');});
el('pick-whisper').onclick=()=>void perform(async()=>{await window.cue.pickWhisper();});
async function refreshAudioSources():Promise<void>{const sources=await window.cue.audioSources();const select=el<HTMLSelectElement>('audio-source');select.replaceChildren();audioSources=[{kind:'microphone',id:'default'},{kind:'system',id:'default'},...sources];select.add(new Option('Microphone · Windows default','0'));select.add(new Option('System playback · Windows default output (all apps)','1'));sources.forEach((source,i)=>{const option=new Option(`${source.kind==='output'?'Output loopback':source.kind==='app'?'App + children':'Microphone'}: ${source.name}${source.supported?'':' (requires newer Windows)'}`,String(i+2));option.disabled=!source.supported;select.add(option);});}
el('refresh-audio').onclick=()=>void perform(refreshAudioSources);
el('start-audio').onclick=()=>void perform(async()=>{if(!current.whisper)throw new Error('Local Whisper is unavailable. Keep the full release folder together.');if(!audioSources.length)await refreshAudioSources();const choice=audioSources[Number(value('audio-source'))];if(!choice)throw new Error('Refresh and choose an audio source.');await window.cue.selectAudio(choice);await window.cue.audio('recording',choice.kind==='microphone'?'microphone':'system',checked('audio-consent'));});
el('pause-audio').onclick=()=>void perform(()=>window.cue.audio('paused',current.audioSource,false));el('stop-audio').onclick=()=>void perform(()=>window.cue.audio('stopped',current.audioSource,false));
async function speechModels():Promise<void>{const models=await window.cue.speechModels();const host=el('speech-models');host.replaceChildren();for(const model of models){const row=textElement('section','','speech-model');row.append(textElement('strong',model.name+(model.selected?' · selected':'')),textElement('p',`${(model.bytes/1048576).toFixed(1)} MiB · ${model.language} · MIT`, 'muted'),textElement('p',model.tradeoff,'muted'));const control=button(model.installed?'Use model':'Download',()=>void perform(async()=>{if(model.installed){await window.cue.selectSpeechModel(model.id);notice('Speech model selected. Resume audio manually.');}else{notice('Downloading '+model.name+'; current model remains usable.');await window.cue.downloadModel(model.id);}await speechModels();await renderSpeechPresets();}));control.disabled=model.selected;row.append(control);host.append(row);}}
el('manage-models').onclick=()=>void perform(async()=>{el('model-manager').hidden=!el('model-manager').hidden;if(!el('model-manager').hidden)await speechModels();});
el('cancel-model-download').onclick=()=>void perform(()=>window.cue.cancelModelDownload());
window.cue.onDownload(progress=>{el<HTMLProgressElement>('model-download-progress').max=progress.total;el<HTMLProgressElement>('model-download-progress').value=progress.received;el('model-download-status').textContent=`${progress.id}: ${progress.state} · ${(progress.received/1048576).toFixed(1)} / ${(progress.total/1048576).toFixed(1)} MiB${progress.message?' · '+progress.message:''}`;el<HTMLButtonElement>('cancel-model-download').disabled=!['downloading','verifying'].includes(progress.state);});
window.cue.onMeter(peak=>el<HTMLMeterElement>('audio-meter').value=peak);
const labels:Record<ShortcutAction,string>={assist:'Assist',visibility:'Show / hide',pause:'Pause audio',cancel:'Stop answers',capture:'Capture image (preview only)'};
for(const name of Object.keys(shortcutDefaults) as ShortcutAction[]){const row=textElement('label',labels[name],'shortcut-row');const input=document.createElement('input');input.readOnly=true;input.placeholder='Click and press a key combination';input.setAttribute('aria-label',labels[name]+' shortcut');input.dataset.action=name;input.onfocus=()=>{input.value='Press a key combination (Esc cancels)';};input.onblur=()=>{input.value=current?.hotkeyBindings[name]??shortcutDefaults[name];};input.onkeydown=event=>{event.preventDefault();event.stopPropagation();if(event.key==='Escape'){input.blur();return;}try{const key=recordedKey(event);if(key)void perform(async()=>{await window.cue.shortcut(name,key);input.blur();input.value=key;notice(labels[name]+' shortcut saved.');});}catch(e){notice(e instanceof Error?e.message:'Invalid shortcut.');}};row.append(input);el('shortcut-settings').append(row);}
el('reset-shortcuts').onclick=()=>void perform(async()=>{await window.cue.resetShortcuts();notice('Available defaults restored. Occupied defaults retain their previous working shortcut.');});
el('export').onclick=()=>void perform(()=>window.cue.exportSession({transcript,context:value('context'),answers:[...cards.entries()].map(([key,entry])=>`${key}\n${entry.body.textContent}`).join('\n\n')}));
function automaticBlock():string {
 if(selections.some(s=>s.provider==='practice'))return 'Choose an online provider for automatic model answers. Offline practice produces templates only.';
 const missing=selections.find(s=>!current.providers.find(p=>p.id===s.provider)?.connected);if(missing)return 'Selected provider is not connected locally. Check Accounts; no practice fallback will be used.';
 if(!checked('share-text'))return 'Allow this session text before automatic online answers.';
 if(selections.some(s=>!['chatgpt','practice'].includes(s.provider))&&!checked('paid'))return 'Allow separately billed requests or select ChatGPT plan usage.';
 if(selections.some(s=>!current.providers.find(p=>p.id===s.provider)?.models.length))return 'Refresh the selected account model catalog. Existing login is preserved; check the provider status above.';
 if(current.requestCount>=Number(value('max-requests')))return 'Session request limit reached. Increase it deliberately or use a new session.';
 return '';
}
function automaticState():void {if(!current)return;const block=automaticBlock();const state=!checked('auto')?'Automatic answers are off.':current.audio!=='recording'?'Armed — audio is '+current.audio+'. Start listening with session consent; no recording starts automatically.':block?'Blocked — '+block:busy&&automaticRun?'Answering automatically — new speech cancels this answer.':latestVoiceActive?'Listening — waiting for speech to pause.':'Waiting for a stable question and '+current.experience.realtime.pauseMs+' ms of pause.';for(const id of ['auto-state','turn-state'])if(el(id).textContent!==state)el(id).textContent=state;const selected=selections.map(s=>current.providers.find(p=>p.id===s.provider)?.name??s.provider).join(', ');el('selected-provider-status').textContent=selections.some(s=>s.provider==='practice')?'Selected: '+selected+' — local template; no model request.':'Selected: '+selected+' — '+(selections.every(s=>current.providers.find(p=>p.id===s.provider)?.connected)?'signed in locally; model access is checked when requested.':'not connected locally.');}
el('auto').onchange=()=>{turnGate.reset();if(checked('auto')){turnGate.voice(latestVoiceActive,Date.now());if(latestVoiceActive&&latestVoiceTurn===lastSpeechTurn)turnGate.update(transcript.at(-1)?.text??'',Date.now());}if(!checked('auto')&&automaticRun&&busy)cancel();automaticState();if(checked('auto'))void perform(async()=>{for(const selected of selections){const provider=current.providers.find(p=>p.id===selected.provider);if(provider?.connected&&provider.id!=='practice'&&!provider.models.length)await window.cue.refreshModels(provider.id);}automaticState();});};
setInterval(()=>{if(!current)return;automaticState();const latest=transcript.at(-1);const automatic=checked('auto');const eligible=latest?.speaker==='Interviewer'||Boolean(latest&&latest.id===lastSpeechEntry);const offered=automatic?turnGate.offer(Date.now(),current.experience.realtime,current.audio==='recording'&&!automaticBlock(),eligible,busy):detector.offer(Date.now(),checked('suggest'),latest?.speaker==='Interviewer',busy);if(!offered)return;const suggestion=el<HTMLButtonElement>('suggestion');if(automatic){suggestion.hidden=true;void assist(true,offered);return;}suggestion.hidden=false;suggestion.textContent=`Answer suggested question: ${offered}`;suggestion.onclick=()=>{suggestion.hidden=true;void assist(false,offered);};},200);
window.cue.onVoice(event=>{latestVoiceActive=event.active;if(event.active)latestVoiceTurn=event.turn;const started=turnGate.voice(event.active,Date.now());if(started&&checked('auto')&&busy&&automaticRun)cancel();});
window.cue.onSpeech(event=>addEntry(event.text,event.speaker,event.turn));
window.cue.onEvent(answerEvent);window.cue.onStatus(updateStatus);window.cue.onAction(action=>{if(action==='settings'){el('overlay-settings').hidden=false;el('opacity').focus();}if(action==='assist')void assist();if(action==='cancel')cancel();if(action==='capture')void vision.open();if(action.startsWith('transcript:'))addEntry(action.slice(11),current.audioSource==='system'?'Interviewer':'You');if(action.startsWith('notice:'))notice(action.slice(7));});
window.addEventListener('beforeunload',()=>vision.remove());
void window.cue.status().then(updateStatus).catch(()=>notice('Desktop bridge unavailable. Start Cueglass through its Windows executable.'));

let resizeStart:{x:number;y:number;width:number;height:number}|undefined;
const resizeHandle=el('resize-overlay');resizeHandle.onpointerdown=event=>{resizeStart={x:event.screenX,y:event.screenY,width:window.innerWidth,height:window.innerHeight};resizeHandle.setPointerCapture(event.pointerId);event.preventDefault();};
resizeHandle.onpointermove=event=>{if(resizeStart)void perform(()=>window.cue.resize(resizeStart!.width+event.screenX-resizeStart!.x,resizeStart!.height+event.screenY-resizeStart!.y));};
resizeHandle.onpointerup=event=>{resizeStart=undefined;resizeHandle.releasePointerCapture(event.pointerId);};resizeHandle.onlostpointercapture=()=>{resizeStart=undefined;};
resizeHandle.onkeydown=event=>{const step=event.shiftKey?8:24;if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();void perform(()=>window.cue.resize(window.innerWidth+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),window.innerHeight+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)));}};

el('theme').onchange=()=>void perform(()=>window.cue.overlay({theme:value('theme') as keyof typeof themes}));
for(const key of ['background','text','muted','accent'] as const)el('color-'+key).oninput=()=>void perform(()=>window.cue.overlay({colors:{...current.overlay.colors,[key]:value('color-'+key)}}));
el('reset-colors').onclick=()=>void perform(()=>window.cue.overlay({theme:'light'}));
for(const id of ['speech-language','answer-language']){const select=el<HTMLSelectElement>(id);select.add(new Option(id==='speech-language'?'Auto — detect per turn':'Auto — question language','auto'));for(const [code,name] of Object.entries(speechLanguages))select.add(new Option(name,code));}
el('speech-language').onchange=()=>void perform(()=>window.cue.experience({languages:{speechLanguage:value('speech-language') as SpeechLanguage}}));
el('answer-language').onchange=()=>void perform(()=>window.cue.experience({languages:{answerLanguage:value('answer-language') as SpeechLanguage}}));
el('mixed-speech').onchange=()=>void perform(()=>window.cue.experience({languages:{mixedSpeech:checked('mixed-speech')}}));
el('turn-pause').onchange=()=>void perform(()=>window.cue.experience({realtime:{pauseMs:Number(value('turn-pause'))}}));
el('turn-cooldown').onchange=()=>void perform(()=>window.cue.experience({realtime:{cooldownMs:Number(value('turn-cooldown'))}}));
async function renderSpeechPresets():Promise<void>{const installed=await window.cue.speechModels();const host=el('speech-presets');host.replaceChildren();for(const preset of speechPresets){const model=installed.find(m=>m.id===preset.id)!;const row=textElement('section','','speech-preset');row.append(textElement('strong',preset.name+(model.selected?' · selected':'')),textElement('p',preset.description,'muted'));const control=button(model.installed?'Use '+preset.name:`Download ${preset.name} (${(model.bytes/1048576).toFixed(1)} MiB)`,()=>void perform(async()=>{if(!model.installed)await window.cue.downloadModel(model.id);await window.cue.selectSpeechModel(model.id);await renderSpeechPresets();notice(preset.name+' speech selected. Resume audio manually.');}));control.disabled=model.selected;row.append(control);host.append(row);}}
void renderSpeechPresets().catch(()=>notice('Speech presets unavailable. Check the complete bundled folder.'));
