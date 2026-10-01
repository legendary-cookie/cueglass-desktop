export const shortcutDefaults={assist:'Control+Shift+Space',visibility:'Control+Shift+H',pause:'Control+Shift+P',cancel:'Control+Shift+X',capture:'Control+Shift+S'};
export type ShortcutAction=keyof typeof shortcutDefaults;
export type Shortcuts=Record<ShortcutAction,string>;
export const recoveryCandidates=['Control+Shift+O','Control+Alt+O','Control+Shift+F10'];
export function accelerator(input:unknown):string {
 if(typeof input!=='string'||input.length>100)throw new Error('Record a shortcut with Ctrl, Alt or Shift and a key.');
 const parts=input.replace(/CommandOrControl|Ctrl/g,'Control').split('+');const key=parts.pop()??'';
 if(!parts.length||parts.some(p=>!['Control','Alt','Shift'].includes(p))||new Set(parts).size!==parts.length||!(/^[A-Z0-9]$|^F(?:[1-9]|1[0-9]|2[0-4])$|^(?:Space|Home|End|PageUp|PageDown|Insert|Delete|Up|Down|Left|Right)$/.test(key)))throw new Error('Use Ctrl, Alt or Shift with a letter, number, function key or navigation key.');
 if(parts.length===1&&parts[0]==='Shift'&&!/^F\d+$/.test(key))throw new Error('Use Ctrl or Alt to avoid intercepting normal typing.');
 const result=[...['Control','Alt','Shift'].filter(p=>parts.includes(p)),key].join('+');
 if(['Control+Alt+Delete','Alt+F4','Alt+Tab'].includes(result)||recoveryCandidates.includes(result))throw new Error('That shortcut is reserved by Windows or Cueglass recovery.');
 return result;
}
export function shortcutPreferences(value:unknown):Shortcuts {
 const result={...shortcutDefaults};if(!value||typeof value!=='object')return result;
 for(const name of Object.keys(result) as ShortcutAction[])try{result[name]=accelerator((value as Record<string,unknown>)[name]);}catch{ /* keep safe default */ }
 if(new Set(Object.values(result)).size!==Object.keys(result).length)return {...shortcutDefaults};return result;
}
export interface ShortcutRegistry {register(key:string,callback:()=>void):boolean;unregister(key:string):void}
export function rebind(registry:ShortcutRegistry,bindings:Shortcuts,action:ShortcutAction,input:unknown,callback:()=>void):Shortcuts {
 if(!(action in shortcutDefaults))throw new Error('Unknown shortcut action.');const next=accelerator(input);
 if(Object.entries(bindings).some(([name,key])=>name!==action&&key===next))throw new Error('Another Cueglass action already uses that shortcut.');
 if(next===bindings[action])return bindings;
 if(!registry.register(next,callback))throw new Error('That shortcut is already used by another app. Your previous shortcut is unchanged.');
 registry.unregister(bindings[action]);return {...bindings,[action]:next};
}
export function recordedKey(event:Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'altKey'|'shiftKey'|'metaKey'>):string|undefined {
 if(event.metaKey)throw new Error('Use Ctrl, Alt or Shift; Windows shortcuts are reserved.');
 if(['Control','Alt','Shift','Meta'].includes(event.key))return;
 const key=event.code==='Space'?'Space':/^Key[A-Z]$/.test(event.code)?event.code.slice(3):/^Digit[0-9]$/.test(event.code)?event.code.slice(5):event.key.replace(/^Arrow/,'');
 return accelerator([...event.ctrlKey?['Control']:[],...event.altKey?['Alt']:[],...event.shiftKey?['Shift']:[],key].join('+'));
}
