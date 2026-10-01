import type {ProviderId,Selection,ProviderInfo,ExperiencePreferences} from './shared';
export const themes={
 light:{background:'#ffffff',text:'#20324d',muted:'#52647d',accent:'#2852a0'},
 dark:{background:'#17202f',text:'#f3f6fc',muted:'#bdcce3',accent:'#a9c7ff'},
 contrast:{background:'#000000',text:'#ffffff',muted:'#ffffff',accent:'#ffff00'}
};
export type Colors=typeof themes.light;
export type ThemeName=keyof typeof themes|'custom';
export function color(value:unknown,fallback:string):string{return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;}
export function themeColors(value:unknown,base:Colors=themes.light):Colors {const v=value&&typeof value==='object'?value as Partial<Colors>:{};return {background:color(v.background,base.background),text:color(v.text,base.text),muted:color(v.muted,base.muted),accent:color(v.accent,base.accent)};}
export function contrast(a:string,b:string):number {const lum=(s:string)=>{const c=[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
// Native Windows option popups must use an opaque background, independently of
// overlay translucency. Keep custom text when readable; otherwise recover locally.
export function selectPalette(colors:Colors):{background:string;text:string;scheme:'light'|'dark'} {
 const background=colors.background;const black=contrast('#000000',background),white=contrast('#ffffff',background);
 return {background,text:contrast(colors.text,background)>=4.5?colors.text:black>=white?'#000000':'#ffffff',scheme:black>=white?'light':'dark'};
}
export const speechPresets=[{id:'tiny-q5_1',name:'Fast',description:'Bundled multilingual tiny; lower CPU/RAM, less reliable on difficult speech.'},{id:'base-q5_1',name:'Balanced',description:'Bundled multilingual base; current default.'},{id:'small-q5_1',name:'Higher accuracy',description:'Bundled multilingual small; more CPU/RAM and latency. Accuracy is not guaranteed.'}];
const providers:ProviderId[]=['chatgpt','claude','deepseek','glm','kimi','gemini','practice'];
export function savedSelections(value:unknown):Partial<Record<ProviderId,Selection>> {const result:Partial<Record<ProviderId,Selection>>={};if(!value||typeof value!=='object')return result;for(const provider of providers){const v=(value as Record<string,Selection>)[provider];if(v&&typeof v.model==='string'&&/^[a-zA-Z0-9._:/-]{1,160}$/.test(v.model))result[provider]={provider,model:v.model,mode:['default','fast','reasoning'].includes(v.mode??'default')?v.mode:'default'};}return result;}

export function providerPreference(value:unknown):ProviderId|undefined {return typeof value==='string'&&providers.includes(value as ProviderId)?value as ProviderId:undefined;}
export function initialSelection(preferences:ExperiencePreferences,available:ProviderInfo[]):Selection {
 const preferred=providerPreference(preferences.preferredProvider);const provider=preferred&&available.some(p=>p.id===preferred)?preferred:available.find(p=>p.id==='chatgpt'&&p.connected)?.id??available.find(p=>p.id!=='practice'&&p.connected)?.id??'practice';
 return preferences.preferredModels[provider]?{...preferences.preferredModels[provider]!}:{provider,model:provider==='practice'?'offline-coach':'auto',mode:'default'};
}
