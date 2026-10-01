import {describe,it,expect,vi} from 'vitest';
import {trayCommands,toggleTray,closeToTray} from '../src/tray-controls';
describe('tray actions',()=>{
 it('keeps distinct recovery, hide, settings and quit commands',()=>{const actions={visible:()=>true,show:vi.fn(),hide:vi.fn(),settings:vi.fn(),pause:vi.fn(),quit:vi.fn()};const commands=trayCommands(actions);expect(commands.filter(c=>c.label).map(c=>c.label)).toEqual(['Show / restore interaction','Hide overlay','Settings','Pause audio','Quit Cueglass']);commands.find(c=>c.label==='Settings')!.click!();expect(actions.settings).toHaveBeenCalledOnce();commands.find(c=>c.label==='Quit Cueglass')!.click!();expect(actions.quit).toHaveBeenCalledOnce();});
 it('toggles repeatedly without confusing quit with hide',()=>{let visible=true;const actions={visible:()=>visible,show:vi.fn(()=>{visible=true;}),hide:vi.fn(()=>{visible=false;}),settings:vi.fn(),pause:vi.fn(),quit:vi.fn()};toggleTray(actions);expect(visible).toBe(false);toggleTray(actions);expect(visible).toBe(true);toggleTray(actions);expect(actions.hide).toHaveBeenCalledTimes(2);expect(actions.quit).not.toHaveBeenCalled();});
 it('closes to tray unless actually quitting or tray is unavailable',()=>{expect(closeToTray(false,true)).toBe(true);expect(closeToTray(true,true)).toBe(false);expect(closeToTray(false,false)).toBe(false);});
});
