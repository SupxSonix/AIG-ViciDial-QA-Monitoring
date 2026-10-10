import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createAccessService} from './access-storage.mjs';
const directory=await mkdtemp(join(tmpdir(),'qa-access-'));
try{
 let service=createAccessService(directory),env={SUPER_ADMIN:'JasonS',APP_ACCESS:{fetch:(url,init)=>service(new Request(url,init))},TURNSTILE_ENABLED:'false'};
 let upstreamCalls=0;
 const c=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,ReadableStream,crypto,btoa,atob,fetch:async()=>{upstreamCalls++;return new Response('QA Report ALL XFER Agent Recordings');}});
 vm.runInContext(fs.readFileSync('dist/server/index.js','utf8').replace('export default {','globalThis.worker={'),c);
 const seed=(token,username)=>vm.runInContext(`sessions.set(${JSON.stringify(token)},{username:${JSON.stringify(username)},auth:'Basic synthetic',expires:Date.now()+60000})`,c);
 const send=(path,token,method='GET',data)=>c.worker.fetch(new Request('https://test.invalid'+path,{method,headers:{Cookie:'vici_qa_session='+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
 const login=username=>c.worker.fetch(new Request('https://test.invalid/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'synthetic',date:'2026-10-10'})}),env);
 seed('admin','jAsOnS');seed('viewer','Reader');seed('other','Other');
 assert.equal((await send('/api/access','admin')).status,200);
 assert.equal((await send('/api/access','viewer')).status,403);
 assert.equal((await send('/api/access','', 'POST',{})).status,401);
 assert.equal((await login('unknown')).status,403,'unlisted ViciDial account cannot sign in');
 const adminLogin=await login('JasonS');assert.equal(adminLogin.status,200);assert.equal((await adminLogin.json()).role,'superadmin');
 assert.equal((await send('/api/access','admin','POST',{username:'JasonS',enabled:false,permissions:[]})).status,400,'owner cannot disable self');
 assert.equal((await send('/api/access','admin','POST',{username:'Reader',enabled:true,permissions:['superadmin']})).status,400,'cannot assign privileged role');
 assert.equal((await send('/api/access','admin','POST',{username:'Reader',enabled:true,permissions:['edit_notes']})).status,400,'notes requires a review section');
 assert.equal((await send('/api/access','admin','POST',{username:'Reader',enabled:true,permissions:['recordings']})).status,200);
 assert.equal((await send('/api/session','viewer')).status,401,'permission changes revoke sessions');seed('viewer','Reader');
 const session=await (await send('/api/session','viewer')).json();assert.equal(session.role,'regular');assert.deepEqual(session.permissions,['recordings']);
 const before=upstreamCalls;
 for(const path of ['/api/access','/api/activity?u=test&q=2026-10-10','/api/payslips','/api/live','/api/webphone','/api/spiffs','/api/review-links/responses'])assert.equal((await send(path,'viewer')).status,403,path);
 for(const path of ['/api/notes','/api/monitor','/api/review-links','/api/review-links/revoke'])assert.equal((await send(path,'viewer','POST',{})).status,403,path);
 assert.equal(upstreamCalls,before,'blocked API calls never reach ViciDial');
 c.parseRecordings=async()=>({recordings:[]});
 assert.equal((await send('/api/recordings?u=test&q=2026-10-10','viewer')).status,200,'allowed recordings still work');
 assert.equal((await send('/api/payslips?preferences=profile','viewer')).status,503,'profile reaches its storage independently of payroll');
 assert.equal((await login('READER')).status,200,'usernames are case insensitive');
 assert.equal((await send('/api/access','viewer','POST',{username:'Other',enabled:true,permissions:['payroll']})).status,403,'regular user cannot grant access');
 // Public bearer review routes remain governed by their single-use token, not app roles.
 assert.equal((await send('/api/review-links/info','','POST',{token:'synthetic'})).status,503,'guest route reaches review storage check');
 service=createAccessService(directory);
 assert.equal((await (await send('/api/session','viewer')).json()).role,'regular','storage survives service recreation');
 assert.equal((await send('/api/access','admin','POST',{username:'Reader',enabled:false,permissions:['recordings']})).status,200);
 assert.equal((await send('/api/session','viewer')).status,401);assert.equal((await login('Reader')).status,403);
 seed('stale','Reader');assert.equal((await send('/api/audio?path=/RECORDINGS/MP3/test.mp3','stale')).status,403,'disabled account blocked even with seeded stale session');
 const audit=JSON.parse(await readFile(join(directory,'users.json'),'utf8')).audit;assert.equal(audit.length,2);assert.equal(audit[1].before.enabled,true);assert.equal(audit[1].after.enabled,false);
 const matrix=[['payroll','/api/payslips'],['activity','/api/activity'],['live','/api/monitor'],['reports','/api/recordings'],['team','/api/audio'],['spiffs','/api/spiffs']];
 for(const [permission,path] of matrix){
  await send('/api/access','admin','POST',{username:'matrix',enabled:true,permissions:[permission]});seed('matrix','matrix');
  assert.equal(await c.appAccessGuard(new Request('https://test.invalid'+path,{headers:{Cookie:'vici_qa_session=matrix'}}),env),null,permission+' grants its API');
  assert.equal((await send('/api/notes','matrix','POST',{})).status,403,permission+' does not imply QA editing');
 }
 await send('/api/access','admin','POST',{username:'matrix',enabled:true,permissions:['team','edit_notes','share_reviews']});seed('matrix','matrix');
 for(const path of ['/api/notes','/api/review-links','/api/review-links/responses','/api/review-links/revoke'])assert.equal(await c.appAccessGuard(new Request('https://test.invalid'+path,{headers:{Cookie:'vici_qa_session=matrix'}}),env),null,'explicit QA action grants '+path);
 assert.equal((await c.worker.fetch(new Request('https://test.invalid/api/access',{headers:{Cookie:'vici_qa_session=matrix','X-Super-Admin':'matrix','X-App-Spiff-Access':'granted'}}),env)).status,403,'client headers cannot escalate roles');
 const broken={SUPER_ADMIN:'JasonS',APP_ACCESS:{fetch:async()=>{throw Error('offline');}}};seed('offline','Reader');assert.equal((await c.worker.fetch(new Request('https://test.invalid/api/audio?path=/RECORDINGS/MP3/test.mp3',{headers:{Cookie:'vici_qa_session=offline'}}),broken)).status,503,'fail closed on storage failure');
 const missing={SUPER_ADMIN:'JasonS'};assert.equal((await c.worker.fetch(new Request('https://test.invalid/api/session',{headers:{Cookie:'vici_qa_session=admin'}}),missing)).status,503);
 const direct=await service(new Request('http://access/',{method:'POST',headers:{'X-Actor':'reader','X-Super-Admin':'jasons'},body:JSON.stringify({username:'other',enabled:true,permissions:['recordings']})}));assert.equal(direct.status,403,'storage also enforces the trusted owner');
 // Concurrent writes retain both users and append audit entries.
 await Promise.all(['one','two'].map(username=>send('/api/access','admin','POST',{username,enabled:true,permissions:['recordings']})));
 const users=(await (await send('/api/access','admin')).json()).users;assert.ok(users.some(user=>user.username==='one')&&users.some(user=>user.username==='two'));
 console.log('PASS: Super Admin bootstrap, per-user permissions, unauthorized APIs, no self-escalation, login denial, case normalization, immediate session revocation, persistence, audit, serialized writes and storage fail-closed checks.');
}finally{await rm(directory,{recursive:true,force:true});}
