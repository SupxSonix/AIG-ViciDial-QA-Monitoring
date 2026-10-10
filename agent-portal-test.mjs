import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createAccessService} from './access-storage.mjs';import {createPayslipService} from './payslip-storage.mjs';import {createSpiffService} from './spiff-storage.mjs';
const root=await mkdtemp(join(tmpdir(),'qa-agent-'));
try{
 const access=createAccessService(join(root,'access')),payslips=createPayslipService(join(root,'payslips')),spiffs=createSpiffService(join(root,'spiffs'));
 const env={SUPER_ADMIN:'JasonS',TURNSTILE_ENABLED:'false',APP_ACCESS:{fetch:(u,i)=>access(new Request(u,i))},PAYSLIPS:{fetch:(u,i)=>payslips(new Request(u,i))},SPIFFS:{fetch:(u,i)=>spiffs(new Request(u,i))}};
 let authValid=true,reportAvailable=true,authChecks=0,requestedAgent;
 const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,ReadableStream,crypto,btoa,atob,fetch:async(u,i)=>{const url=new URL(u);if(url.pathname==='/agc/conf_exten_check.php'){authChecks++;assert.equal(i.method,'POST');const body=new URLSearchParams(i.body);assert.equal(body.get('user'),'AgentOne');assert.equal(body.has('server_ip'),false);assert.equal(body.has('session_name'),false);assert.equal(body.has('ACTION'),false);return new Response(authValid?'Invalid server_ip:  or Invalid session_name: \n':'Invalid Username/Password: |AgentOne|secret|BAD|');}if(url.pathname.startsWith('/RECORDINGS/'))return new Response(new Uint8Array([73,68,51,0]));requestedAgent=url.searchParams.get('u');return new Response(reportAvailable?'Agent Recordings':'Denied');}});
 vm.runInContext(fs.readFileSync('dist/server/index.js','utf8').replace('export default {','globalThis.worker={'),context);
 context.parseRecordings=async()=>({recordings:[{lead:'1',customer:'Own invalid',status:'XFER',time:'10 AM',notes:'[QA: invalid] Wrong transfer',audio:'/RECORDINGS/MP3/own.mp3'},{lead:'2',status:'XFER',notes:'[QA: valid] prior invalid note',audio:'/RECORDINGS/MP3/valid.mp3'},{lead:'3',status:'XFER',notes:'[QA: not sure]',audio:'/RECORDINGS/MP3/unsure.mp3'},{lead:'4',status:'SALE',notes:'invalid',audio:'/RECORDINGS/MP3/sale.mp3'}]});
 const seed=(token,username)=>vm.runInContext(`sessions.set(${JSON.stringify(token)},{username:${JSON.stringify(username)},auth:'Basic synthetic',expires:Date.now()+60000})`,context);
 const send=(path,token,method='GET',data)=>context.worker.fetch(new Request('https://test.invalid'+path,{method,headers:{Cookie:'vici_qa_session='+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
 seed('admin','JasonS');
 assert.equal((await send('/api/access','admin','POST',{username:'AgentOne',role:'superadmin',enabled:true,permissions:['own_payslips']})).status,400);
 assert.equal((await send('/api/access','admin','POST',{username:'AgentOne',role:'agent',enabled:true,permissions:['payroll']})).status,400);
 assert.equal((await send('/api/access','admin','POST',{username:'AgentOne',role:'agent',enabled:true,permissions:['own_transfers','own_payslips','own_spiffs']})).status,200);
 const login=()=>send('/api/login','', 'POST',{username:'AgentOne',password:'secret',date:'2026-10-10'});
 authValid=false;assert.equal((await login()).status,401);authValid=true;const logged=await login();assert.equal(logged.status,200);assert.equal((await logged.json()).role,'agent');assert.equal(authChecks,2);const token=logged.headers.get('Set-Cookie').split(';')[0].split('=')[1];
 for(const path of ['/api/access','/api/recordings?u=SomeoneElse&q=2026-10-10','/api/audio?path=/RECORDINGS/MP3/own.mp3','/api/agents?date=2026-10-10','/api/activity?u=AgentOne&q=2026-10-10','/api/spiffs','/api/payslips','/api/history'])assert.equal((await send(path,token)).status,403,path);
 assert.equal((await send('/api/notes',token,'POST',{})).status,403);assert.equal((await send('/api/agent/spiffs',token,'POST',{})).status,405);
 assert.equal((await send('/api/agent/transfers?date=2026-10-10&u=Other',token)).status,200);assert.equal(requestedAgent,'AgentOne','caller cannot select someone else');
 const transfers=await(await send('/api/agent/transfers?date=2026-10-10',token)).json();assert.deepEqual(transfers.recordings.map(r=>r.lead),['1']);
 assert.equal((await send('/api/agent/audio?date=2026-10-10&path=/RECORDINGS/MP3/valid.mp3',token)).status,403);assert.equal((await send('/api/agent/audio?date=2026-10-10&path=/RECORDINGS/MP3/own.mp3',token)).status,200);
 reportAvailable=false;assert.equal((await send('/api/agent/transfers?date=2026-10-10',token)).status,502);reportAvailable=true;
 const snapshot={cutoff:{agent:'AgentOne',name:'Agent One',start:'2026-10-05',end:'2026-10-10',days:[]},currency:'PHP'};
 const saved=await(await send('/api/payslips','admin','POST',snapshot)).json();assert.equal((await(await send('/api/agent/payslips',token)).json()).entries.length,0,'unpublished stays private');
 assert.equal((await send('/api/payslips?publish=1&id='+saved.id,'admin','POST')).status,200);
 assert.equal((await(await send('/api/agent/payslips',token)).json()).entries.length,1);assert.equal((await send('/api/agent/payslips?id='+saved.id,token)).status,200);
 const other=await(await send('/api/payslips','admin','POST',{...snapshot,cutoff:{...snapshot.cutoff,agent:'SomeoneElse'}})).json();await send('/api/payslips?publish=1&id='+other.id,'admin','POST');assert.equal((await send('/api/agent/payslips?id='+other.id,token)).status,404);assert.equal((await send('/api/agent/payslips?id=../bad',token)).status,400);
 assert.equal((await send('/api/agent/payslips',token,'DELETE')).status,405);await send('/api/payslips?id='+saved.id,'admin','DELETE');assert.equal((await send('/api/agent/payslips?id='+saved.id,token)).status,404,'delete withdraws published snapshot');
 await mkdir(join(root,'spiffs'));await writeFile(join(root,'spiffs','spiffs.json'),JSON.stringify({access:['secretSupervisor'],audit:[{secret:'secretAudit'}],rules:[{winner:'Other'}],weeks:[{monday:'2026-10-05',end:'2026-10-10',createdAt:'today',rules:[{secret:'private'}],rows:[{username:'agentone',earned:200,eligibility:'eligible',reason:'',days:[{date:'2026-10-05',name:'Transfer reward',amount:200,validCount:4,secret:'hidden'}],payments:[{amount:50,date:'2026-10-10',reference:'private bank ref'}]},{username:'other',earned:999,eligibility:'eligible',days:[],payments:[]}]}]}));
 const ownSpiffs=await(await send('/api/agent/spiffs',token)).json();assert.equal(ownSpiffs.weeks.length,1);assert.equal(ownSpiffs.weeks[0].earned,200);assert.equal(ownSpiffs.weeks[0].balance.balance,150);assert.doesNotMatch(JSON.stringify(ownSpiffs),/secret|private|999|other|reference/i);
 await send('/api/access','admin','POST',{username:'AgentOne',role:'agent',enabled:true,permissions:['own_payslips']});assert.equal((await send('/api/agent/spiffs',token)).status,401,'access change signs agent out');seed('limited','AgentOne');assert.equal((await send('/api/agent/spiffs','limited')).status,403);
 vm.runInContext("sessions.delete('admin')",context);seed('agent','AgentOne');await send('/api/access','admin','GET');
 assert.equal((await send('/api/agent/payslips','')).status,401);
 console.log('PASS: agent credential validation without phone actions, role/section isolation, read-only APIs, own invalid audio ownership, published payslip isolation/withdrawal, private Spiff projection and session revocation.');
}finally{await rm(root,{recursive:true,force:true});}

