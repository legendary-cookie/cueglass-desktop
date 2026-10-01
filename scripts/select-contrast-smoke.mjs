import {_electron as electron} from 'playwright';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const version='0.5.3';const profile='select-contrast-v0-5-3';
const findings={version,realRecording:false,realProviderRequests:false,uiErrors:[],computedStates:[],nativePopups:[]};
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
await mkdir(join('test-user-data',profile),{recursive:true});await mkdir('evidence',{recursive:true});
await writeFile(join('test-user-data',profile,'ui-preferences.json'),JSON.stringify({compact:false,topmost:true,transparent:false,bounds:{x:120,y:100,width:980,height:760},theme:'light'}));
const app=await electron.launch({executablePath:resolve(`release/${version}/win-unpacked/Cueglass.exe`),args:['--smoke',`--smoke-profile=${profile}`],cwd:process.cwd(),timeout:30000});
try{
 const mainPid=await app.evaluate(()=>globalThis.process.pid);const page=await app.firstWindow();page.on('pageerror',e=>findings.uiErrors.push(e.message));await page.waitForSelector('#answers');
 const native=await app.evaluate(({app,BrowserWindow})=>({pids:app.getAppMetrics().map(p=>p.pid).join(','),mainHandle:BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString()}));
 await app.evaluate(({BrowserWindow})=>{globalThis.fetch=async()=>{throw new Error('Network blocked by visual acceptance fixture.');};const window=BrowserWindow.getAllWindows()[0];window.setContentProtection(false);window.setAlwaysOnTop(true);window.show();window.moveTop();window.focus();});
 assert((await page.evaluate(()=>window.cue.status())).audio==='stopped','Capture unexpectedly active.');
 const variants=[{theme:'light'},{theme:'dark'},{theme:'contrast'},{colors:{background:'#ffffff',text:'#ffffff'}},{colors:{background:'#17202f',text:'#17202f'}},{colors:{background:'#808080',text:'#808080'}}];
 for(const [index,variant] of variants.entries()){
  for(const opacity of [1,.55,.1]){
   await page.evaluate(v=>window.cue.overlay({...v.variant,transparent:v.opacity!==1,opacity:v.opacity}),{variant,opacity});
   await page.waitForFunction(v=>window.cue.status().then(s=>Math.abs(s.overlay.opacity-v)<.001),opacity);
   // Exercise a real disabled language select, not just an injected class.
   await page.evaluate(()=>window.cue.experience({languages:{mixedSpeech:true}}));
   const styles=await page.evaluate(()=>[...window.document.querySelectorAll('select')].map(node=>{
    const style=window.getComputedStyle(node);return {label:node.getAttribute('aria-label')||node.id,color:style.color,background:style.backgroundColor,opacity:style.opacity,scheme:style.colorScheme,disabled:node.disabled,options:[...node.options].map(option=>{const s=window.getComputedStyle(option);return {color:s.color,background:s.backgroundColor};})};
   }));
   for(const state of styles){check(state,`${index}/${opacity}/${state.label}`);for(const option of state.options)check(option,`${state.label} popup option`);}
   assert(styles.some(s=>s.label==='speech-language'&&s.disabled),'Disabled speech-language not exercised.');
   findings.computedStates.push({variant:index,opacity,selectCount:styles.length,disabledLanguage:true});
  }
  {
   const label=variant.theme??`custom-${index}`;await page.getByRole('button',{name:'Session',exact:true}).click();
   const select=page.getByRole('combobox',{name:'Provider for answer 1',exact:true});await select.hover();
   const hovered=await select.evaluate(n=>({border:window.getComputedStyle(n).borderTopColor,text:window.getComputedStyle(n).color}));assert(hovered.border===hovered.text,'Hover indicator is not the readable control color.');
   await select.focus();const focused=await select.evaluate(n=>({outline:window.getComputedStyle(n).outlineStyle,color:window.getComputedStyle(n).outlineColor,text:window.getComputedStyle(n).color}));assert(focused.outline==='solid'&&focused.color===focused.text,'Keyboard focus indicator missing.');
   await page.screenshot({path:resolve(`evidence/selects-${label}-${version}.png`)});
   await select.click();await page.waitForTimeout(150);
   const output=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/capture-select-popup.ps1'),'-AppProcessId',String(mainPid),'-AdditionalProcessIds',native.pids,'-MainWindowHandle',native.mainHandle,'-OutputPath',resolve(`evidence/select-popup-${label}-${version}.png`)],{encoding:'utf8',windowsHide:true,timeout:15000});findings.nativePopups.push({theme:label,overlayTransparency:90,...JSON.parse(output.trim())});
   await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.document.querySelector('.provider-select').value==='claude');
   await page.getByRole('combobox',{name:'Model for answer 1',exact:true}).selectOption('auto');
  }
 }
 await page.evaluate(()=>window.cue.overlay({theme:'dark',transparent:false}));
 const model=page.getByRole('combobox',{name:'Model for answer 1',exact:true});await model.click();await page.waitForTimeout(150);
 const modelOutput=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/capture-select-popup.ps1'),'-AppProcessId',String(mainPid),'-AdditionalProcessIds',native.pids,'-MainWindowHandle',native.mainHandle,'-OutputPath',resolve(`evidence/select-popup-model-${version}.png`)],{encoding:'utf8',windowsHide:true,timeout:15000});findings.nativePopups.push({control:'model',...JSON.parse(modelOutput.trim())});await page.keyboard.press('End');await page.keyboard.press('Enter');assert(await model.inputValue()==='claude-haiku-4-5','Native model selection did not retain keyboard choice.');
 await page.getByRole('button',{name:'Controls',exact:true}).click();await page.evaluate(()=>window.cue.experience({languages:{mixedSpeech:false}}));await page.screenshot({path:resolve(`evidence/selects-settings-dark-${version}.png`)});
 // Inspect audio and language popups as native menus too.
 for(const id of ['audio-source','speech-language','answer-language']){
  const select=page.locator('#'+id);await select.scrollIntoViewIfNeeded();await select.click();await page.waitForTimeout(150);
  const output=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/capture-select-popup.ps1'),'-AppProcessId',String(mainPid),'-AdditionalProcessIds',native.pids,'-MainWindowHandle',native.mainHandle,'-OutputPath',resolve(`evidence/select-popup-${id}-${version}.png`)],{encoding:'utf8',windowsHide:true,timeout:15000});findings.nativePopups.push({control:id,...JSON.parse(output.trim())});await page.keyboard.press('Escape');
 }
 assert(!findings.uiErrors.length,'Renderer errors.');assert((await page.evaluate(()=>window.cue.status())).audio==='stopped','Test started audio.');findings.keyboardAndMouse=true;findings.passed=true;
}catch(error){findings.error=String(error);throw error;}finally{await writeFile(`evidence/select-contrast-smoke-${version}.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));await app.close();}
function check(state,label){
 const parse=value=>{const n=value.match(/[\d.]+/g)?.map(Number)??[];assert(n.length>=3,`${label}: unexpected computed color ${value}`);assert(n.length===3||n[3]===1,`${label}: transparent native control`);return n.slice(0,3).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});};
 const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;const a=luminance(parse(state.color)),b=luminance(parse(state.background));assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${label}: insufficient text contrast (${state.color} on ${state.background})`);if(state.opacity)assert(state.opacity==='1',`${label}: disabled opacity hides text`);
}
