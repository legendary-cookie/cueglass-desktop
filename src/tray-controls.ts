export type TrayActions={visible:()=>boolean;show:()=>void;hide:()=>void;settings:()=>void;pause:()=>void;quit:()=>void};
export function trayCommands(actions:TrayActions){return [
 {label:'Show / restore interaction',click:actions.show},
 {label:'Hide overlay',click:actions.hide},
 {label:'Settings',click:actions.settings},
 {label:'Pause audio',click:actions.pause},
 {type:'separator' as const},
 {label:'Quit Cueglass',click:actions.quit}
];}
export function toggleTray(actions:TrayActions):void {if(actions.visible())actions.hide();else actions.show();}
export function closeToTray(quitting:boolean,trayAvailable:boolean):boolean{return !quitting&&trayAvailable;}
