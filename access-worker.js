const APP_PERMISSIONS=['recordings','live','payroll','activity','reports','team','spiffs','edit_notes','share_reviews'];
function accessEnabled(env){return !!env?.SUPER_ADMIN;}
async function accountAccess(session,env){
 if(!accessEnabled(env))return {role:'legacy',permissions:[...APP_PERMISSIONS]};
 if(!env.APP_ACCESS)throw Error('User access storage is not configured.');
 const owner=env.SUPER_ADMIN.trim().toLowerCase(),actor=session.username.toLowerCase();
 if(!/^[a-z0-9_.-]{1,64}$/.test(owner))throw Error('Invalid Super Admin configuration.');
 if(actor===owner)return {role:'superadmin',permissions:[...APP_PERMISSIONS]};
 const response=await env.APP_ACCESS.fetch('http://access/?'+new URLSearchParams({username:actor}),{headers:{'X-Actor':actor,'X-Super-Admin':owner}});
 if(!response.ok)throw Error('User access storage is unavailable.');
 const {user}=await response.json();
 if(!user?.enabled)return null;
 if(!Array.isArray(user.permissions)||!user.permissions.every(key=>APP_PERMISSIONS.includes(key)))throw Error('Invalid user access.');
 return {role:'regular',permissions:user.permissions};
}
function requiredAppPermissions(url){
 const path=url.pathname;
 if(path==='/api/access')return ['superadmin'];
 if(path==='/api/payslips')return url.searchParams.get('preferences')==='profile'?[]:['payroll'];
 if(path==='/api/agents')return ['recordings','reports','team','activity','payroll','spiffs'];
 if(['/api/recordings','/api/audio','/api/history'].includes(path))return ['recordings','reports','team'];
 if(path==='/api/notes')return ['edit_notes'];
 if(['/api/live','/api/monitor','/api/webphone'].includes(path))return ['live'];
 if(path==='/api/activity')return ['activity','payroll'];
 if(path==='/api/spiffs')return ['spiffs'];
 if(path==='/api/review-links'||['/api/review-links/responses','/api/review-links/revoke'].includes(path))return ['share_reviews'];
 return null;
}
async function appAccessGuard(request,env){
 if(!accessEnabled(env))return null;
 const required=requiredAppPermissions(new URL(request.url));if(required===null)return null;
 const session=getSession(request);if(!session)return json({error:'Sign in to use this section.'},401);
 try{
  const access=await accountAccess(session,env);
  if(!access||(!required.includes('superadmin')&&required.length&&!required.some(key=>access.permissions.includes(key)))||(required.includes('superadmin')&&access.role!=='superadmin'))return json({error:'Your account does not have access to this feature. Contact the Super Admin.'},403);
  if(required.some(key=>['edit_notes','share_reviews'].includes(key))&&!access.permissions.some(key=>['recordings','reports','team'].includes(key)))return json({error:'Call review access is required.'},403);
  return null;
 }catch{return json({error:'User access could not be verified. Contact the server administrator.'},503);}
}
async function accessEndpoint(request,env){
 if(!accessEnabled(env)||!env.APP_ACCESS)return json({error:'Configure SUPER_ADMIN and user access storage first.'},503);
 const session=getSession(request);if(!session)return json({error:'Sign in first.'},401);
 if(session.username.toLowerCase()!==env.SUPER_ADMIN.trim().toLowerCase())return json({error:'Super Admin access required.'},403);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(request.method==='POST'&&!(request.headers.get('Content-Type')||'').startsWith('application/json'))return json({error:'Send JSON.'},415);
 const raw=request.method==='POST'?await request.text():undefined;
 if(raw&&raw.length>6000)return json({error:'Access request is too large.'},413);
 const response=await env.APP_ACCESS.fetch('http://access/',{method:request.method,headers:{'X-Actor':session.username,'X-Super-Admin':env.SUPER_ADMIN.trim()},body:raw});
 const data=await response.json();
 if(response.ok&&request.method==='POST'){
  // Revoke existing sessions after any permission change. A new login uses the new access.
  const target=JSON.parse(raw).username.trim().toLowerCase();
  for(const [token,user] of sessions)if(user.username.toLowerCase()===target){noteSnapshots.delete(user);sessions.delete(token);}
 }
 return json(data,response.status);
}
