import {describe,it,expect} from 'vitest';
import {themes,selectPalette,contrast,themeColors} from '../src/experience';

describe('native select colors',()=>{
 it('preserves readable preset foreground and opaque background in every theme',()=>{
  for(const colors of Object.values(themes)){
   const palette=selectPalette(colors);expect(palette.text).toBe(colors.text);expect(palette.background).toBe(colors.background);expect(contrast(palette.text,palette.background)).toBeGreaterThanOrEqual(4.5);
  }
  expect(selectPalette(themes.dark).scheme).toBe('dark');expect(selectPalette(themes.light).scheme).toBe('light');
 });
 it('recovers unreadable custom combinations without rewriting user preferences',()=>{
  for(const background of ['#ffffff','#000000','#808080','#2852a0','#ffeeaa','#17202f']){
   for(const text of [background,'#ffffff','#000000','#808080']){
    const colors=themeColors({background,text});const original={...colors};const palette=selectPalette(colors);
    expect(contrast(palette.text,palette.background)).toBeGreaterThanOrEqual(4.5);expect(colors).toEqual(original);
    if(contrast(text,background)>=4.5)expect(palette.text).toBe(text);
   }
  }
 });
});
