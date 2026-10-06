import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});
const html=readFileSync('index.html','utf8');
const js=readFileSync('recording-utils.js','utf8')+'\n'+readFileSync('app.js','utf8');
const css=readFileSync('style.css','utf8');
const page=html.replace('/* APP_STYLE */',css).replace('/* APP_SCRIPT */',js);
writeFileSync('dist/server/index.js',`const PAGE=${JSON.stringify(page)};\n`+readFileSync('worker.js','utf8'));
console.log('Built recording viewer: '+Buffer.byteLength(page)+' bytes, one audio player.');
