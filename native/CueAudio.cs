// Self-authored WASAPI bridge. No service, driver, hooks or automatic recording.
// Compile with the Windows .NET Framework compiler. Capture is a separate explicit
// command; listing devices / windowed apps never activates an audio client.
using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IDevices {
 [PreserveSig]int EnumAudioEndpoints(int flow,uint state,out IDeviceCollection devices);[PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);[PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IDevice device);
}
[ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IDeviceCollection {[PreserveSig]int GetCount(out uint count);[PreserveSig]int Item(uint index,out IDevice device);}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IDevice {
 [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object result);[PreserveSig]int OpenPropertyStore(uint access,out IProperties properties);[PreserveSig]int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);[PreserveSig]int GetState(out uint state);
}
[StructLayout(LayoutKind.Sequential)]struct PropertyKey {public Guid id;public uint index;public PropertyKey(string g,uint i){id=new Guid(g);index=i;}}
[StructLayout(LayoutKind.Explicit,Size=24)]struct PropVariant {[FieldOffset(0)]public ushort type;[FieldOffset(8)]public IntPtr pointer;[FieldOffset(8)]public uint size;[FieldOffset(16)]public IntPtr blob;}
[ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IProperties {[PreserveSig]int GetCount(out uint count);[PreserveSig]int GetAt(uint index,out PropertyKey key);[PreserveSig]int GetValue(ref PropertyKey key,out PropVariant value);[PreserveSig]int SetValue(ref PropertyKey key,ref PropVariant value);[PreserveSig]int Commit();}
[ComImport,Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioClient {
 [PreserveSig]int Initialize(int share,uint flags,long duration,long periodicity,IntPtr format,IntPtr session);[PreserveSig]int GetBufferSize(out uint frames);[PreserveSig]int GetStreamLatency(out long latency);[PreserveSig]int GetCurrentPadding(out uint padding);[PreserveSig]int IsFormatSupported(int share,IntPtr format,out IntPtr closest);[PreserveSig]int GetMixFormat(out IntPtr format);[PreserveSig]int GetDevicePeriod(out long standard,out long minimum);[PreserveSig]int Start();[PreserveSig]int Stop();[PreserveSig]int Reset();[PreserveSig]int SetEventHandle(IntPtr handle);[PreserveSig]int GetService(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object result);
}
[ComImport,Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioCapture {
 [PreserveSig]int GetBuffer(out IntPtr data,out uint frames,out uint flags,out ulong device,out ulong clock);[PreserveSig]int ReleaseBuffer(uint frames);[PreserveSig]int GetNextPacketSize(out uint frames);
}
[Guid("41D949AB-9862-444A-80F6-C261334DA5EB"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown),ComVisible(true)]public interface ICompletion { [PreserveSig]int ActivateCompleted(IActivation operation); }
[ComImport,Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface IActivation {[PreserveSig]int GetActivateResult(out int result,[MarshalAs(UnmanagedType.IUnknown)]out object instance);}
[Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown),ComVisible(true)]public interface IAgile {}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]public class Completion:ICompletion,IAgile {
 public ManualResetEvent ready=new ManualResetEvent(false);public object instance;public int result;
 public int ActivateCompleted(IActivation op){try{int call=op.GetActivateResult(out result,out instance);if(call<0)result=call;}catch(Exception e){result=e.HResult;}finally{ready.Set();}return 0;}
}
class CueAudio {
 static JavaScriptSerializer json=new JavaScriptSerializer();static volatile bool stop=false;
 static Guid clientId=new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2");
 [DllImport("Mmdevapi.dll",CharSet=CharSet.Unicode)]static extern int ActivateAudioInterfaceAsync(string path,ref Guid iid,ref PropVariant parameters,ICompletion callback,out IActivation operation);
 [DllImport("ole32.dll")]static extern int PropVariantClear(ref PropVariant value);
 [StructLayout(LayoutKind.Sequential,Pack=2)]struct Wave {public ushort tag,channels;public uint rate,bytes;public ushort block,bits,extra;}
 static void Check(int h){if(h<0)Marshal.ThrowExceptionForHR(h);}
 static void Emit(object value){Console.WriteLine(json.Serialize(value));Console.Out.Flush();}
 static IDevices Devices(){return (IDevices)new MMDeviceEnumerator();}
 static List<object> List(){var result=new List<object>();var devices=Devices();for(int flow=0;flow<2;flow++){
  IDeviceCollection collection;Check(devices.EnumAudioEndpoints(flow,1,out collection));uint count;Check(collection.GetCount(out count));for(uint n=0;n<count;n++){IDevice device;Check(collection.Item(n,out device));string id;Check(device.GetId(out id));IProperties p;Check(device.OpenPropertyStore(0,out p));var key=new PropertyKey("A45C254E-DF1C-4EFD-8020-67D146A850E0",14);PropVariant v;Check(p.GetValue(ref key,out v));string name=v.type==31?Marshal.PtrToStringUni(v.pointer):"Audio device";PropVariantClear(ref v);result.Add(new {id=id,name=name,kind=flow==0?"output":"microphone"});Marshal.ReleaseComObject(p);Marshal.ReleaseComObject(device);}Marshal.ReleaseComObject(collection);
 }Marshal.ReleaseComObject(devices);foreach(var process in Process.GetProcesses()){using(process)try{if(process.Id==Process.GetCurrentProcess().Id||string.IsNullOrWhiteSpace(process.MainWindowTitle))continue;result.Add(new {id=process.Id.ToString(),name=process.ProcessName+" â€” "+process.MainWindowTitle,kind="app"});}catch{}}
 return result;}
 static IAudioClient Activate(string kind,string id,out IntPtr format){
  format=IntPtr.Zero;if(kind=="app"){
   uint pid;if(!uint.TryParse(id,out pid)||pid==0)throw new Exception("Invalid application selection");using(var p=Process.GetProcessById((int)pid)){}
   IntPtr parameters=Marshal.AllocCoTaskMem(12);Marshal.WriteInt32(parameters,0,1);Marshal.WriteInt32(parameters,4,(int)pid);Marshal.WriteInt32(parameters,8,0);
   var variant=new PropVariant{type=65,size=12,blob=parameters};var callback=new Completion();IActivation operation;
   try{Check(ActivateAudioInterfaceAsync("VAD\\Process_Loopback",ref clientId,ref variant,callback,out operation));if(!callback.ready.WaitOne(10000))throw new Exception("Audio activation timed out");Check(callback.result);var client=(IAudioClient)callback.instance;
    var w=new Wave{tag=1,channels=2,rate=44100,bytes=176400,block=4,bits=16,extra=0};format=Marshal.AllocCoTaskMem(Marshal.SizeOf(typeof(Wave)));Marshal.StructureToPtr(w,format,false);Marshal.ReleaseComObject(operation);GC.KeepAlive(callback);return client;
   }finally{Marshal.FreeCoTaskMem(parameters);}
  }
  var enumerator=Devices();IDevice device;if(id=="default")Check(enumerator.GetDefaultAudioEndpoint(kind=="microphone"?1:0,1,out device));else Check(enumerator.GetDevice(id,out device));
  object obj;Check(device.Activate(ref clientId,23,IntPtr.Zero,out obj));Marshal.ReleaseComObject(device);Marshal.ReleaseComObject(enumerator);var audio=(IAudioClient)obj;Check(audio.GetMixFormat(out format));return audio;
 }
 static byte[] Wav(short[] samples){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));writer.Write(36+samples.Length*2);writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));writer.Write(16);writer.Write((ushort)1);writer.Write((ushort)1);writer.Write(16000);writer.Write(32000);writer.Write((ushort)2);writer.Write((ushort)16);writer.Write(System.Text.Encoding.ASCII.GetBytes("data"));writer.Write(samples.Length*2);foreach(short value in samples)writer.Write(value);return stream.ToArray();}}
 static bool Voice(ref bool active,ref long lastVoice,ref int turn,double peak,long now){bool before=active;if(peak>0.012){lastVoice=now;if(!active){active=true;turn++;}}else if(active&&now-lastVoice>7000000)active=false;return before!=active;}
 static void Capture(string kind,string id){IntPtr format;IAudioClient client=Activate(kind,id,out format);IAudioCapture capture=null;try{
  var w=(Wave)Marshal.PtrToStructure(format,typeof(Wave));bool floating=w.tag==3||(w.tag==65534&&Marshal.ReadInt16(format,24)==3);if(w.channels<1||w.channels>32||w.rate<8000||w.rate>192000||!(w.bits==16||w.bits==32&&floating))throw new Exception("Unsupported device mix format");
  Check(client.Initialize(0,kind=="microphone"?0u:0x20000u,10000000,0,format,IntPtr.Zero));Guid iid=new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");object obj;Check(client.GetService(ref iid,out obj));capture=(IAudioCapture)obj;Check(client.Start());Emit(new {type="ready"});
  new Thread(()=>{while(Console.ReadLine()!=null){stop=true;break;}stop=true;}){IsBackground=true}.Start();var samples=new List<short>(64000);double phase=0,sum=0;int averaging=0;long lastMeter=0,lastVoice=0;double peak=0;bool speaking=false;int turn=0;
  while(!stop){uint frames;Check(capture.GetNextPacketSize(out frames));while(frames>0){IntPtr data;uint flags;ulong position,clock;Check(capture.GetBuffer(out data,out frames,out flags,out position,out clock));try{double packetPeak=0;for(uint f=0;f<frames;f++){double value=0;if((flags&2)==0){for(int c=0;c<w.channels;c++){int offset=(int)f*w.block+c*(w.bits/8);value+=floating?BitConverter.ToSingle(BitConverter.GetBytes(Marshal.ReadInt32(data,offset)),0):Marshal.ReadInt16(data,offset)/32768.0;}value/=w.channels;}peak=Math.Max(peak,Math.Abs(value));packetPeak=Math.Max(packetPeak,Math.Abs(value));sum+=value;averaging++;phase+=16000;if(phase>=w.rate){phase-=w.rate;double mono=Math.Max(-1,Math.Min(1,sum/averaging));samples.Add((short)Math.Round(mono*32767));sum=0;averaging=0;}
    if(samples.Count>=64000){double energy=0;foreach(short sample in samples)energy+=(double)sample*sample;energy/=samples.Count*32768.0*32768.0;if(energy>0.00002)Emit(new {type="wav",turn=turn,data=Convert.ToBase64String(Wav(samples.ToArray()))});samples.Clear();}}if(packetPeak>0.012&&Voice(ref speaking,ref lastVoice,ref turn,packetPeak,DateTime.UtcNow.Ticks))Emit(new {type="voice",active=true,turn=turn});
   }finally{Check(capture.ReleaseBuffer(frames));}Check(capture.GetNextPacketSize(out frames));}
   long now=DateTime.UtcNow.Ticks;if(Voice(ref speaking,ref lastVoice,ref turn,0,now)&&!speaking){Emit(new {type="voice",active=false,turn=turn});if(samples.Count>=8000){double energy=0;foreach(short sample in samples)energy+=(double)sample*sample;energy/=samples.Count*32768.0*32768.0;if(energy>0.00002)Emit(new {type="wav",turn=turn,data=Convert.ToBase64String(Wav(samples.ToArray()))});}samples.Clear();}if(now-lastMeter>2000000){Emit(new {type="meter",peak=Math.Min(1,peak)});peak=0;lastMeter=now;}Thread.Sleep(20);
  }Check(client.Stop());
 }finally{if(capture!=null)Marshal.ReleaseComObject(capture);Marshal.ReleaseComObject(client);Marshal.FreeCoTaskMem(format);}}
 [MTAThread]static int Main(string[] args){Console.OutputEncoding=new System.Text.UTF8Encoding(false);try{
  if(args.Length==1&&args[0]=="list"){Emit(new {sources=List()});return 0;}
     if(args.Length==1&&args[0]=="self-test-vad"){bool active=false;long last=0;int turn=0;bool start=Voice(ref active,ref last,ref turn,.05,10000000);bool premature=Voice(ref active,ref last,ref turn,0,16000000);bool end=Voice(ref active,ref last,ref turn,0,17100000);bool restart=Voice(ref active,ref last,ref turn,.05,20000000);bool passed=start&&!premature&&end&&restart&&turn==2;Emit(new {type="vad-self-test",passed=passed,energyThreshold=.012,hangoverMs=700,turns=turn,recording=false});return passed?0:1;}
if(args.Length==1&&args[0]=="self-test"){var values=new short[64000];for(int i=0;i<values.Length;i++)values[i]=(short)(Math.Sin(i*2*Math.PI*440/16000)*8000);byte[] wav=Wav(values);Emit(new {type="self-test",samples=values.Length,bytes=wav.Length,rate=BitConverter.ToInt32(wav,24),channels=BitConverter.ToInt16(wav,22),activationParameterBytes=12,propVariantBytes=Marshal.SizeOf(typeof(PropVariant)),waveBytes=Marshal.SizeOf(typeof(Wave)),recording=false});return 0;}
  if(args.Length==1&&args[0]=="fixture-stream"){
   // Emits synthetic protocol events, without opening any audio endpoint.
   Emit(new {type="ready"});new Thread(()=>{Console.ReadLine();stop=true;}){IsBackground=true}.Start();
   while(!stop){Emit(new {type="meter",peak=0.25});Thread.Sleep(50);}return 0;
  }
  if(args.Length==2&&args[0]=="probe-app"){
   // Activation/initialization only, targeting an explicitly supplied test PID.
   // No Start, GetBuffer or endpoint recording is performed.
   IntPtr format;var client=Activate("app",args[1],out format);
   try{Check(client.Initialize(0,0x20000,10000000,0,format,IntPtr.Zero));Emit(new {type="app-probe",initialized=true,callbackVisible=Marshal.IsTypeVisibleFromCom(typeof(Completion)),recording=false,includesProcessChildren=true});}
   finally{Marshal.FreeCoTaskMem(format);Marshal.ReleaseComObject(client);}return 0;
  }
  if(args.Length!=3||args[0]!="capture"||!(args[1]=="microphone"||args[1]=="output"||args[1]=="system"||args[1]=="app"))throw new Exception("Invalid audio command");Capture(args[1],args[2]);return 0;
 }catch(Exception e){Emit(new {type="error",message="Windows audio source unavailable (0x"+e.HResult.ToString("X8")+"). Check device permissions, source availability and Windows compatibility."});return 1;}}
}
