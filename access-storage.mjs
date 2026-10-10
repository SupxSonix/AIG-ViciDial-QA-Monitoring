import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const permissions=['recordings','live','payroll','activity','reports','team','spiffs','edit_notes','share_reviews'];
export function createAccessService(directory,ResponseType=Response){
 let writes=Promise.resolve();
 const path=join(directory,'users.json');
 async function load(){try{const state=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(state.users)||!Array.isArray(state.audit))throw Error('Invalid access storage.');return state;}catch(error){if(error.code==='ENOENT')return {users:[],audit:[]};throw error;}}
 return async request=>{
  const reply=(data,status=200)=>new ResponseType(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  try{
   const actor=(request.headers.get('X-Actor')||'').toLowerCase(),owner=(request.headers.get('X-Super-Admin')||'').toLowerCase();
   if(!actor||!owner)return reply({error:'Missing access identity.'},403);
   const lookup=new URL(request.url).searchParams.get('username');
   if(request.method==='GET'){
    await writes.catch(()=>{});const state=await load();
    if(lookup){if(actor!==owner&&lookup.toLowerCase()!==actor)return reply({error:'Access denied.'},403);return reply({user:state.users.find(user=>user.username===lookup.toLowerCase())||null});}
    if(actor!==owner)return reply({error:'Super Admin access required.'},403);
    return reply({users:state.users,superAdmin:owner});
   }
   if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
   if(actor!==owner)return reply({error:'Super Admin access required.'},403);
   const raw=await request.text();if(raw.length>6000)return reply({error:'Access request is too large.'},413);
   const data=JSON.parse(raw),username=typeof data.username==='string'?data.username.trim().toLowerCase():'';
   if(!/^[a-z0-9_.-]{1,64}$/.test(username)||username===owner||typeof data.enabled!=='boolean'||!Array.isArray(data.permissions)||data.permissions.length>permissions.length||new Set(data.permissions).size!==data.permissions.length||!data.permissions.every(value=>permissions.includes(value)))return reply({error:'Invalid user or permissions. The Super Admin account cannot be changed here.'},400);
   const viewers=['recordings','reports','team'];
   if(data.enabled&&!data.permissions.some(value=>permissions.slice(0,7).includes(value)))return reply({error:'Select at least one section for an enabled user.'},400);
   if(data.permissions.some(value=>['edit_notes','share_reviews'].includes(value))&&!data.permissions.some(value=>viewers.includes(value)))return reply({error:'QA actions require Recordings, Reports, or Team QA access.'},400);
   const task=writes.catch(()=>{}).then(async()=>{
    const state=await load(),index=state.users.findIndex(user=>user.username===username);
    if(index<0&&state.users.length>=500)throw Error('User limit reached.');
    const before=index<0?null:state.users[index],user={username,enabled:data.enabled,permissions:[...data.permissions],updatedAt:new Date().toISOString(),updatedBy:actor};
    if(index<0)state.users.push(user);else state.users[index]=user;
    state.audit.push({id:randomUUID(),at:user.updatedAt,actor,username,before,after:user});
    await mkdir(directory,{recursive:true,mode:0o700});const temporary=path+'.'+randomUUID()+'.tmp';
    await writeFile(temporary,JSON.stringify(state),{mode:0o600});await rename(temporary,path);
    return {users:state.users,superAdmin:owner};
   });writes=task;return reply(await task);
  }catch{return reply({error:'User access could not be loaded or saved.'},503);}
 };
}
