import {mkdir,appendFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export function createHistoryService(directory,ResponseType=Response){
 let writes=Promise.resolve();
 const file=data=>join(directory,createHash('sha256').update(JSON.stringify([data.agent,data.date,data.lead,data.audio])).digest('hex')+'.jsonl');
 return async request=>{
 try{const url=new URL(request.url);if(request.method==='POST'){
 const event=await request.json();if(!event||typeof event.agent!=='string'||typeof event.date!=='string'||typeof event.lead!=='string'||typeof event.audio!=='string'||typeof event.reviewer!=='string'||typeof event.notes!=='string'||event.notes.length>4000)return new ResponseType('Invalid history event',{status:400});
 const entry={...event,timestamp:new Date().toISOString()};const write=writes.catch(()=>{}).then(async()=>{await mkdir(directory,{recursive:true,mode:0o700});await appendFile(file(entry),JSON.stringify(entry)+'\n',{encoding:'utf8',mode:0o600});});writes=write;await write;return new ResponseType(JSON.stringify({stored:true}),{headers:{'Content-Type':'application/json'}});
 }if(request.method==='GET'){const query=Object.fromEntries(url.searchParams);await writes.catch(()=>{});let contents;try{contents=await readFile(file(query),'utf8');}catch(error){if(error.code==='ENOENT')contents='';else throw error;}const events=contents.split('\n').filter(Boolean).map(line=>JSON.parse(line)).slice(-100).reverse();return new ResponseType(JSON.stringify({events}),{headers:{'Content-Type':'application/json'}});}return new ResponseType('Method not allowed',{status:405});
 }catch{return new ResponseType(JSON.stringify({error:'Review history storage is unavailable.'}),{status:503,headers:{'Content-Type':'application/json'}});}
 };
}
