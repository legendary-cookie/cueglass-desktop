export function pcmWav(samples:Float32Array,rate:number):ArrayBuffer {
 const ratio=rate/16000;const length=Math.floor(samples.length/ratio);const buffer=new ArrayBuffer(44+length*2);const view=new DataView(buffer);
 const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
 for(let i=0;i<length;i++){const start=Math.floor(i*ratio),end=Math.max(start+1,Math.floor((i+1)*ratio));let sum=0;for(let j=start;j<end&&j<samples.length;j++)sum+=samples[j];const value=Math.max(-1,Math.min(1,sum/(end-start)));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);}return buffer;
}
export class LocalAudio {
 private media?:MediaStream;private context?:AudioContext;private processor?:ScriptProcessorNode;private chunks:Float32Array[]=[];private count=0;private epoch=0;private queued=false;
 constructor(private transcript:(text:string)=>void,private report:(text:string)=>void){}
 async start(source:'microphone'|'system'):Promise<void> {
  this.stop();const epoch=this.epoch;
  const media=source==='microphone'?await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  if(epoch!==this.epoch){media.getTracks().forEach(t=>t.stop());return;}
  media.getVideoTracks().forEach(t=>t.stop());
  if(!media.getAudioTracks().length){media.getTracks().forEach(t=>t.stop());throw new Error('Windows did not provide an audio track. Check device permissions.');}
  this.media=media;this.context=new AudioContext();await this.context.resume();
  if(epoch!==this.epoch){this.stop();return;}
  const input=this.context.createMediaStreamSource(media);const processor=this.context.createScriptProcessor(4096,1,1);this.processor=processor;
  const silent=this.context.createGain();silent.gain.value=0;input.connect(processor);processor.connect(silent);silent.connect(this.context.destination);
  for(const track of media.getAudioTracks())track.onended=()=>{this.stop();void window.cue.audio('stopped',source,false);this.report('Audio device stopped. Start it again when ready.');};
  processor.onaudioprocess=event=>{
   const samples=new Float32Array(event.inputBuffer.getChannelData(0));this.chunks.push(samples);this.count+=samples.length;
   if(this.count<this.context!.sampleRate*4)return;
   const joined=new Float32Array(this.count);let offset=0;for(const chunk of this.chunks){joined.set(chunk,offset);offset+=chunk.length;}this.chunks=[];this.count=0;
   const energy=joined.reduce((sum,n)=>sum+n*n,0)/joined.length;if(energy<0.0001)return;
   if(this.queued){this.report('Local transcription is slower than audio. One chunk was skipped; pause or use a smaller model.');return;}
   const wav=pcmWav(joined,this.context!.sampleRate);this.queued=true;
   window.cue.transcribe(wav).then(text=>{if(epoch===this.epoch&&text)this.transcript(text);}).catch(()=>{if(epoch===this.epoch)this.report('Local transcription failed. Check the Whisper executable and model.');}).finally(()=>{this.queued=false;});
  };
 }
 stop():void {this.epoch++;if(this.processor){this.processor.onaudioprocess=null;this.processor.disconnect();}if(this.media){for(const track of this.media.getTracks()){track.onended=null;track.stop();}}void this.context?.close();this.media=undefined;this.context=undefined;this.processor=undefined;this.chunks=[];this.count=0;}
}
