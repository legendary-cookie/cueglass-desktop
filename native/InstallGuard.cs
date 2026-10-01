using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
// Read-only guard: never terminate a process or inspect session contents.
class InstallGuard {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder path,ref int size);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(IntPtr handle,StringBuilder path,uint size,uint flags);
 static string Canonical(string path){
  path=Path.GetFullPath(path);if(!File.Exists(path))return path;
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){
   var value=new StringBuilder(32768);uint size=GetFinalPathNameByHandle(file.SafeFileHandle.DangerousGetHandle(),value,(uint)value.Capacity,0);if(size==0||size>=value.Capacity)throw new IOException("Cannot verify final path");string final=value.ToString();return final.StartsWith(@"\\?\UNC\")?@"\\"+final.Substring(8):final.StartsWith(@"\\?\")?final.Substring(4):final;
  }
 }
 static int Main(string[] args){
  if(args.Length==3&&args[0]=="--shortcut-owned"){
   try{if(!File.Exists(args[1]))return 1;Type type=Type.GetTypeFromProgID("WScript.Shell");object shell=Activator.CreateInstance(type);object link=type.InvokeMember("CreateShortcut",System.Reflection.BindingFlags.InvokeMethod,null,shell,new object[]{args[1]});string actual=(string)link.GetType().InvokeMember("TargetPath",System.Reflection.BindingFlags.GetProperty,null,link,null);return String.Equals(Canonical(actual),Canonical(args[2]),StringComparison.OrdinalIgnoreCase)?0:1;}catch{return 2;}
  }
  if(args.Length!=1)return 2;
  string target;try{target=Canonical(Path.GetFullPath(args[0]).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar+"Cueglass.exe");}catch{return 2;}
  foreach(Process p in Process.GetProcessesByName("Cueglass")){
   IntPtr h=OpenProcess(0x1000,false,p.Id);if(h==IntPtr.Zero){p.Dispose();return 2;}
   try{var text=new StringBuilder(32768);int size=text.Capacity;if(!QueryFullProcessImageName(h,0,text,ref size))return 2;if(String.Equals(Canonical(text.ToString()),target,StringComparison.OrdinalIgnoreCase))return 1;}catch{return 2;}
   finally{CloseHandle(h);p.Dispose();}
  }
  return 0;
 }
}
