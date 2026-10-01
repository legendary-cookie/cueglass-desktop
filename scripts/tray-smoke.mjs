import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);const findings={version:'0.5.2',uiErrors:[],realOAuth:false};
const app=await electron.launch({executablePath:resolve('release/0.5.2/win-unpacked/Cueglass.exe'),args:['--smoke'],cwd:process.cwd(),timeout:30000});
const child=app.process();
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>findings.uiErrors.push(e.message));await page.waitForSelector('#pin');await page.evaluate(()=>window.cue.overlay({compact:false}));
 const initial=await page.evaluate(()=>window.cue.status());assert(initial.audio==='stopped'&&initial.capture&&!initial.authPending,'Unsafe initial state');
 const native=await app.evaluate(({BrowserWindow})=>({handle:BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString(),tray:globalThis.cueTrayTest.trayAlive(),icon:globalThis.cueTrayTest.iconValid,bounds:globalThis.cueTrayTest.bounds()}));findings.tray=native;
 assert(native.tray&&native.icon,'Tray icon was not created');
 const styleScript=`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CueTrayStyle{[DllImport("user32.dll")]public static extern long GetWindowLongPtr(IntPtr h,int index);}';$e=[CueTrayStyle]::GetWindowLongPtr([IntPtr]::new([long]${native.handle}),-20);@{toolWindow=([bool]($e -band 128));appWindow=([bool]($e -band 262144));topmost=([bool]($e -band 8))}|ConvertTo-Json -Compress`;
 const styles=JSON.parse((await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',styleScript],{windowsHide:true})).stdout);findings.nativeStyles=styles;assert(!styles.appWindow&&styles.topmost,'Native topmost style failed');
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setAppDetails({appId:'local.cueglass.tray-acceptance'});w.setSkipTaskbar(false);});
 const queryTaskbar=async()=>JSON.parse((await execute('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/taskbar-probe.ps1')],{windowsHide:true})).stdout);
 const positive=await queryTaskbar();findings.taskbarPositiveControl=positive;assert(positive.matchingCount>0,'Taskbar positive control unavailable');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSkipTaskbar(true));const excluded=await queryTaskbar();findings.taskbarExcluded=excluded;assert(excluded.matchingCount===0,'Cueglass remained in the taskbar');
 await page.locator('#question').fill('Synthetic unsaved session - preserve across tray close.');await page.locator('#close').click();
 const closed=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {destroyed:w.isDestroyed(),visible:w.isVisible()};});assert(!closed.destroyed&&!closed.visible,'Close did not hide to tray');
 await app.evaluate(()=>globalThis.cueTrayTest.commands.show());assert(await page.locator('#question').inputValue()==='Synthetic unsaved session - preserve across tray close.','Close-to-tray lost session');findings.closePreservesSession=true;
 for(let n=0;n<3;n++){await app.evaluate(()=>globalThis.cueTrayTest.activate());assert(!await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),'Tray click did not hide');await app.evaluate(()=>globalThis.cueTrayTest.activate());assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),'Tray click did not show');}findings.repeatedTrayToggle=true;
 await app.evaluate(()=>globalThis.cueTrayTest.commands.settings());await page.waitForSelector('#overlay-settings:not([hidden])');findings.settingsFromTray=true;await page.screenshot({path:resolve('evidence/tray-settings-0.3.png')});await page.locator('#dismiss-appearance').click();
 await page.locator('#minimize').click();assert(!await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),'Minimize did not hide to tray');await page.evaluate(()=>window.cue.recover());findings.minimizeRecovery=true;
 await page.getByRole('button',{name:'Accounts',exact:true}).click();await page.locator('#sign-in').click();await waitForAsync(page,async()=>(await window.cue.status()).authPending);
 const authURL=await app.evaluate(()=>globalThis.cueAuthTest.url);const request=new URL(authURL);findings.requestContract={hostIsURN:request.searchParams.get('ext_agent_host_id').startsWith('urn:uuid:'),loopback:new URL(request.searchParams.get('redirect_uri')).hostname==='127.0.0.1',initialClient:request.searchParams.get('client_id')==='dynamic_agent_client',pkce:request.searchParams.get('code_challenge_method')==='S256'};
 assert(Object.values(findings.requestContract).every(Boolean),'Packaged auth request contract failed');await page.locator('#cancel-sign-in').click();await waitForAsync(page,async()=>!(await window.cue.status()).authPending);findings.authCanceled=true;
 await page.locator('#sign-in').click();await waitForAsync(page,async()=>(await window.cue.status()).authPending);const deniedURL=new URL(await app.evaluate(()=>globalThis.cueAuthTest.url));const callback=new URL(deniedURL.searchParams.get('redirect_uri'));callback.searchParams.set('state',deniedURL.searchParams.get('state'));callback.searchParams.set('error','access_denied');const denied=await fetch(callback);assert(denied.status===400,'Denied callback not handled');await waitForAsync(page,async()=>!(await window.cue.status()).authPending);await page.locator('#notice').filter({hasText:'permission was not granted'}).waitFor();findings.authDenied=true;
 await page.locator('#sign-in').click();await waitForAsync(page,async()=>(await window.cue.status()).authPending);await page.locator('#close').click();await app.evaluate(()=>globalThis.cueTrayTest.commands.show());assert(!(await page.evaluate(()=>window.cue.status())).authPending,'Close-to-tray left auth pending');findings.authInterruptedByClose=true;
 assert((await page.evaluate(()=>window.cue.status())).audio==='stopped','Audio state changed during tray/auth tests');findings.audioStayedOff=true;assert(!findings.uiErrors.length,'UI error during tray workflow');
 const exited=new Promise(resolve=>child.once('exit',resolve));await app.evaluate(()=>globalThis.cueTrayTest.commands.quit()).catch(()=>{});await exited;findings.quitExited=true;findings.passed=true;
 await writeFile(resolve('evidence/tray-smoke-0.3.json'),JSON.stringify(findings,null,2));console.log(JSON.stringify(findings,null,2));
}catch(error){findings.error=String(error);await writeFile(resolve('evidence/tray-smoke-0.3-failure.json'),JSON.stringify(findings,null,2));throw error;}finally{if(child.exitCode===null&&child.signalCode===null)await app.close();}

async function waitForAsync(page,fn,arg,options){const timeout=options?.timeout??10000;const end=Date.now()+timeout;do{if(await page.evaluate(fn,arg))return;await page.waitForTimeout(50);}while(Date.now()<end);throw new Error('Asynchronous app state did not reach the expected condition.');}
