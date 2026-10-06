import {Miniflare,Response as WorkerResponse} from 'miniflare';
// Use Node's TLS/network stack for local preview on Windows. Production
// uses Cloudflare's fetch implementation directly.
const outboundService=async request=>{
 const url=new URL(request.url);
 if(url.origin!=='https://myvici.info')return new WorkerResponse('Destination blocked',{status:403});
 const response=await fetch(url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',signal:AbortSignal.timeout(60000)});
 const headers=new Headers(response.headers);
 // Node fetch has already decompressed the upstream body.
 headers.delete('Content-Encoding');headers.delete('Content-Length');headers.delete('Transfer-Encoding');
 return new WorkerResponse(response.body,{status:response.status,headers});
};
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',host:'127.0.0.1',port:8787,outboundService});
console.log('Local URL: '+await mf.ready);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0);});
