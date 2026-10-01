export type Bounds = {x:number;y:number;width:number;height:number};
import {themes,themeColors} from './experience';
import type {Colors,ThemeName} from './experience';
export type OverlayPreferences = {topmost:boolean;positionLocked:boolean;theme:ThemeName;colors:Colors;opacity:number;transparent:boolean;textSize:number;compact:boolean;bounds?:Bounds};
export const overlayDefaults:OverlayPreferences={topmost:true,positionLocked:false,theme:'light',colors:{...themes.light},opacity:0.88,transparent:true,textSize:15,compact:false};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function overlayPreferences(value:unknown,base:OverlayPreferences=overlayDefaults):OverlayPreferences {
 if(!value||typeof value!=='object'||Array.isArray(value))return {...base};
 const v=value as Record<string,unknown>;const result={...base};
 if(typeof v.topmost==='boolean')result.topmost=v.topmost;
 if(typeof v.positionLocked==='boolean')result.positionLocked=v.positionLocked;
 if(typeof v.theme==='string'&&(v.theme==='custom'||Object.hasOwn(themes,v.theme))){result.theme=v.theme as ThemeName;if(v.theme!=='custom')result.colors={...themes[v.theme as keyof typeof themes]};}
 if(v.colors&&typeof v.colors==='object'){const colors=themeColors(v.colors,result.colors);const changed=(Object.keys(colors) as (keyof Colors)[]).some(key=>colors[key]!==result.colors[key]);result.colors=colors;if(changed||v.theme==='custom'||v.theme===undefined)result.theme='custom';}
 if(typeof v.transparent==='boolean')result.transparent=v.transparent;
 if(typeof v.compact==='boolean')result.compact=v.compact;
 if(finite(v.opacity))result.opacity=clamp(v.opacity,0.1,1);
 if(finite(v.textSize))result.textSize=Math.round(clamp(v.textSize,12,22));
 if(v.bounds&&typeof v.bounds==='object'){
  const b=v.bounds as Bounds;
  if([b.x,b.y,b.width,b.height].every(finite))result.bounds={x:Math.round(b.x),y:Math.round(b.y),width:Math.round(clamp(b.width,440,2400)),height:Math.round(clamp(b.height,320,1800))};
 }
 return result;
}
export function fitBounds(bounds:Bounds|undefined,areas:Bounds[],compact=false):Bounds {
 if(!areas.length)throw new Error('No desktop work area available.');
 const b=bounds??{x:areas[0].x+80,y:areas[0].y+60,width:compact?520:960,height:compact?480:760};
 const overlap=(a:Bounds)=>Math.max(0,Math.min(b.x+b.width,a.x+a.width)-Math.max(b.x,a.x))*Math.max(0,Math.min(b.y+b.height,a.y+a.height)-Math.max(b.y,a.y));
 const area=areas.reduce((best,a)=>overlap(a)>overlap(best)?a:best,areas[0]);
 const width=Math.min(b.width,area.width),height=Math.min(b.height,area.height);
 return {x:clamp(b.x,area.x,area.x+area.width-width),y:clamp(b.y,area.y,area.y+area.height-height),width,height};
}
export function requireRecovery(registered:boolean):void {if(!registered)throw new Error('Click-through requires a registered recovery shortcut. Resolve the shortcut conflict first.');}
