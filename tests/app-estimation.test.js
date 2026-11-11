import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../src/domain.js';
import * as roof from '../src/roof-view.js';
import * as energy from '../src/energy-series.js';
import {createWalkthroughSession,mountFormHelper} from '../src/form-helper.js';
const appSource=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
const geo={latitude:-8.65,longitude:115.2,heading:90,roof:{type:'gable',width:8,length:10,pitch:28,orientation:'portrait',surface:'a'},diffuseFraction:.5,albedo:.2,additionalLoss:0};
function harness(savedInput=null){const el=()=>({innerHTML:'',textContent:'',hidden:true,classList:{add(){},remove(){}},addEventListener(){},scrollIntoView(){},setAttribute(){}}),app=el(),toast=el(),stale=el(),zone=el(),actions=new Map(),buttons=['data-mode','segment','monthly-mode','prev','step'].map(action=>({dataset:{action,value:action==='data-mode'?'manual':action==='segment'?'school':action==='step'?'1':'full'},addEventListener:(e,fn)=>actions.set(action,fn)}));const context=vm.createContext({...domain,...roof,...energy,createWalkthroughSession,mountFormHelper,structuredClone,TextEncoder,document:{querySelector:s=>s==='#app'||s==='#main'?app:s==='#toast'?toast:s==='[data-stale-result]'?stale:s==='#timezone'?zone:null,querySelectorAll:s=>s==='[data-action]'?buttons:[]},location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:key=>key==='suryajelas:input:v1'&&savedInput?JSON.stringify(savedInput):null},setTimeout(){},clearTimeout(){}});vm.runInContext(appSource,context);return {context,stale,toast,zone,actions,eval:s=>vm.runInContext(s,context),json:s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',context))};}
test('geo off keeps visual exploration isolated and optional in rendered form',()=>{const h=harness();h.eval("state.visualSun.latitude=-7; syncGeographicInput();");assert.equal(h.eval('state.input.geo'),null);assert.equal(h.eval('state.dirty'),false);assert.match(h.eval('geographicControls()'),/Opsional/);assert.doesNotMatch(h.eval('geographicControls()'),/id="geo-enabled" checked/);});
test('shared geo synchronizes location, heading, roof and timezone and marks old results stale',()=>{const h=harness({...structuredClone(domain.DEFAULT_INPUT),geo});h.eval("state.dirty=false; state.visualSun={...state.visualSun,latitude:-3,heading:180,timezone:'Asia/Makassar'}; state.visualRoof.pitch=35; syncGeographicInput();");assert.equal(h.eval('state.input.geo.latitude'),-3);assert.equal(h.eval('state.input.geo.heading'),180);assert.equal(h.eval('state.input.geo.roof.pitch'),35);assert.equal(h.eval('state.input.timezone'),'Asia/Makassar');assert.equal(h.eval('state.dirty'),true);assert.equal(h.stale.hidden,false);assert.equal(h.zone.value,'Asia/Makassar');});
test('time/date and visual panel count do not change annual geographic assumptions',()=>{const h=harness({...structuredClone(domain.DEFAULT_INPUT),geo});const before=h.json('state.input.geo');h.eval("state.dirty=false;state.visualSun={...state.visualSun,minutes:1200,date:'2026-06-21'};state.visualRoof.panels=50;syncGeographicInput();");assert.deepEqual(h.json('state.input.geo'),before);assert.equal(h.eval('state.dirty'),false);});
test('reload and snapshot import restore geo instead of the Bandung template',async()=>{const i={...structuredClone(domain.DEFAULT_INPUT),timezone:'Asia/Makassar',geo};const h=harness(i);assert.equal(h.eval('state.visualSun.latitude'),geo.latitude);assert.equal(h.eval('state.visualSun.heading'),geo.heading);h.context.replayResult={input:structuredClone(i)};h.context.file={size:2,text:async()=>'{}'};h.eval('runWorker=async()=>replayResult');await h.eval('importJSON(file)');assert.equal(h.eval('state.visualRoof.surface'),'a');assert.equal(h.eval('state.visualSun.timezone'),'Asia/Makassar');assert.equal(h.eval('state.dirty'),false);});
test('CSV loads monthly totals in UI and refuses production double-correction',async()=>{const h=harness(),stamps=energy.hourlyTimeline(2025,'Asia/Jakarta');const csv='timestamp,production_kwh_per_kwp,load_kwh\n'+stamps.map(s=>s+',0.1,0.2').join('\n');h.context.file={size:csv.length,text:async()=>csv};h.eval("state.input.mode='manual';state.input.sourceName='Test only';state.input.sourcePeriod='2025';");await h.eval('importHourlyFile(file)');assert.equal(h.eval('state.input.hourlyData.loadKwh.length'),8760);assert.equal(h.eval('state.input.extrapolated'),false);assert.equal(h.eval('state.monthlyMode'),'full');const h2=harness({...structuredClone(domain.DEFAULT_INPUT),geo,mode:'manual'});h2.context.file=h.context.file;await h2.eval('importHourlyFile(file)');assert.equal(h2.eval('state.input.hourlyData'),null);assert.match(h2.toast.textContent,/Matikan hubungan geografis/);});

test('mode and segment buttons invalidate prior results even through navbar navigation',async()=>{for(const action of ['data-mode','segment','monthly-mode']){const h=harness();h.eval('state.result={input:structuredClone(state.input)};state.dirty=false;');await h.actions.get(action)();assert.equal(h.eval('state.result'),null);assert.equal(h.eval('state.dirty'),true);}});
test('result source label follows actual hourly provenance and flat roof tilt displays zero',()=>{const h=harness();h.eval(`state.result={input:{...state.input,geo:{...${JSON.stringify(geo)},roof:{...${JSON.stringify(geo.roof)},type:'flat'}},hourlyData:{productionKwhPerKwp:[1],sourceName:'Actual series source',sourcePeriod:'2025 actual'}},timeline:[],warnings:[]};`);assert.match(h.eval('assumptions()'),/Actual series source/);assert.match(h.eval('assumptions()'),/2025 actual/);assert.match(h.eval('assumptions()'),/flat \/ a \/ 0°/);});

test('invalid linked coordinate draft blocks forward steps, calculate, export and persistence across rerenders',async()=>{
 const h=harness({...structuredClone(domain.DEFAULT_INPUT),geo});
 h.context.calls=0;h.eval("runWorker=async()=>{calls++;throw new Error('Should not execute')};state.step=1;state.route='simulator';state.dirty=false;acceptSunDraft({values:{latitude:''},invalidFields:['latitude']});");
 assert.equal(h.eval('validateStep()'),false);assert.match(h.eval('state.errors[0].message'),/lintang/);assert.equal(h.eval('state.dirty'),true);
 h.eval('render();state.step=3;');assert.equal(h.eval('validateStep()'),false);
 await h.eval('calculate()');assert.equal(h.context.calls,0);assert.equal(h.eval('state.step'),1);assert.equal(h.eval('state.sunDraft.values.latitude'),'');
 h.eval('state.result={input:structuredClone(state.input)};state.dirty=false;');await h.eval('exportJSON()');assert.equal(h.context.calls,0);assert.match(h.toast.textContent,/Perbaiki input/);
 h.eval('saveLocal()');assert.match(h.toast.textContent,/Perbaiki input lokasi/);
 h.eval("acceptSunDraft({values:{latitude:'-8'},invalidFields:[]});");assert.equal(h.eval('validateStep()'),true);
});
test('invalid visual-only drafts do not force users to provide geographic details',()=>{
 const h=harness();h.eval("state.step=1;acceptSunDraft({values:{latitude:''},invalidFields:['latitude']});");assert.equal(h.eval('validateStep()'),true);assert.equal(h.eval('state.dirty'),false);
 h.eval("state.input.geo="+JSON.stringify(geo));assert.equal(h.eval('validateStep()'),false);
 h.eval('state.input.geo=null');assert.equal(h.eval('validateStep()'),true);
});
test('visual date draft is retained but does not invalidate annual geographic calculation',()=>{
 const h=harness({...structuredClone(domain.DEFAULT_INPUT),geo});h.eval("state.step=1;acceptSunDraft({values:{date:''},invalidFields:['date']});");assert.equal(h.eval('validateStep()'),true);
});

test('invalid linked coordinate allows Back then return to location to correct it',async()=>{
 const h=harness({...structuredClone(domain.DEFAULT_INPUT),geo});
 h.eval("state.route='simulator';state.step=1;state.consent=true;acceptSunDraft({values:{latitude:''},invalidFields:['latitude']});");
 assert.equal(h.eval('validateStep()'),false);
 await h.actions.get('prev')();assert.equal(h.eval('state.step'),0);
 assert.equal(h.eval('validateStep()'),true);
 await h.actions.get('step')();assert.equal(h.eval('state.step'),1);
 assert.equal(h.eval('state.sunDraft.values.latitude'),'');assert.equal(h.eval('validateStep()'),false);
 h.eval("acceptSunDraft({values:{latitude:'-8.65'},invalidFields:[]});");assert.equal(h.eval('validateStep()'),true);
});
