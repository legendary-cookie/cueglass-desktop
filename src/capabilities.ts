import type {Model,ProviderId,Selection} from './shared';
export type GenerationMode='default'|'fast'|'reasoning';
export type Capabilities={vision:boolean;modes:GenerationMode[];source:string};
const base:Capabilities={vision:false,modes:['default'],source:'Capability unknown; text and provider defaults only.'};
// Conservative, versioned fallback. Discovery metadata takes priority. Unknown model IDs
// never inherit vision or speed controls merely because their name looks similar.
export function capabilities(provider:ProviderId,id:string,metadata?:any):Capabilities {
 let c={...base,modes:[...base.modes]};
 if(provider==='chatgpt'&&/^(gpt-6\.1-sol|gpt-6-sol|gpt-6-luna|gpt-5\.6-sol)(?:-\d{4}-\d{2}-\d{2})?$/.test(id))c={vision:true,modes:['default','fast','reasoning'],source:'OpenAI model / reasoning documentation'};
 if(provider==='claude'&&/^claude-(?:haiku-4-5|sonnet-4-5|sonnet-4-6|opus-4-5|opus-4-6|opus-5|opus-5-5|fable-5-1)(?:-\d{8})?$/.test(id))c={vision:true,modes:['default'],source:'Claude models and vision documentation'};
 if(provider==='gemini'&&/^(gemini-2\.5-(?:flash|flash-lite|pro)|gemini-3-flash-preview|gemini-3\.1-(?:pro-preview|flash-lite-preview)|gemini-3\.8-flash)$/.test(id))c={vision:true,modes:['default','fast','reasoning'],source:'Gemini OpenAI compatibility documentation'};
 if(provider==='kimi'&&['kimi-k3','kimi-k2.6','kimi-k2.7-code','kimi-k2.7-code-highspeed'].includes(id))c={vision:true,modes:['default'],source:'Kimi API overview; choose highspeed model explicitly when desired'};
 if(provider==='kimi'&&['kimi-k3','kimi-k2.6'].includes(id))c.modes=['default','fast','reasoning'];
 if(provider==='glm'&&['glm-4.6v','glm-4.6v-flash'].includes(id))c={vision:true,modes:['default'],source:'GLM-4.6V API documentation'};
 if(provider==='deepseek'&&['deepseek-flash'].includes(id))c={vision:false,modes:['default','fast','reasoning'],source:'DeepSeek thinking-mode documentation; vision not verified in this catalog'};
 if(provider==='chatgpt'&&Array.isArray(metadata?.input_modalities))c.vision=metadata.input_modalities.includes('image');
 if(provider==='claude'&&metadata?.capabilities){const m=metadata.capabilities;c.vision=m.image_input?.supported===true;if(m.thinking?.types?.adaptive?.supported&&m.effort?.low?.supported&&m.effort?.high?.supported)c.modes=['default','fast','reasoning'];c.source='Provider model discovery metadata';}
 return c;
}
export const fallbackCatalog:Partial<Record<ProviderId,string[]>>={claude:['claude-haiku-4-5'],gemini:['gemini-2.5-flash','gemini-2.5-flash-lite'],kimi:['kimi-k3','kimi-k2.6','kimi-k2.7-code-highspeed'],glm:['glm-4.6v','glm-4.6v-flash'],deepseek:['deepseek-flash']};
export function autoModel(models:Model[],vision=false):Model|undefined {
 const available=models.filter(m=>!vision||m.capabilities?.vision);return [...available].sort((a,b)=>score(a)-score(b))[0];
}
function score(m:Model):number {return /(?:^|[-.])(?:luna|mini|flash-lite|haiku|small)(?:[-.]|$)/.test(m.id)?0:/(?:^|[-.])flash(?:[-.]|$)/.test(m.id)?1:/highspeed/.test(m.id)?2:3;}
export function resolveSelection(selection:Selection,models:Model[],vision=false):Selection {
 const model=selection.model==='auto'?autoModel(models,vision):models.find(m=>m.id===selection.model);
 if(!model)throw new Error(vision?'No verified image-capable model is available in this provider.':'Refresh this provider model list or select an available model.');
 const mode=selection.mode??'default';if(!['default','fast','reasoning'].includes(mode)||!model.capabilities?.modes.includes(mode)&&mode!=='default')throw new Error('This model does not support that generation mode. Choose Provider default.');
 if(vision&&!model.capabilities?.vision)throw new Error('Selected model has no verified image-input capability. Remove the image or choose a vision model.');
 return {...selection,model:model.id,mode};
}
