import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,Response} from 'miniflare';
const row=(id,path='/RECORDINGS/MP3/example-all.mp3')=>`<tr><form></form><td><a>${id}</a></td><td>12:54 PM</td><td>EXAMPLE &amp; CUSTOMER</td><td>A</td><td>194</td><td>AGENT</td><td>INS</td><td><div style="display:none"><b>Customer:</b> Hidden detail <textarea>Review &amp; follow up</textarea><audio src="${path}" preload="auto" controls></audio></div><a href="#">Play</a></td><td></td></tr>`;
const fixture='<html><head><title>Example Agent</title></head><body>Agent Recordings<table><tr><td colspan="9">OUTBOUND</td></tr>'+Array.from({length:1200},(_,i)=>row(10000+i)).join('')+row(99,'https://untrusted.example/audio.mp3')+'</table></body></html>';
let calls=[], saveMode='redirect';
const mf=new Miniflare({bindings:{TURNSTILE_ENABLED:"false"},modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',outboundService:async request=>{if(new URL(request.url).pathname.includes('AgentDaily'))return new Response('QA Report ALL XFER');calls.push(new URL(request.url));assert.equal(new URL(request.url).origin,'https://myvici.info');assert.equal(request.headers.get('Authorization'),'Basic dGVzdDp0ZXN0');if(request.url.includes('/admin/updateQA.php')){if(saveMode==='reject')return new Response('Access denied',{status:403});if(saveMode==='unknown')return new Response('Unrecognized response',{headers:{'Content-Type':'text/html'}});return new Response(null,{status:303,headers:{Location:'/admin/agentRecordingsLessThan30.php?u=lnacional&q=2026-10-05'}});}if(request.url.includes('/RECORDINGS/'))return new Response(new Uint8Array([73,68,51]),{headers:{'Content-Type':'application/forcedownload'}});return new Response(fixture,{headers:{'Content-Type':'text/html'}});}});
const login=await mf.dispatchFetch('http://localhost/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',password:'test',date:'2026-10-05'})});assert.equal(login.status,200);const headers={Cookie:login.headers.get('Set-Cookie').split(';')[0]};
try{
 const page=await mf.dispatchFetch('http://localhost/');assert.equal(page.status,200);const html=await page.text();const players=html.match(/<audio\b[^>]*>/g)||[];assert.equal(players.length,2,'one shared player per supervisor/agent workspace');assert.deepEqual(players.map(tag=>tag.match(/\bid="([^"]+)"/)[1]).sort(),['agent-audio','player']);for(const tag of players){assert.match(tag,/preload="none"/,'audio must load only on demand');assert.doesNotMatch(tag,/\ssrc=/,'no recording URLs embedded in the page');}
 assert.equal((await mf.dispatchFetch('http://localhost/api/recordings?u=lnacional&q=2026-10-05')).status,401);
 assert.equal((await mf.dispatchFetch('http://localhost/api/recordings?u=lnacional&q=2026-02-30',{headers})).status,400);
 assert.equal((await mf.dispatchFetch('http://localhost/api/audio?path=https://bad.example/x.mp3',{headers})).status,400);
 assert.equal((await mf.dispatchFetch('http://localhost/api/audio?path=/RECORDINGS/MP3/../secret.mp3',{headers})).status,400);
 assert.equal((await mf.dispatchFetch('http://localhost/api/recordings?u=lnacional&q=2026-10-05',{headers:{...headers,Origin:'https://bad.example'}})).status,403);
 assert.equal(calls.length,0);
 const response=await mf.dispatchFetch('http://localhost/api/recordings?u=lnacional&q=2026-10-05',{headers});assert.equal(response.status,200);const data=await response.json();assert.equal(data.agent,'Example Agent');assert.equal(data.recordings.length,1200);assert.deepEqual(data.recordings[0],{lead:'10000',time:'12:54 PM',customer:'EXAMPLE & CUSTOMER',status:'A',seconds:194,hangup:'AGENT',campaign:'INS',audio:'/RECORDINGS/MP3/example-all.mp3',notes:'Review & follow up'});assert.equal(calls.length,1);assert.equal(calls[0].pathname,'/admin/agentRecordingsLessThan30.php');
 const audio=await mf.dispatchFetch('http://localhost/api/audio?path=/RECORDINGS/MP3/example-all.mp3',{headers});assert.equal(audio.status,200);assert.equal(audio.headers.get('Cache-Control'),'no-store');assert.equal((await audio.arrayBuffer()).byteLength,3);assert.equal(calls.length,2);
 const note={lead:'10000',audio:'/RECORDINGS/MP3/example-all.mp3',agent:'lnacional',date:'2026-10-05',notes:'Line one & + ? "quoted"\n第二行'};
 const sendNote=data=>mf.dispatchFetch('http://localhost/api/notes',{method:'POST',headers:{...headers,'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify(data)});
 assert.equal((await mf.dispatchFetch('http://localhost/api/notes',{headers})).status,405);
 assert.equal((await sendNote({...note,lead:'10000&status=QA'})).status,400);
 assert.equal((await sendNote({...note,audio:'https://other.example/x.mp3'})).status,400);
 assert.equal(calls.length,2);
 const saved=await sendNote(note);assert.equal(saved.status,200);assert.equal((await saved.json()).saved,true);assert.equal(calls.length,3);assert.equal(calls[2].pathname,'/admin/updateQA.php');assert.deepEqual(Object.fromEntries(calls[2].searchParams),{lead_id:'10000',user:'lnacional',location:'',filename:'example',searchdate:'2026-10-05',notes:note.notes});
 saveMode='reject';assert.equal((await sendNote(note)).status,401);
 saveMode='unknown';assert.equal((await (await sendNote(note)).json()).saved,false);
 assert.equal(calls.filter(c=>c.pathname.includes('agentRecordings')).length,2);
 console.log('PASS: 1,200-row parser, on-demand MP3, authenticated AJAX QA save, exact legacy fields, Unicode notes, rejected saves, and no list reload after saving.');
}finally{await mf.dispose();}
