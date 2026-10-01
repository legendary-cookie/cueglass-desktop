import { describe,it,expect,vi } from 'vitest';
import { requestBody,streamProvider,sse,listModels } from '../src/providers';
const controller=()=>new AbortController();
function response(events:string[]):Response{return new Response(new ReadableStream({start(c){for(const event of events)c.enqueue(new TextEncoder().encode(event));c.close();}}));}
async function gather(events:string[],provider:'chatgpt'|'claude'|'deepseek'='chatgpt') {const all=[];for await(const event of streamProvider({provider,model:'fixture-only',token:'test-only',prompt:'test',signal:controller().signal,maxOutput:600,fetcher:async()=>response(events)}))all.push(event);return all;}
describe('provider streaming contracts',()=>{
 it('preserves official account model IDs and ordering without Codex aliases',async()=>{
  const ids=['gpt-6-luna','gpt-6-sol','gpt-6.1-sol'];const fetcher=vi.fn(async()=>new Response(JSON.stringify({models:[...ids.map(slug=>({slug,display_name:slug,visibility:'list'})),{slug:'hidden',display_name:'Hidden',visibility:'hide'}]})));
  vi.stubGlobal('fetch',fetcher);try{expect((await listModels('chatgpt','synthetic-only')).map(m=>m.id)).toEqual(ids);expect(fetcher.mock.calls).toHaveLength(1);}finally{vi.unstubAllGlobals();}
 });
 it('rejects malformed account catalogs rather than silently replacing the last good list',async()=>{
  for(const body of [{data:[{id:'not-the-plan-catalog'}]},{models:[{visibility:'list',display_name:'Missing ID'}]},null]){
   vi.stubGlobal('fetch',async()=>new Response(JSON.stringify(body)));try{await expect(listModels('chatgpt','synthetic-only')).rejects.toThrow('catalog');}finally{vi.unstubAllGlobals();}
  }
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({models:[]})));try{expect(await listModels('chatgpt','synthetic-only')).toEqual([]);}finally{vi.unstubAllGlobals();}
 });
 it('uses the exact SIWC preview fields',()=>{const body=requestBody({provider:'chatgpt',model:'fixture-only',token:'',prompt:'test',signal:controller().signal,maxOutput:600});expect(body.store).toBe(false);expect(body.stream).toBe(true);expect(Array.isArray(body.input)).toBe(true);for(const unsupported of ['max_output_tokens','temperature','previous_response_id','conversation'])expect(body).not.toHaveProperty(unsupported);});
 it('parses fragmented CRLF SSE and multiline data',async()=>{const stream=response(['data: {"val','ue":1}\r\n\r','\ndata: first\r\ndata: second\r\n\r\n']).body!;const values=[];for await(const event of sse(stream,controller().signal))values.push(event);expect(values).toEqual(['{"value":1}','first\nsecond']);});
 it('requires an OpenAI completion event and reports usage',async()=>{const result=await gather(['data: {"type":"response.output_text.delta","delta":"Hello"}\n\n','data: {"type":"response.completed","response":{"usage":{"input_tokens":4,"output_tokens":2}}}\n\n']);expect(result).toEqual([{delta:'Hello'},{done:true,input:4,output:2}]);await expect(gather(['data: {"type":"response.output_text.delta","delta":"Partial"}\n\n'])).rejects.toThrow('before');});
 it('handles late usage failures without reporting success',async()=>{await expect(gather(['data: {"type":"response.output_text.delta","delta":"Partial"}\n\n','data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n'])).rejects.toThrow('usage limit');});
 it('accepts Claude text events and terminal message_stop',async()=>{expect(await gather(['data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Answer"}}\n\n','data: {"type":"message_stop"}\n\n'],'claude')).toEqual([{delta:'Answer'},{done:true}]);});
 it('accepts compatible chat streams and rejects early finish reasons',async()=>{expect(await gather(['data: {"choices":[{"delta":{"content":"Answer"}}]}\n\n','data: [DONE]\n\n'],'deepseek')).toEqual([{delta:'Answer'},{done:true}]);await expect(gather(['data: {"choices":[{"finish_reason":"length"}]}\n\n','data: [DONE]\n\n'],'deepseek')).rejects.toThrow('early');});
 it('keeps HTTP error bodies and secrets out of surfaced errors',async()=>{const execute=async()=>{for await(const event of streamProvider({provider:'claude',model:'fixture-only',token:'secret-test-key',prompt:'test',signal:controller().signal,maxOutput:600,fetcher:async()=>new Response('secret-test-key',{status:401})}))void event;};await expect(execute()).rejects.toThrow('HTTP 401');try{await execute();}catch(error){expect((error as Error).message).not.toContain('secret-test-key');}});
});
