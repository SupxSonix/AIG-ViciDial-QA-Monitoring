const ACCESS_SECTIONS=[['recordings','Recordings',''],['live','Live agents','live'],['payroll','Payroll','payroll'],['activity','Agent activity','activity'],['reports','Reports','reports'],['team','Team QA','team'],['spiffs','Spiffs','spiffs']];
const ACCESS_ACTIONS=[['edit_notes','Edit QA notes'],['share_reviews','Create manager review links']];
let accountPermissions=null,accountRole='legacy',accessUsers=[],accessOwner='',accessDirectory=[],accessDirectorySequence=0;
function appCan(key){return accountPermissions===null||accountPermissions.includes(key);}
function applyAccountAccess(data){accountPermissions=Array.isArray(data.permissions)?data.permissions:null;accountRole=data.role||'legacy';}
function clearAccountAccess(){accountPermissions=[];accountRole='regular';accessUsers=[];accessOwner='';accessDirectory=[];accessDirectorySequence++;$('access-history-list')?.replaceChildren();if($('access-history'))$('access-history').open=false;if($('access-list-search'))$('access-list-search').value='';if($('access-list-status'))$('access-list-status').value='all';$('access-picker')?.replaceChildren();const dialog=$('user-access-dialog');if(dialog?.open)dialog.close();$('access-users')?.replaceChildren();if($('access-username'))$('access-username').value='';if($('open-user-access'))$('open-user-access').hidden=true;}
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
 $('access-picker').value=accessDirectory.some(item=>item.username.toLowerCase()===user?.username.toLowerCase())?accessDirectory.find(item=>item.username.toLowerCase()===user.username.toLowerCase()).username:'';
}
function renderAccessDirectory(){
 const picker=$('access-picker'),selected=picker.value,query=$('access-user-search').value.trim().toLowerCase();picker.replaceChildren(new Option('Choose an active ViciDial user…',''));
 for(const user of accessDirectory.filter(user=>[user.username,user.name].some(value=>value.toLowerCase().includes(query))))picker.append(new Option(user.name+' ('+user.username+')',user.username));
 if([...picker.options].some(option=>option.value===selected))picker.value=selected;
 picker.disabled=!accessDirectory.length;
}
async function loadAccessDirectory(){
 const sequence=++accessDirectorySequence;$('access-directory-load').disabled=true;$('access-directory-status').textContent='Loading active ViciDial users…';
 try{
  const response=await fetch('/api/access?directory=1'),data=await response.json();if(sequence!==accessDirectorySequence||accountRole!=='superadmin')return;
  if(!response.ok)throw Error(data.error);accessDirectory=data.users;renderAccessDirectory();renderAccessUsers();
  $('access-directory-status').textContent=accessDirectory.length+' active accounts loaded. Choose a user, then set permissions and save.';
 }catch(error){if(sequence===accessDirectorySequence)$('access-directory-status').textContent=error.message;}
 finally{if(sequence===accessDirectorySequence)$('access-directory-load').disabled=false;}
}
function newAccessUser(){resetAccessEditor();$('access-user-search').value='';renderAccessDirectory();$('access-status').textContent='New user entry ready. Choose a ViciDial user or enter a username below.';$('access-form').scrollIntoView({behavior:'smooth',block:'nearest'});$('access-username').focus();}
function renderAccessUsers(){
 $('access-owner').textContent='Super Admin: '+accessOwner+' · Full access';
 const host=$('access-users');host.replaceChildren();
 const query=$('access-list-search').value.trim().toLowerCase(),status=$('access-list-status').value;
 const visible=accessUsers.filter(user=>(status==='all'||user.enabled===(status==='enabled'))&&[user.username,accessDirectory.find(item=>item.username.toLowerCase()===user.username)?.name||''].some(value=>value.toLowerCase().includes(query)));
 $('access-list-count').textContent=visible.length+' shown · '+accessUsers.length+' app users';
 for(const user of visible.sort((a,b)=>a.username.localeCompare(b.username))){
  const row=document.createElement('tr');
  const names=[...ACCESS_SECTIONS,...ACCESS_ACTIONS];
  for(const value of [user.username,user.enabled?'Enabled':'Disabled',user.permissions.map(key=>names.find(item=>item[0]===key)?.[1]||key).join(', ')||'No sections']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  const cell=document.createElement('td');cell.className='access-row-actions';
  for(const [label,action] of [['Edit access',()=>resetAccessEditor(user)],[user.enabled?'Disable':'Enable',()=>changeAccessUser(user,false)],['Remove',()=>changeAccessUser(user,true)]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' for '+user.username);if(label==='Remove')button.className='access-remove';button.onclick=action;cell.append(button);}
  row.append(cell);host.append(row);
 }
 if(!visible.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent=accessUsers.length?'No app users match these filters.':'No regular users yet. Add an existing ViciDial username below.';row.append(cell);host.append(row);}
}
async function changeAccessUser(user,remove){
 if(remove&&!confirm('Remove '+user.username+' from this app? Their current sessions will be signed out. Their ViciDial account and saved payroll/review data will remain. You can add their app access again later.'))return;
 const buttons=[...$('access-users').querySelectorAll('button')];for(const button of buttons)button.disabled=true;
 $('access-status').textContent=remove?'Removing app access…':'Updating app access…';
 try{
  const body=remove?{action:'remove',username:user.username}:{username:user.username,enabled:!user.enabled,permissions:user.permissions};
  const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();
  if(accountRole!=='superadmin')return;if(!response.ok)throw Error(data.error);
  accessUsers=data.users;accessOwner=data.superAdmin;renderAccessUsers();resetAccessEditor();
  $('access-status').textContent=remove?'User removed from app access. Their ViciDial account is unchanged.':user.enabled?'User disabled and signed out.':'User enabled. They can sign in again.';
  if($('access-history').open)loadAccessHistory();
 }catch(error){$('access-status').textContent=error.message;}
 finally{for(const button of buttons)button.disabled=false;}
}
async function loadAccessHistory(){
 $('access-history-list').replaceChildren();$('access-history-status').textContent='Loading access history…';
 try{const response=await fetch('/api/access?history=1'),data=await response.json();if(accountRole!=='superadmin')return;if(!response.ok)throw Error(data.error);
  for(const event of data.audit){const item=document.createElement('p'),action=!event.after?'Removed':!event.before?'Added':event.before.enabled!==event.after.enabled?event.after.enabled?'Enabled':'Disabled':'Permissions updated';item.textContent=new Date(event.at).toLocaleString()+' · '+event.actor+' · '+action+' '+event.username;const detail=document.createElement('small');detail.textContent='Before: '+(event.before?event.before.permissions.join(', ')||'No permissions':'No app access')+' → After: '+(event.after?event.after.permissions.join(', ')||'No permissions':'No app access');item.append(document.createElement('br'),detail);$('access-history-list').append(item);}
  $('access-history-status').textContent=data.audit.length?'Latest '+data.audit.length+' changes. Full history is retained on the server.':'No access changes yet.';
 }catch(error){$('access-history-status').textContent=error.message;}
}
async function loadUserAccess(){
 $('account-menu').open=false;$('user-access-dialog').showModal();$('access-status').textContent='Loading user access…';$('access-save').disabled=true;
 try{const response=await fetch('/api/access'),data=await response.json();if(accountRole!=='superadmin')return;if(!response.ok)throw Error(data.error);accessUsers=data.users;accessOwner=data.superAdmin;renderAccessUsers();resetAccessEditor();$('access-status').textContent='';loadAccessDirectory();}
 catch(error){$('access-status').textContent=error.message;}
 finally{$('access-save').disabled=false;}
}
$('open-user-access').onclick=loadUserAccess;
$('close-user-access').onclick=()=>$('user-access-dialog').close();
$('access-new').onclick=newAccessUser;
$('access-list-search').oninput=renderAccessUsers;
$('access-list-status').onchange=renderAccessUsers;
$('access-history').ontoggle=()=>{if($('access-history').open)loadAccessHistory();};
$('access-directory-load').onclick=loadAccessDirectory;
$('access-user-search').oninput=renderAccessDirectory;
$('access-picker').onchange=()=>{const user=accessDirectory.find(user=>user.username===$('access-picker').value);if(!user)return;const saved=accessUsers.find(item=>item.username===user.username.toLowerCase());resetAccessEditor(saved);if(!saved){$('access-username').value=user.username;$('access-picker').value=user.username;}$('access-status').textContent=saved?'This user already has app access. Update the permissions below.':'Selected '+user.name+'. Choose permissions, then save access.';};
for(const [key,label] of [...ACCESS_SECTIONS,...ACCESS_ACTIONS]){
 const item=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=key;
 item.append(input,document.createTextNode(label));$('access-permissions').append(item);
}
$('access-form').onsubmit=async event=>{
 event.preventDefault();$('access-save').disabled=true;$('access-status').textContent='Saving user access…';
 try{
  const response=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('access-username').value,enabled:$('access-enabled').checked,permissions:[...$('access-permissions').querySelectorAll('input:checked')].map(input=>input.value)})});
  const data=await response.json();if(!response.ok)throw Error(data.error);accessUsers=data.users;accessOwner=data.superAdmin;renderAccessUsers();resetAccessEditor();$('access-status').textContent='Access saved. The user must sign in again to use their updated permissions.';if($('access-history').open)loadAccessHistory();
 }catch(error){$('access-status').textContent=error.message;}
 finally{$('access-save').disabled=false;}
};
