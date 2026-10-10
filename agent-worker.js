const AGENT_PERMISSIONS=['own_transfers','own_payslips','own_spiffs'];
async function verifyAgentCredentials(username,password){
 // ViciDial authenticates before checking these deliberately omitted phone-session fields.
 // This exits before any conference, phone or agent-session action can run.
 const response=await fetch(ORIGIN+'/agc/conf_exten_check.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({user:username,pass:password}).toString(),redirect:'manual',signal:AbortSignal.timeout(20000)});
 const text=await readLimited(response,20000);
 return response.ok&&/^\s*Invalid server_ip:\s*(?:or\s+)?Invalid session_name:\s*$/i.test(text);
}
function agentReportAuth(env){
 if(env.AGENT_REPORT_USER&&env.AGENT_REPORT_PASS)return 'Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(env.AGENT_REPORT_USER+':'+env.AGENT_REPORT_PASS)));
 return [...sessions.values()].find(s=>s.username.toLowerCase()===env.SUPER_ADMIN?.trim().toLowerCase()&&s.expires>Date.now())?.auth;
}
function agentInvalid(record){const text=String(record.notes||''),explicit=text.match(/^\s*\[QA:\s*(valid|invalid|not sure)\]/i);return String(record.status).toUpperCase()==='XFER'&&(explicit?explicit[1].toLowerCase()==='invalid':/\b(?:invalid|not\s+valid)\b/i.test(text));}
async function agentTransfers(session,date,env){
 if(!validDate(date))return {error:json({error:'Choose a valid recording date.'},400)};
 const auth=agentReportAuth(env);if(!auth)return {error:json({error:'The report connection is unavailable. Ask the Super Admin to sign in, or configure the server report account.'},503)};
 const result=await upstream('/admin/agentRecordingsLessThan30.php?'+new URLSearchParams({u:session.username,q:date}),auth,'text/html');if(result.error)return result;
 const html=await readLimited(result.response);if(!/Agent Recordings/i.test(html))return {error:json({error:'ViciDial did not confirm the agent report.'},502)};
 const parsed=await parseRecordings(html);return {auth,recordings:parsed.recordings.filter(agentInvalid)};
}
async function agentEndpoint(request,env){
 const session=getSession(request);if(!session)return json({error:'Sign in to view your workspace.'},401);
 const access=await accountAccess(session,env);if(access?.role!=='agent')return json({error:'Agent access required.'},403);
 const url=new URL(request.url),part=url.pathname.split('/').pop(),permission={transfers:'own_transfers',audio:'own_transfers',payslips:'own_payslips',spiffs:'own_spiffs'}[part];
 if(!permission||!access.permissions.includes(permission))return json({error:'This feature is not enabled for your account.'},403);
 if(request.method!=='GET')return json({error:'Agent access is read-only.'},405);
 if(part==='transfers'||part==='audio'){
  const data=await agentTransfers(session,url.searchParams.get('date'),env);if(data.error)return data.error;
  if(part==='transfers')return json({recordings:data.recordings.map(({lead,time,customer,status,length,notes,audio})=>({lead,time,customer,status,length,notes,audio}))});
  const path=url.searchParams.get('path');if(!audioPath(path)||!data.recordings.some(r=>r.audio===path))return json({error:'This recording is not available to your account.'},403);
  const audio=await upstream(path,data.auth,'audio/mpeg');if(audio.error)return audio.error;if(Number(audio.response.headers.get('Content-Length')||0)>40000000)return json({error:'This recording is too large for the viewer.'},413);return verifiedAudio(audio.response);
 }
 if(part==='payslips'){
  if(!env.PAYSLIPS)return json({error:'Payslip storage is unavailable.'},503);
  const target=new URL('http://payslips/?agent=1');if(url.searchParams.has('id'))target.searchParams.set('id',url.searchParams.get('id'));
  const response=await env.PAYSLIPS.fetch(target.href,{headers:{'X-Reviewer':session.username,'X-Agent-Read':'1'}});return json(await response.json(),response.status);
 }
 if(!env.SPIFFS)return json({error:'Spiff storage is unavailable.'},503);
 const response=await env.SPIFFS.fetch('http://spiffs/',{headers:{'X-Reviewer':session.username.toLowerCase(),'X-Spiff-Admin':env.SUPER_ADMIN.trim().toLowerCase(),'X-Agent-Read':'1'}});return json(await response.json(),response.status);
}
