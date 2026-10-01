import type {Capabilities,GenerationMode} from './capabilities';
import type {PreviewImage} from './vision';
import type {SpeechModelState,DownloadProgress} from './model-manager';
import type { ShortcutAction } from './shortcuts';
import type { OverlayPreferences } from './overlay';
import type {LanguagePreferences,SpeechLanguage} from './languages';
import type {RealtimeSettings} from './realtime';
export type ExperiencePatch={languages?:Partial<LanguagePreferences>;realtime?:Partial<RealtimeSettings>};
export type ExperiencePreferences={languages:LanguagePreferences;realtime:RealtimeSettings;preferredProvider?:ProviderId;preferredModels:Partial<Record<ProviderId,Selection>>};
export type ProviderId = 'chatgpt' | 'claude' | 'deepseek' | 'glm' | 'kimi' | 'gemini' | 'practice';
export type Model = { id: string; name: string;capabilities?:Capabilities };
export type ProviderInfo = { id: ProviderId; name: string; connected: boolean; models: Model[]; note: string };
export type Selection = { provider: ProviderId; model: string;mode?:GenerationMode };
export type Transcript = { id: string; speaker: 'Interviewer' | 'You'; text: string; at: number };
export type AssistRequest = { answerLanguage?:SpeechLanguage; image?:PreviewImage;shareImage?:boolean; question: string; transcript: Transcript[]; context: string; selections: Selection[]; compare: boolean; shareText:boolean; allowPaid: boolean; maxRequests: number; maxContext: number; maxOutput: number };
export type AnswerEvent = { run: string; key: string; kind: 'start' | 'delta' | 'done' | 'error'; text?: string; inputTokens?: number; outputTokens?: number; firstTokenMs?: number };
export type Status = { version:string;trayOnly:boolean; experience:ExperiencePreferences; providers: ProviderInfo[]; accounts: {id:string;label:string;active:boolean;connected:boolean}[]; capture: boolean; captureNote: string; hotkeys: Record<string,boolean>; hotkeyBindings:Record<string,string>; audio: 'stopped' | 'recording' | 'paused'; audioSource: 'microphone' | 'system'; whisper: boolean; requestCount: number; usage: {input:number;output:number}; authPending:boolean; overlay:OverlayPreferences & {clickThrough:boolean;recovery:string;recoveryAvailable:boolean} };
export type VoiceEvent={active:boolean;turn:string};
export type SpeechEvent={text:string;speaker:'You'|'Interviewer';turn:string};
export type AudioSelection={kind:'microphone'|'system'|'output'|'app';id:string};
export type AudioSource=AudioSelection & {name:string;supported:boolean};
export type CaptureSource={id:string;name:string;kind:'window'|'screen'};
export type Settings = { whisperExe: string; whisperModel: string };
export interface Bridge {
 experience(patch:ExperiencePatch):Promise<void>;saveSelection(selection:Selection,primary?:boolean):Promise<void>;
 shortcut(action:ShortcutAction,key:string):Promise<void>;resetShortcuts():Promise<void>;
 status(): Promise<Status>; signIn(account?:string): Promise<string>; cancelSignIn(): Promise<void>; switchAccount(id:string):Promise<void>; signOut(): Promise<string>;
 saveKey(provider:ProviderId,key:string):Promise<void>; deleteKey(provider:ProviderId):Promise<void>; addModel(provider:ProviderId,model:string):Promise<void>; refreshModels(provider?:ProviderId):Promise<void>;
 assist(request:AssistRequest):Promise<string>; cancel():Promise<void>; protect(on:boolean):Promise<void>; pin(on:boolean):Promise<void>; hide():Promise<void>; overlay(patch:Partial<OverlayPreferences>):Promise<void>; clickThrough(on:boolean):Promise<void>; recover():Promise<void>; resize(width:number,height:number):Promise<void>; minimize():Promise<void>; close():Promise<void>;
 audioSources():Promise<AudioSource[]>;selectAudio(source:AudioSelection):Promise<void>;audioSelection():Promise<AudioSelection>;
 captureSources():Promise<CaptureSource[]>;captureImage(id:string):Promise<PreviewImage>;
 speechModels():Promise<SpeechModelState[]>;downloadModel(id:string):Promise<void>;cancelModelDownload():Promise<void>;selectSpeechModel(id:string):Promise<void>;
 audio(state:'recording'|'paused'|'stopped',source:'microphone'|'system',consent:boolean):Promise<void>; transcribe(wav:ArrayBuffer):Promise<string>; pickWhisper():Promise<Settings>; settings():Promise<Settings>;
 importSession():Promise<{transcript:Transcript[];context:string;answers:string}|undefined>; exportSession(session:{transcript:Transcript[];context:string;answers:string}):Promise<void>; manageUsage():Promise<void>;
 onVoice(callback:(event:VoiceEvent)=>void):()=>void;onSpeech(callback:(event:SpeechEvent)=>void):()=>void;
 onDownload(callback:(progress:DownloadProgress)=>void):()=>void;onMeter(callback:(peak:number)=>void):()=>void;
 onEvent(callback:(event:AnswerEvent)=>void):()=>void; onAction(callback:(action:string)=>void):()=>void; onStatus(callback:(status:Status)=>void):()=>void;
}
declare global { interface Window { cue: Bridge } }
