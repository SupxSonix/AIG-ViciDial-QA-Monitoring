import {createAccessService} from './access-storage.mjs';
import {createReviewLinkService} from './review-link-storage.mjs';
import {createSpiffService} from './spiff-storage.mjs';
import {createPayslipService} from './payslip-storage.mjs';
import {createHistoryService} from './history-storage.mjs';
import {resolve} from 'node:path';
import {Miniflare,Response as WorkerResponse} from 'miniflare';
// Use Node's TLS/network stack for local preview on Windows. Production
// uses Cloudflare's fetch implementation directly.
const vicidialOrigin=new URL(process.env.VICIDIAL_ORIGIN||'https://myvici.info').origin;
const outboundService=async request=>{
 const url=new URL(request.url);
 if(url.origin!==vicidialOrigin&&!(url.href==='https://challenges.cloudflare.com/turnstile/v0/siteverify'&&request.method==='POST'))return new WorkerResponse('Destination blocked',{status:403});
 const forwardedHeaders=new Headers(request.headers);forwardedHeaders.delete('Content-Length');
 const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
 const response=await fetch(url,{method:request.method,headers:Object.fromEntries(forwardedHeaders),body,redirect:'manual',signal:AbortSignal.timeout(60000)});
 const headers=new Headers(response.headers);
 // Node fetch has already decompressed the upstream body.
 headers.delete('Content-Encoding');headers.delete('Content-Length');headers.delete('Transfer-Encoding');
 return new WorkerResponse(response.body,{status:response.status,headers});
};
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',host:'127.0.0.1',port:8787,bindings:{AGENT_REPORT_USER:process.env.AGENT_REPORT_USER||'',AGENT_REPORT_PASS:process.env.AGENT_REPORT_PASS||'',SUPER_ADMIN:process.env.SUPER_ADMIN||process.env.SPIFF_ADMIN||'',VICIDIAL_ORIGIN:process.env.VICIDIAL_ORIGIN||'https://myvici.info',APP_NAME:process.env.APP_NAME||'AIG / Monitoring System',SPIFF_ADMIN:process.env.SPIFF_ADMIN||'',TURNSTILE_ENABLED:process.env.TURNSTILE_ENABLED||'true',TURNSTILE_SITE_KEY:process.env.TURNSTILE_SITE_KEY||'0x4AAAAAAEkUwlNfuu-QzxQZ',TURNSTILE_SECRET_KEY:process.env.TURNSTILE_SECRET_KEY||'',TURNSTILE_HOSTNAME:process.env.TURNSTILE_HOSTNAME||'agent.phdirectory.net'},outboundService,serviceBindings:{APP_ACCESS:createAccessService(resolve(process.env.QA_ACCESS_DIR||'storage/access'),WorkerResponse),REVIEW_LINKS:createReviewLinkService(resolve(process.env.QA_REVIEW_LINK_DIR||'storage/review-links'),WorkerResponse),SPIFFS:createSpiffService(resolve(process.env.QA_SPIFF_DIR||'storage/spiffs'),WorkerResponse),PAYSLIPS:createPayslipService(resolve(process.env.QA_PAYSLIP_DIR||'storage/payslips'),WorkerResponse),REVIEW_HISTORY:createHistoryService(resolve(process.env.QA_HISTORY_DIR||'storage/review-history'),WorkerResponse)}});
console.log('Local URL: '+await mf.ready);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0);});
