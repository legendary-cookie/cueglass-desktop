import {describe,it,expect} from 'vitest';
import {overlayPreferences,overlayDefaults,fitBounds,requireRecovery} from '../src/overlay';
describe('overlay preferences',()=>{
 it('starts pinned with readable translucent background',()=>{expect(overlayDefaults.topmost).toBe(true);expect(overlayDefaults.opacity).toBeGreaterThanOrEqual(.55);expect(overlayDefaults.opacity).toBeLessThan(1);});
 it('clamps finite ranges and ignores invalid types',()=>{expect(overlayPreferences({opacity:0,textSize:99,topmost:'false'})).toMatchObject({opacity:.1,textSize:22,topmost:true});expect(overlayPreferences({opacity:Infinity,textSize:NaN})).toEqual(overlayDefaults);expect(overlayPreferences(null)).toEqual(overlayDefaults);});
 it('preserves independent settings on partial updates',()=>{const a=overlayPreferences({compact:true,textSize:20,topmost:false});expect(overlayPreferences({opacity:.75},a)).toMatchObject({compact:true,textSize:20,topmost:false,opacity:.75});});
 it('toggles transparency without losing its saved amount and keeps readable bounds',()=>{const chosen=overlayPreferences({opacity:.7});const off=overlayPreferences({transparent:false},chosen);expect(off).toMatchObject({transparent:false,opacity:.7});expect(overlayPreferences({transparent:true},off)).toMatchObject({transparent:true,opacity:.7});expect(overlayPreferences({opacity:0,transparent:true}).opacity).toBe(.1);});
 it('rejects invalid geometry and never persists click-through',()=>{expect(overlayPreferences({bounds:{x:NaN,y:0,width:900,height:700},clickThrough:true})).toEqual(overlayDefaults);expect(overlayPreferences({bounds:{x:1.2,y:2.7,width:90000,height:0}}).bounds).toEqual({x:1,y:3,width:2400,height:320});});
});
describe('monitor bounds and recovery',()=>{
 const monitors=[{x:0,y:0,width:1920,height:1040},{x:-1280,y:-200,width:1280,height:984}];
 it('keeps valid geometry on a monitor with negative coordinates',()=>{expect(fitBounds({x:-1200,y:-150,width:800,height:600},monitors)).toEqual({x:-1200,y:-150,width:800,height:600});});
 it('restores offscreen geometry to primary work area',()=>{expect(fitBounds({x:9000,y:9000,width:960,height:760},monitors)).toEqual({x:960,y:280,width:960,height:760});});
 it('fits oversized windows to the available desktop',()=>{expect(fitBounds({x:0,y:0,width:2400,height:1800},[{x:0,y:0,width:800,height:600}])).toEqual({x:0,y:0,width:800,height:600});});
 it('blocks click-through without reliable recovery',()=>{expect(()=>requireRecovery(false)).toThrow('registered recovery');expect(()=>requireRecovery(true)).not.toThrow();});
});
