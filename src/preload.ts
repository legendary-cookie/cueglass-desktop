import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge } from './shared';
function listen(channel:string,callback:(value:any)=>void):()=>void {const listener=(_event:unknown,value:unknown)=>callback(value);ipcRenderer.on(channel,listener);return ()=>ipcRenderer.removeListener(channel,listener);}
const bridge:Bridge={
 experience:patch=>ipcRenderer.invoke('experience',patch),saveSelection:(selection,primary)=>ipcRenderer.invoke('save-selection',selection,primary),onVoice:cb=>listen('audio-voice',cb),onSpeech:cb=>listen('speech-text',cb),
 shortcut:(action,key)=>ipcRenderer.invoke('shortcut',action,key),resetShortcuts:()=>ipcRenderer.invoke('reset-shortcuts'),
 status:()=>ipcRenderer.invoke('status'),signIn:id=>ipcRenderer.invoke('sign-in',id),cancelSignIn:()=>ipcRenderer.invoke('cancel-sign-in'),switchAccount:id=>ipcRenderer.invoke('switch-account',id),signOut:()=>ipcRenderer.invoke('sign-out'),
 saveKey:(id,key)=>ipcRenderer.invoke('save-key',id,key),deleteKey:id=>ipcRenderer.invoke('delete-key',id),addModel:(id,model)=>ipcRenderer.invoke('add-model',id,model),refreshModels:provider=>ipcRenderer.invoke('refresh-models',provider),
 assist:r=>ipcRenderer.invoke('assist',r),cancel:()=>ipcRenderer.invoke('cancel'),protect:on=>ipcRenderer.invoke('protect',on),pin:on=>ipcRenderer.invoke('pin',on),hide:()=>ipcRenderer.invoke('hide'),overlay:patch=>ipcRenderer.invoke('overlay',patch),clickThrough:on=>ipcRenderer.invoke('click-through',on),recover:()=>ipcRenderer.invoke('recover'),resize:(width,height)=>ipcRenderer.invoke('resize-overlay',width,height),minimize:()=>ipcRenderer.invoke('minimize'),close:()=>ipcRenderer.invoke('close'),
 audioSources:()=>ipcRenderer.invoke('audio-sources'),audioSelection:()=>ipcRenderer.invoke('audio-selection'),selectAudio:source=>ipcRenderer.invoke('select-audio',source),
 speechModels:()=>ipcRenderer.invoke('speech-models'),downloadModel:id=>ipcRenderer.invoke('download-model',id),cancelModelDownload:()=>ipcRenderer.invoke('cancel-model-download'),selectSpeechModel:id=>ipcRenderer.invoke('select-speech-model',id),captureSources:()=>ipcRenderer.invoke('capture-sources'),captureImage:id=>ipcRenderer.invoke('capture-image',id),
 audio:(state,source,consent)=>ipcRenderer.invoke('audio',state,source,consent),transcribe:wav=>ipcRenderer.invoke('transcribe',wav),pickWhisper:()=>ipcRenderer.invoke('pick-whisper'),settings:()=>ipcRenderer.invoke('settings'),importSession:()=>ipcRenderer.invoke('import-session'),exportSession:data=>ipcRenderer.invoke('export-session',data),manageUsage:()=>ipcRenderer.invoke('manage-usage'),
 onDownload:cb=>listen('model-download',cb),onMeter:cb=>listen('audio-meter',cb),
 onEvent:cb=>listen('answer',cb),onAction:cb=>listen('action',cb),onStatus:cb=>listen('status',cb)
};contextBridge.exposeInMainWorld('cue',bridge);
