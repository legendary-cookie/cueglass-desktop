export interface EventTarget {isDestroyed():boolean;webContents:{isDestroyed():boolean;send(channel:string,value:unknown):void}}
export function sendIfAlive(target:EventTarget|undefined,channel:string,value:unknown):boolean {
 if(!target||target.isDestroyed())return false;
 const contents=target.webContents;if(contents.isDestroyed())return false;
 contents.send(channel,value);return true;
}
