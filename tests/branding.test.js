import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../src/domain.js';
import * as view from '../src/roof-view.js';
import {createWalkthroughSession,mountFormHelper} from '../src/form-helper.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const appSource=read('src/app.js').replace(/^import[^\n]+\n/gm,'');
function appHarness(initial={}){
 const saved=new Map(Object.entries(initial));
 const el=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},scrollIntoView(){}}),app=el(),toast=el();
 const downloaded=[];
 const context=vm.createContext({...domain,...view,createWalkthroughSession,mountFormHelper,structuredClone,Blob,
  document:{querySelector:s=>s==='#app'?app:s==='#toast'?toast:null,querySelectorAll:()=>[],createElement:()=>({click(){downloaded.push(this.download);}})},
  URL:{createObjectURL:()=> 'blob:local-test',revokeObjectURL(){}},location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},setTimeout(){},clearTimeout(){}});
 vm.runInContext(appSource,context);
 return {saved,app,downloaded,context,eval:s=>vm.runInContext(s,context)};
}

test('Panelin branding covers page title, logo, footer, copy and package metadata',()=>{
 assert.match(read('index.html'),/<title>Panelin •/);
 assert.equal(JSON.parse(read('package.json')).name,'panelin');
 const app=appHarness();
 assert.match(app.app.innerHTML,/aria-label="Panelin beranda"/);
 assert.match(app.app.innerHTML,/Panel<span>in<\/span>/);
 assert.match(app.app.innerHTML,/© 2026 Panelin/);
 assert.match(app.app.innerHTML,/Panelin adalah alat eksplorasi awal/);
 assert.doesNotMatch(app.app.innerHTML,/SuryaJelas|Surya<span>Jelas/);
 assert.match(domain.DEFAULT_INPUT.sourceName,/Panelin/);
});

test('Panelin keeps existing saved inputs and their original provenance intact',()=>{
 const input={...structuredClone(domain.DEFAULT_INPUT),city:'Denpasar',sourceName:'Contoh sintetis SuryaJelas'};
 const roof={...view.DEFAULT_ROOF,pitch:33};
 const sun={...view.DEFAULT_SUN,latitude:-8,longitude:115,timezone:'Asia/Makassar'};
 const initial={'suryajelas:input:v1':JSON.stringify(input),'suryajelas:visual:v1':JSON.stringify(roof),'suryajelas:sun:v1':JSON.stringify(sun)};
 const app=appHarness(initial);
 assert.equal(app.eval('state.input.city'),'Denpasar');
 assert.equal(app.eval('state.input.sourceName'),'Contoh sintetis SuryaJelas');
 assert.equal(app.eval('state.visualRoof.pitch'),33);
 assert.equal(app.eval('state.visualSun.timezone'),'Asia/Makassar');
 app.eval('saveLocal(false)');
 assert.deepEqual([...app.saved.keys()].sort(),Object.keys(initial).sort());
 assert.equal(JSON.parse(app.saved.get('suryajelas:input:v1')).sourceName,input.sourceName);
});

test('new snapshot downloads use Panelin without changing the numerical contract',async()=>{
 const app=appHarness();
 app.context.result={input:structuredClone(domain.DEFAULT_INPUT)};
 app.eval('state.result=result;state.dirty=false;runWorker=async()=>({modelVersion:MODEL_VERSION,input:result.input})');
 await app.eval('exportJSON()');
 assert.deepEqual(app.downloaded,['Panelin-2025-demo.json']);
});
