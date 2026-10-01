export type PreviewImage={dataUrl:string;width:number;height:number};
export function validateImage(image:unknown):asserts image is PreviewImage {
 if(!image||typeof image!=='object')throw new Error('Invalid image preview.');const i=image as PreviewImage;
 if(typeof i.dataUrl!=='string'||i.dataUrl.length>2800000||!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(i.dataUrl)||!Number.isInteger(i.width)||!Number.isInteger(i.height)||i.width<1||i.height<1||i.width>2048||i.height>2048)throw new Error('Image must be PNG or JPEG, under 2 MiB and 2048 pixels per side.');
 const bytes=Buffer.from(i.dataUrl.split(',')[1],'base64');if(bytes.length>2*1024*1024||!(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw new Error('Invalid PNG/JPEG image data.');
}
export function cropRect(start:{x:number;y:number},end:{x:number;y:number},width:number,height:number):{x:number;y:number;width:number;height:number} {
 const x=Math.max(0,Math.min(width-1,Math.floor(Math.min(start.x,end.x))));const y=Math.max(0,Math.min(height-1,Math.floor(Math.min(start.y,end.y))));
 const w=Math.min(width-x,Math.max(0,Math.ceil(Math.abs(end.x-start.x))));const h=Math.min(height-y,Math.max(0,Math.ceil(Math.abs(end.y-start.y))));if(w<8||h<8)throw new Error('Select a region at least 8 pixels wide and high.');return {x,y,width:w,height:h};
}
