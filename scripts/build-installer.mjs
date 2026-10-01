import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const oldFixture=process.argv.includes('--old-validation');
const version=oldFixture?'0.5.4':JSON.parse(readFileSync('package.json')).version;
const payload=resolve(`release/${version}/win-unpacked`);const root=resolve(oldFixture?'.publish/installer-old-validation':`release/${version}`);
mkdirSync(root,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
const catalog=JSON.parse(readFileSync('src/speech-catalog.json'));
for(const model of catalog.filter(m=>(oldFixture?['base-q5_1']:['tiny-q5_1','base-q5_1','small-q5_1']).includes(m.id))){const bytes=readFileSync(join(payload,'resources/bundled/whisper',model.file));if(bytes.length!==model.bytes||sha(bytes)!==model.sha256)throw new Error('Bundled model verification failed: '+model.id);}
const cache=join(process.env.LOCALAPPDATA,'electron-builder','Cache','nsis-3.0.4.1');
const nsis=readdirSync(cache).map(name=>join(cache,name,'Bin','makensis.exe')).find(p=>existsSync(p));if(!nsis)throw new Error('Verified electron-builder NSIS 3.0.4.1 compiler is unavailable.');
if(!oldFixture){
 const docs=join(payload,'documentation');mkdirSync(join(docs,'licenses'),{recursive:true});
 for(const name of readdirSync('installer/documentation'))copyFileSync(join('installer/documentation',name),join(docs,name));
 copyFileSync('LICENSE',join(docs,'LICENSE-Cueglass.txt'));
 const notices={'LICENSE-Electron.txt':'node_modules/electron/dist/LICENSE','LICENSES.chromium.html':'node_modules/electron/dist/LICENSES.chromium.html','LICENSE-jose.txt':'node_modules/jose/LICENSE.md','LICENSE-Whisper.txt':'bundled/whisper/LICENSE-Whisper.txt','LICENSE-whisper.cpp.txt':'bundled/whisper/LICENSE-whisper.cpp.txt','LICENSE-SDL2.txt':'bundled/whisper/LICENSE-SDL2.txt','LICENSE-NSIS.txt':join(nsis,'..','..','COPYING')};
 for(const [name,path] of Object.entries(notices))copyFileSync(path,join(docs,'licenses',name));copyFileSync('bundled/whisper/manifest.json',join(docs,'models-manifest.json'));
}
const guard=join(root,'InstallGuard.exe');
const compiler=join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
execFileSync(compiler,['/nologo','/optimize+','/target:exe','/platform:x64','/out:'+guard,resolve('native/InstallGuard.cs')],{stdio:'inherit',windowsHide:true});
const files=[],dirs=[];function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory()){walk(path);dirs.push(path);}else files.push(path);}}walk(payload);
const escape=p=>p.replaceAll('$','$$').replaceAll('"','$\\"');
const deletions=files.map(p=>'Delete "$INSTDIR\\'+escape(relative(payload,p))+'"').concat(dirs.map(p=>'RMDir "$INSTDIR\\'+escape(relative(payload,p))+'"')).join('\n');
const deleteFile=join(root,'delete-installed-files.nsh');writeFileSync(deleteFile,deletions+'\n');
mkdirSync(root,{recursive:true});
for(const test of oldFixture?[true]:[false,true]){
 const output=join(root,test?'Cueglass-Installer-Validation.exe':`Cueglass-Setup-${version}-x64.exe`);
 const args=['/V2','/DVERSION='+version,'/DPAYLOAD='+payload,'/DGUARD='+guard,'/DDELETEFILES='+deleteFile,'/DOUTPUT='+output];
 if(test)args.push('/DREGKEY=CueglassInstallerValidation','/DDISPLAYNAME=Cueglass Installer Validation');
 args.push(resolve('installer/cueglass.nsi'));execFileSync(nsis,args,{stdio:'inherit',windowsHide:true});
 console.log(JSON.stringify({installer:test?'isolated-validation':'release',version,bytes:readFileSync(output).length,sha256:sha(readFileSync(output)),files:files.length}));
}
