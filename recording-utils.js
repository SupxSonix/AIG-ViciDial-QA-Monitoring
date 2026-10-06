function noteVerdict(notes){const text=String(notes||'');const explicit=text.match(/^\s*\[QA:\s*(valid|invalid|not sure)\]/i);if(explicit)return explicit[1].toLowerCase().replace('not sure','unsure');if(/\bnot\s+sure\b/i.test(text))return 'unsure';if(/\binvalid\b|\bnot\s+valid\b/i.test(text))return 'invalid';if(/\bvalid\b/i.test(text))return 'valid';return 'unreviewed';}
function timeValue(time){const m=String(time||'').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);if(!m)return null;let h=Number(m[1]),min=Number(m[2]),sec=Number(m[3]||0);if(min>59||sec>59)return null;if(m[4]){if(h<1||h>12)return null;h=h%12+(m[4].toUpperCase()==='PM'?12:0);}else if(h>23)return null;return h*3600+min*60+sec;}
function selectRecordings(records,query='',status='',sort='original',review='all'){const q=query.toLowerCase().trim();const rows=records.filter(r=>(review!=='unsure'||(String(r.status).toUpperCase()==='XFER'&&noteVerdict(r.notes)==='unsure'))&&(review!=='unreviewed'||(String(r.status).toUpperCase()==='XFER'&&noteVerdict(r.notes)==='unreviewed'))&&(!status||r.status===status)&&[r.customer,r.lead,r.status,r.time,r.hangup,r.campaign,r.notes].some(v=>String(v||'').toLowerCase().includes(q)));if(sort!=='original')rows.sort((a,b)=>{const x=timeValue(a.time),y=timeValue(b.time);if(x===null)return y===null?0:1;if(y===null)return -1;return sort==='latest'?y-x:x-y;});return rows;}
function transferCounts(records){const counts={total:0,valid:0,invalid:0,unsure:0,unreviewed:0};for(const r of records)if(String(r.status).toUpperCase()==='XFER'){counts.total++;counts[noteVerdict(r.notes)]++;}return counts;}

function setNoteVerdict(notes,verdict){if(!['valid','invalid','unsure'].includes(verdict))throw new Error('Choose valid or invalid.');const body=String(notes||'').replace(/^\s*\[QA:\s*(?:valid|invalid|not sure|unreviewed)\]\s*\n?/i,'');return '[QA: '+(verdict==='unsure'?'not sure':verdict)+']'+(body?'\n'+body:'');}

function mergeRecordingRefresh(current,incoming){const previous=new Map(current.map(record=>[record.lead+'|'+record.audio,record]));return incoming.map(record=>{const existing=previous.get(record.lead+'|'+record.audio);if(existing){Object.assign(existing,record);return existing;}return record;});}

const INVALID_REASONS=['Wrong transfer','Customer not interested','Disconnected call','Duplicate transfer/recording','Other'];
function invalidReason(notes){return String(notes||'').match(/^Reason: (.+)$/m)?.[1]||'';}
function setInvalidReason(notes,reason){if(reason&&!INVALID_REASONS.includes(reason))throw new Error('Choose an invalid reason.');let text=setNoteVerdict(notes,'invalid').replace(/^Reason: .*\n?/m,'');return reason?text.replace(/^(\[QA: invalid\])/, '$1\nReason: '+reason):text;}
function recordingLink(record){return /^\/RECORDINGS\/MP3\/[A-Za-z0-9_.-]+\.mp3$/.test(record.audio||'')&&!record.audio.includes('..')?'https://myvici.info'+record.audio:'';}
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function reviewReport(agents,date,format='csv',scope='all'){
 const label=v=>v==='unsure'?'Not sure':v==='unreviewed'?'Unreviewed':v==='invalid'?'Invalid':'Valid';
 const rows=[['Date','Agent username','Agent name','Customer name','Lead ID','Time','Call status','QA status','Invalid reason','Notes','Recording URL']];
 for(const a of agents)for(const r of a.recordings){if(String(r.status).toUpperCase()!=='XFER')continue;const verdict=noteVerdict(r.notes);if(scope==='followup'&&!['invalid','unsure'].includes(verdict))continue;rows.push([date,a.username,a.name,r.customer,r.lead,r.time,r.status,label(verdict),invalidReason(r.notes),r.notes,recordingLink(r)]);}
 if(format==='csv')return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
 const lines=['AIG ViciDial QA review report','Date: '+date,'Generated: '+new Date().toLocaleString(),'Scope: '+(scope==='followup'?'Invalid and Not sure':'All XFER calls'),''];
 for(const a of agents){const c=transferCounts(a.recordings);lines.push(a.name+' ('+a.username+')', 'Transfers: '+c.total+' | Valid: '+c.valid+' | Invalid: '+c.invalid+' | Not sure: '+c.unsure+' | Unreviewed: '+c.unreviewed,'');for(const row of rows.slice(1).filter(row=>row[1]===a.username)){lines.push('Customer: '+row[3]+' | Lead: '+row[4]+' | Time: '+row[5]+' | '+row[7],...(row[8]?['Reason: '+row[8]]:[]),'Notes: '+(row[9]||'—'),'Recording: '+row[10],'');}}
 return lines.join('\n');
}
