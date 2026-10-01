import { build } from 'esbuild';
import { resolve } from 'node:path';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
const root=process.cwd();
if(process.platform==='win32'){
 mkdirSync(resolve(root,'bundled/native'),{recursive:true});
 const compiler=resolve(process.env.WINDIR??'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 if(!existsSync(compiler))throw new Error('Install the Windows .NET Framework developer compiler to build the native helper.');
 execFileSync(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/reference:System.Web.Extensions.dll','/out:'+resolve(root,'bundled/native/CueAudio.exe'),resolve(root,'native/CueAudio.cs')],{windowsHide:true,stdio:'inherit'});
}
await build({ absWorkingDir:root,tsconfig:resolve(root,'tsconfig.json'),entryPoints:[resolve(root,'src/main.ts')], outfile:resolve(root,'dist/main.cjs'), bundle:true, platform:'node', format:'cjs', target:'node24', external:['electron'], sourcemap:false });
await build({ absWorkingDir:root,tsconfig:resolve(root,'tsconfig.json'),entryPoints:[resolve(root,'src/preload.ts')], outfile:resolve(root,'dist/preload.cjs'), bundle:true, platform:'node', format:'cjs', external:['electron'] });
