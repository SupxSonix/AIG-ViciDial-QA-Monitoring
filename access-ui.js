const ACCESS_SECTIONS=[['recordings','Recordings',''],['live','Live agents','live'],['payroll','Payroll','payroll'],['activity','Agent activity','activity'],['reports','Reports','reports'],['team','Team QA','team'],['spiffs','Spiffs','spiffs']];
const ACCESS_ACTIONS=[['edit_notes','Edit QA notes'],['share_reviews','Create manager review links']];
let accountPermissions=null,accountRole='legacy',accessUsers=[],accessOwner='';
function appCan(key){return accountPermissions===null||accountPermissions.includes(key);}
function applyAccountAccess(data){accountPermissions=Array.isArray(data.permissions)?data.permissions:null;accountRole=data.role||'legacy';}
function clearAccountAccess(){accountPermissions=[];accountRole='regular';accessUsers=[];accessOwner='';const dialog=$('user-access-dialog');if(dialog?.open)dialog.close();$('access-users')?.replaceChildren();if($('access-username'))$('access-username').value='';if($('open-user-access'))$('open-user-access').hidden=true;}
function applyAccessLanding(){
 const ids={recordings:'nav-recordings',live:'open-live',payroll:'open-payroll',activity:'open-activity',reports:'open-reports',team:'open-team',spiffs:'open-spiffs'};
 for(const [key] of ACCESS_SECTIONS)$(ids[key]).hidden=!appCan(key);
 $('open-user-access').hidden=accountRole!=='superadmin';$('account-role').textContent=accountRole==='superadmin'?'Super Admin':accountRole==='regular'?'Regular user':'';
 const current=ACCESS_SECTIONS.find(([, ,path])=>path&&new RegExp('/'+path+'/?$').test(location.pathname))?.[0]||'recordings';
 if(!appCan(current)){
  const first=ACCESS_SECTIONS.find(([key])=>appCan(key));
  if(first){location.replace(viewerBase+first[2]);return false;}
  $('login-status').textContent='Your account has no enabled sections. Contact the Super Admin.';showLogin();return false;
 }
 $('edit-playing-notes').hidden=!appCan('edit_notes')&&!appCan('share_reviews');
 $('review-next').hidden=!appCan('edit_notes');
 return true;
}
function applyNoteAccess(){
 const writable=appCan('edit_notes');
 $('notes-text').readOnly=!writable;$('verdict-controls').hidden=!writable||String(editing?.status).toUpperCase()!=='XFER';
 $('save-notes').hidden=!writable;$('save-next').hidden=!writable||!reviewing;
 $('invalid-reason-label').hidden=!writable||noteVerdict(editing?.notes)!=='invalid';
 $('unsure-reason-label').hidden=!writable||noteVerdict(editing?.notes)!=='unsure';
 $('manager-review').hidden=!appCan('share_reviews');
}
function resetAccessEditor(user=null){
 $('access-username').value=user?.username||'';$('access-username').readOnly=!!user;
 $('access-enabled').checked=user?.enabled??true;
 for(const input of $('access-permissions').querySelectorAll('input'))input.checked=(user?.permissions||['recordings']).includes(input.value);
 $('access-editor-title').textContent=user?'Edit user access':'Add a regular user';
}
function renderAccessUsers(){
 $('access-owner').textContent='Super Admin: '+accessOwner+' · Full access';
 const host=$('access-users');host.replaceChildren();
 for(const user of [...accessUsers].sort((a,b)=>a.username.localeCompare(b.username))){
  const row=document.createElement('tr');
  const names=[...ACCESS_SECTIONS,...ACCESS_ACTIONS];
  for(const value of [user.username,user.enabled?'Enabled':'Disabled',user.permissions.map(key=>names.find(item=>item[0]===key)?.[1]||key).join(', ')||'No sections']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  const cell=document.createElement('td'),edit=document.createElement('button');edit.type='button';edit.textContent='Edit access';edit.setAttribute('aria-label','Edit access for '+user.username);edit.onclick=()=>resetAccessEditor(user);cell.append(edit);row.append(cell);host.append(row);
 }
 if(!accessUsers.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='No regular users yet. Add an existing ViciDial username below.';row.append(cell);host.append(row);}
}
async function loadUserAccess(){
 $('account-menu').open=false;$('user-access-dialog').showModal();$('access-status').textContent='Loading user access…';$('access-save').disabled=true;
 try{const response=await fetch('/api/access'),data=await response.json();if(accountRole!=='superadmin')return;if(!response.ok)throw Error(data.error);accessUsers=data.users;accessOwner=data.superAdmin;renderAccessUsers();resetAccessEditor();$('access-status').textContent='';}
 catch(error){$('access-status').textContent=error.message;}
 finally{$('access-save').disabled=false;}
}
$('open-user-access').onclick=loadUserAccess;
$('close-user-access').onclick=()=>$('user-access-dialog').close();
$('access-new').onclick=()=>resetAccessEditor();
for(const [key,label] of [...ACCESS_SECTIONS,...ACCESS_ACTIONS]){
 const item=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=key;
 item.append(input,document.createTextNode(label));$('access-permissions').append(item);
}
$('access-form').onsubmit=async event=>{
 event.preventDefault();$('access-save').disabled=true;$('access-status').textContent='Saving user access…';
 try{
  const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('access-username').value,enabled:$('access-enabled').checked,permissions:[...$('access-permissions').querySelectorAll('input:checked')].map(input=>input.value)})});
  const data=await response.json();if(!response.ok)throw Error(data.error);accessUsers=data.users;accessOwner=data.superAdmin;renderAccessUsers();resetAccessEditor();$('access-status').textContent='Access saved. The user must sign in again to use their updated permissions.';
 }catch(error){$('access-status').textContent=error.message;}
 finally{$('access-save').disabled=false;}
};
