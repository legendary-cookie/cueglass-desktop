import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute=promisify(execFile);
const evidence=resolve('evidence');await mkdir(evidence,{recursive:true});
const executable=process.argv.includes('--packaged')?resolve('release/0.5.2/win-unpacked/Cueglass.exe'):resolve('node_modules/electron/dist/electron.exe');
const app=await electron.launch({executablePath:executable,args:process.argv.includes('--packaged')?['--smoke']:['.','--smoke'],cwd:process.cwd(),timeout:30000});
const findings={launch:true,offlineAnswer:false,questionSuggestion:false,captureAffinity:[],recordingRefused:false,uiErrors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',error=>findings.uiErrors.push(error.message));await page.waitForSelector('h1');
 const initial=await page.evaluate(()=>window.cue.status());if(initial.audio!=='stopped'||initial.requestCount!==0)throw new Error('App did not launch offline with recording stopped.');
 findings.secureStorage=await app.evaluate(({safeStorage})=>safeStorage.isEncryptionAvailable()&&safeStorage.decryptString(safeStorage.encryptString('synthetic-fixture'))==='synthetic-fixture');
 await page.getByRole('button',{name:'Try a practice question'}).click();await page.getByRole('button',{name:/Question ready/}).waitFor({timeout:5000});findings.questionSuggestion=true;
 await page.getByRole('button',{name:/^Assist/}).click();await page.locator('.answer-status').filter({hasText:'complete'}).waitFor({timeout:10000});
 findings.offlineAnswer=(await page.locator('.answer-body').textContent()).includes('local template');
 findings.audioIndicatorVisible=await page.evaluate(()=>{const box=window.document.querySelector('header').getBoundingClientRect();return box.top>=0&&box.bottom<=window.innerHeight;});
 await page.screenshot({path:resolve(evidence,'session.png')});
 await page.getByRole('button',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Start audio',exact:true}).click();await page.locator('#notice').filter({hasText:'Confirm permission'}).waitFor();
 findings.recordingRefused=await page.evaluate(async()=>{try{await window.cue.audio('recording','system',false);return false;}catch{return (await window.cue.status()).audio==='stopped';}});
 const handle=await app.evaluate(({BrowserWindow})=>{const handle=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();return (handle.length===8?handle.readBigUInt64LE():BigInt(handle.readUInt32LE())).toString();});
 const affinity=async()=>{
  const script=`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class CueglassCaptureProbe { [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint affinity); }'; [uint32]$captureAffinity=0; $captureRead=[CueglassCaptureProbe]::GetWindowDisplayAffinity([IntPtr]::new([long]${handle}),[ref]$captureAffinity); if(-not $captureRead){throw 'Capture affinity query failed'}; Write-Output $captureAffinity`;
  const result=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true});return Number(result.stdout.trim());
 };
 findings.captureAffinity.push(await affinity());await page.evaluate(()=>window.cue.protect(false));findings.captureAffinity.push(await affinity());await page.evaluate(()=>window.cue.protect(true));findings.captureAffinity.push(await affinity());
 findings.screenCaptureProbe=await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{
  const display=screen.getPrimaryDisplay();
  const probe=new BrowserWindow({width:100,height:100,x:display.workArea.x+30,y:display.workArea.y+30,frame:false,alwaysOnTop:true,skipTaskbar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  try{
   await probe.loadURL('data:text/html,<html><body style="margin:0;background:%23ff00ff;width:100vw;height:100vh"></body></html>');probe.show();
   const marker=async()=>{
    await new Promise(resolve=>setTimeout(resolve,400));
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:display.size});const source=sources.find(s=>s.display_id===String(display.id));
    if(!source||source.thumbnail.isEmpty())throw new Error('Screen thumbnail unavailable.');
    const size=source.thumbnail.getSize(),bounds=probe.getBounds();const x=Math.floor((bounds.x-display.bounds.x+bounds.width/2)*size.width/display.bounds.width),y=Math.floor((bounds.y-display.bounds.y+bounds.height/2)*size.height/display.bounds.height);
    // Inspect only a synthetic marker pixel in memory; never save or return a desktop image.
    const pixel=source.thumbnail.crop({x,y,width:1,height:1}).toBitmap();return pixel[0]>245&&pixel[1]<10&&pixel[2]>245;
   };
   const unprotectedMarkerVisible=await marker();probe.setContentProtection(true);const protectedMarkerVisible=await marker();return {route:'Electron desktopCapturer screen thumbnail',unprotectedMarkerVisible,protectedMarkerVisible};
  }finally{probe.destroy();}
 });
 await page.screenshot({path:resolve(evidence,'controls.png')});
 await page.getByRole('button',{name:'Accounts',exact:true}).click();await page.getByRole('button',{name:'Continue with ChatGPT',exact:true}).waitFor();await page.screenshot({path:resolve(evidence,'accounts.png')});
 findings.hotkeys=initial.hotkeys;
 findings.hotkeyBindings=initial.hotkeyBindings;
 if(!findings.offlineAnswer||!findings.questionSuggestion||!findings.recordingRefused||!findings.secureStorage||!findings.audioIndicatorVisible||findings.uiErrors.length)throw new Error('Desktop UI acceptance failed.');
 if(findings.captureAffinity.join(',')!=='17,0,17')throw new Error('Native capture affinity did not match protected/off/protected settings.');
 await writeFile(resolve(evidence,'smoke.json'),JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));
}finally{await app.close();}
