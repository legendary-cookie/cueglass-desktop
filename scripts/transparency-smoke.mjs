import {_electron as electron} from 'playwright';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const app=await electron.launch({executablePath:resolve('release/0.5.2/win-unpacked/Cueglass.exe'),args:['--smoke'],cwd:process.cwd(),timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForSelector('#pin');await page.evaluate(()=>window.cue.overlay({opacity:.1,bounds:{x:20,y:20,width:960,height:700}}));
 const result=await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{
  const main=BrowserWindow.getAllWindows()[0];const bounds=main.getBounds();const display=screen.getDisplayMatching(bounds);
  const fixture=new BrowserWindow({...bounds,frame:false,alwaysOnTop:true,show:false,webPreferences:{contextIsolation:true,sandbox:true}});
  try{
   await fixture.loadURL('data:text/html,<body style="margin:0;background:black;width:100vw;height:100vh">');fixture.show();fixture.focus();main.moveTop();main.setContentProtection(false);
   const pixel=async()=>{await new Promise(resolve=>setTimeout(resolve,400));const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:display.size});const source=sources.find(s=>s.display_id===String(display.id));if(!source)throw new Error('Synthetic capture route unavailable');const size=source.thumbnail.getSize();const x=Math.floor((bounds.x-display.bounds.x+bounds.width/2)*size.width/display.bounds.width),y=Math.floor((bounds.y-display.bounds.y+14)*size.height/display.bounds.height);return source.thumbnail.crop({x,y,width:1,height:1}).toBitmap();};
   const dark=await pixel();await fixture.webContents.executeJavaScript('document.body.style.background="white"');const light=await pixel();
   // Only a synthetic fixture pixel is inspected; no desktop image or RGB data leaves this function.
   return {realBackdropVisible:[0,1,2].every(i=>light[i]-dark[i]>40),channelChanges:[0,1,2].map(i=>light[i]-dark[i]),captureRoute:'Electron desktopCapturer synthetic fixture pixel'};
  }finally{main.setContentProtection(true);fixture.destroy();}
 });
 await page.evaluate(()=>window.cue.overlay({opacity:.88}));console.log(JSON.stringify(result));if(!result.realBackdropVisible)throw new Error('Backdrop did not alter translucent header pixel');await writeFile(resolve('evidence/transparency-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();}
