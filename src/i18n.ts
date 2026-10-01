// Static interface copy only. Never translate user transcripts, images or secrets.
// English is the complete baseline while additional UI language priorities are pending.
export const localeCatalog={en:{name:'English',strings:{pin:'Pin',unpin:'Unpin',top:'Top',untop:'Top off',assist:'Assist',edit:'Edit',save:'Save correction',cancel:'Cancel',realtime:'Realtime answers',stopped:'Audio stopped'}}};
export type MessageKey=keyof typeof localeCatalog.en.strings;
export function message(key:MessageKey,locale:string='en'):string{return (Object.hasOwn(localeCatalog,locale)?localeCatalog[locale as 'en']:localeCatalog.en).strings[key];}
export function applyLocale(root:HTMLElement,locale:string='en'):void {root.lang=Object.hasOwn(localeCatalog,locale)?locale:'en';for(const node of root.querySelectorAll<HTMLElement>('[data-i18n]')){const key=node.dataset.i18n as MessageKey;if(key in localeCatalog.en.strings)node.textContent=message(key,locale);}}
