import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const app=fs.readFileSync('app.js','utf8'),elements=new Map();
class Option{constructor(text,value){this.textContent=text;this.value=value;}}
const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',options:[],add(option){this.options.push(option);},replaceChildren(...options){this.options=options;}});return elements.get(id);};
$('activity-date').value='2026-10-01';$('activity-end').value='2026-10-03';$('activity-agent').value='later';let calls=0,fail=false;
const c=vm.createContext({$,Option,Map,AbortController,URLSearchParams,authorization:true,fetch:async url=>{calls++;const date=new URL('https://example.test'+url).searchParams.get('date');return Response.json(fail?{error:'Unavailable'}:{agents:date.endsWith('03')?[{username:'later',name:'Later Agent'}]:[{username:'first',name:'First Agent'}]},{status:fail?502:200});}});
vm.runInContext(app.slice(app.indexOf('function cutoffDates('),app.indexOf('\n',app.indexOf('function cutoffDates('))),c);
vm.runInContext(app.slice(app.indexOf('let activityRosterSequence='),app.indexOf("$('activity-picker').onchange")),c);
await c.loadActivityAgents();assert.equal(calls,3);assert.equal($('activity-picker').options.length,3);assert.equal($('activity-picker').value,'later');assert.equal($('activity-picker').options.find(o=>o.value==='later').textContent,'Later Agent');
await c.loadActivityAgents();assert.equal(calls,3);
$('activity-agent').value='manual';c.syncActivityAgent();assert.equal($('activity-picker').value,'manual');assert.match($('activity-picker').options.find(o=>o.value==='manual').textContent,/entered manually/);
fail=true;$('activity-date').value='2026-10-04';$('activity-end').value='2026-10-04';await c.loadActivityAgents();assert.equal($('activity-picker').value,'manual');assert.match($('activity-roster-status').textContent,/unavailable/);
console.log('PASS: full cutoff union, duplicate removal, agent absent on first day, cached summaries, manual username selection and unavailable-day fallback.');
