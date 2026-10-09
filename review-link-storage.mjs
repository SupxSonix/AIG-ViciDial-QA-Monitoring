import {mkdir,readFile,writeFile,readdir,rename,unlink} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {join} from 'node:path';
export function createReviewLinkService(directory,ResponseType=Response){
 let writes=Promise.resolve();const reply=(body,status=200)=>new ResponseType(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const key=token=>createHash('sha256').update(token).digest('hex');
 const load=async token=>{if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return null;try{return JSON.parse(await readFile(join(directory,key(token)+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const persist=async entry=>{const path=join(directory,entry.id+'.json'),temporary=path+'.tmp';await writeFile(temporary,JSON.stringify(entry),{mode:0o600});await rename(temporary,path);};
 const cleanup=async()=>{let names;try{names=await readdir(directory);}catch{return;}for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){const entry=JSON.parse(await readFile(join(directory,name),'utf8'));if(Date.now()>entry.createdAt+30*86400000){await unlink(join(directory,name));await unlink(join(directory,entry.id+'.mp3')).catch(()=>{});}}};
 return async request=>{try{const url=new URL(request.url),owner=request.headers.get('X-Reviewer')?.toLowerCase();
 if(url.pathname==='/create'&&request.method==='POST'){
 if(!owner)return reply({error:'Sign in first.'},401);const form=await request.formData(),rawMetadata=form.get('recording'),file=form.get('audio');if(typeof rawMetadata!=='string'||rawMetadata.length>12000||!file||typeof file.arrayBuffer!=='function')return reply({error:'Invalid recording.'},400);const metadata=JSON.parse(rawMetadata);const audio=new Uint8Array(await file.arrayBuffer());
 if(!/^\d{1,15}$/.test(metadata.lead||'')||!/^\/RECORDINGS\/MP3\/[A-Za-z0-9_.-]+\.mp3$/.test(metadata.audio||'')||audio.length<3||audio.length>40000000)return reply({error:'Invalid recording.'},400);
 const token=randomBytes(32).toString('base64url'),id=key(token),entry={id,owner,recording:metadata,createdAt:Date.now(),expiresAt:Date.now()+86400000,response:null};
 const task=writes.catch(()=>{}).then(async()=>{await mkdir(directory,{recursive:true,mode:0o700});await cleanup();await writeFile(join(directory,id+'.mp3'),audio,{mode:0o600,flag:'wx'});await persist(entry);});writes=task;await task;return reply({token,expiresAt:entry.expiresAt},201);
 }
 if(url.pathname==='/responses'&&request.method==='GET'){if(!owner)return reply({error:'Sign in first.'},401);await writes.catch(()=>{});let names;try{names=await readdir(directory);}catch(error){if(error.code==='ENOENT')names=[];else throw error;}const responses=[];for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){const entry=JSON.parse(await readFile(join(directory,name),'utf8'));if(entry.owner===owner&&entry.response&&['lead','audio','agent','date'].every(field=>entry.recording[field]===url.searchParams.get(field)))responses.push({id:entry.id,...entry.response});}return reply({responses:responses.sort((a,b)=>b.submittedAt-a.submittedAt)});}
 if(request.method!=='POST')return reply({error:'Use POST.'},405);const raw=await request.text();if(raw.length>12000)return reply({error:'Response is too long.'},413);const body=JSON.parse(raw);
 if(url.pathname==='/revoke'){if(!owner)return reply({error:'Sign in first.'},401);let result;const task=writes.catch(()=>{}).then(async()=>{const entry=await load(body.token);if(!entry||entry.owner!==owner){result=reply({error:'Link not found.'},404);return;}entry.expiresAt=0;await persist(entry);result=reply({revoked:true});});writes=task;await task;return result;}
 if(url.pathname==='/submit'){
 const name=typeof body.name==='string'?body.name.trim().replace(/\s+/g,' '):'';if(!name||name.length>100||!['valid','invalid','unsure'].includes(body.verdict)||typeof body.notes!=='string'||body.notes.length>3000)return reply({error:'Enter your name, choose a response, and keep notes under 3,000 characters.'},400);
 let result;const task=writes.catch(()=>{}).then(async()=>{const entry=await load(body.token);if(!entry||entry.expiresAt<=Date.now()||entry.response){result=reply({error:'This review link has expired or was already submitted.'},410);return;}entry.response={name,verdict:body.verdict,notes:body.notes,submittedAt:Date.now()};await persist(entry);result=reply({submitted:true});});writes=task;await task;return result;
 }
 await writes.catch(()=>{});const entry=await load(body.token);if(!entry||entry.expiresAt<=Date.now()||entry.response)return reply({error:'This review link has expired or was already submitted.'},410);
 if(url.pathname==='/info')return reply({recording:entry.recording,expiresAt:entry.expiresAt});
 if(url.pathname==='/audio')return new ResponseType(await readFile(join(directory,entry.id+'.mp3')),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 return reply({error:'Not found.'},404);
 }catch{return reply({error:'Review link storage is unavailable.'},503);}};
}
