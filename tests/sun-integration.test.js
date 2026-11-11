import {createWalkthroughSession,mountFormHelper} from '../src/form-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../src/domain.js';
import * as view from '../src/roof-view.js';
import {roofGeometry,layoutPanels,dot} from '../src/roof-model.js';
import {sceneGeometry,clipGroundPolygon,faceLighting,createRoofRenderer} from '../src/roof-renderer.js';
import {solarPosition,DEFAULT_SUN} from '../src/sun-model.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const fakeSun=(direction,daylight=true)=>({config:DEFAULT_SUN,localDirection:direction,daylight});

test('roof and panel normals agree with physical outward surface normals',()=>{
 for(const type of ['flat','gable','hip','l']){
  const roof=roofGeometry({type}),layout=layoutPanels(roof,12),scene=sceneGeometry(roof,layout);
  for(const surface of roof.surfaces){const face=scene.faces.find(f=>f.points===surface.points);assert.ok(face);close(dot(face.normal,surface.normal),1);}
  for(const panel of layout.panels){const face=scene.faces.find(f=>f.points===panel.points);close(dot(face.normal,panel.normal),1);}
  for(const wall of roof.walls){const face=scene.faces.find(f=>f.points===wall);const dx=wall[1][0]-wall[0][0],dz=wall[1][2]-wall[0][2];assert.ok(dot(face.normal,[dz,0,-dx])>0);}
 }
});

test('lighting follows one-sided sun direction, never illuminates backface directly',()=>{
 const face={normal:[1,0,0]};
 close(faceLighting(face,fakeSun([1,0,0])),1);
 close(faceLighting(face,fakeSun([-1,0,0])),.43);
 close(faceLighting(face,fakeSun([0,-1,0],false)),.38);
});

test('shadow remains darker than lawn even at low solar elevation',()=>{
 const ground={normal:[0,1,0],color:[193,208,173]},shadow={unlit:true,color:[119,136,115]};
 for(const degrees of [3.001,5,10,45,89.9]){
  const a=degrees*Math.PI/180,sun=fakeSun([Math.cos(a),Math.sin(a),0]);
  for(let i=0;i<3;i++)assert.ok(shadow.color[i]*faceLighting(shadow,sun)<ground.color[i]*faceLighting(ground,sun));
 }
});

test('projected shadows are finite, clipped to lawn, absent at night and horizon',()=>{
 for(const type of ['flat','gable','hip','l'])for(const heading of [0,90,180,270]){
  const roof=roofGeometry({type}),layout=layoutPanels(roof,12);
  for(const minutes of [480,720,960,1200]){
   const sun=solarPosition({minutes,heading}),scene=sceneGeometry(roof,layout,sun),shadows=scene.faces.filter(f=>f.shadow);
   if(sun.elevation>3)assert.ok(shadows.length>0);else assert.equal(shadows.length,0);
   for(const face of shadows)for(const p of face.points){assert.ok(p.every(Number.isFinite));close(p[1],-.175);assert.ok(p[0]>=-6-1e-8&&p[0]<=6+1e-8&&p[2]>=-7-1e-8&&p[2]<=7+1e-8);}
  }
 }
 const clipped=clipGroundPolygon([[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2]],[-1,1,-1,1]);assert.equal(clipped.length,4);clipped.forEach(p=>assert.ok(Math.abs(p[0])===1&&Math.abs(p[2])===1));
});

test('software renderer draws all templates, day/night and heading without DOM/GPU',()=>{
 const make=()=>({clientWidth:320,clientHeight:260,width:320,height:260,cloneNode:make,replaceWith(){},getContext(type){return type==='2d'?{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(image){assert.ok(image.data.some(v=>v!==0));}}:null;}});
 for(const type of ['flat','gable','hip','l']){
  const roof=roofGeometry({type}),renderer=createRoofRenderer(make());assert.equal(renderer.mode,'fallback');
  for(const minutes of [480,720,960,1200])for(const heading of [0,90,180,270]){
   const overlay=renderer.draw(roof,layoutPanels(roof,12),solarPosition({minutes,heading}));
   assert.equal(overlay.cardinals.length,4);for(const c of overlay.cardinals)assert.ok(c.point.every(Number.isFinite));
  }
  renderer.dispose();assert.equal(renderer.draw(roof,layoutPanels(roof,12)),undefined);
 }
});

test('solar controls have no numerical form names and disclose model separation',()=>{
 const html=view.roofViewHTML({}, {sun:{latitude:91,date:'<script>'}});
 assert.match(html,/data-sun-control="latitude" value="90"/);
 assert.match(html,/tidak mengubah hasil energi/);
 assert.match(html,/nama kota di kalkulasi tidak mengubah posisi 3D/);
 assert.doesNotMatch(html,/<script>/);
 for(const tag of html.matchAll(/<(?:input|select)[^>]*data-sun[^>]*>/g))assert.doesNotMatch(tag[0],/\bname=/);
});

const appSource=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
function appHarness(initial={}){
 const saved=new Map(Object.entries(initial)),handlers=new Map();const el=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},scrollIntoView(){}}),app=el(),toast=el();
 const clear={dataset:{action:'clear'},addEventListener(name,handler){handlers.set(name,handler);}};
 const context=vm.createContext({...domain,...view,createWalkthroughSession,mountFormHelper,structuredClone,document:{querySelector:s=>s==='#app'?app:s==='#toast'?toast:null,querySelectorAll:s=>s==='[data-action]'?[clear]:[]},location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},setTimeout(){},clearTimeout(){}});
 vm.runInContext(appSource,context);return {saved,eval:s=>vm.runInContext(s,context),clear:()=>handlers.get('click')(),context};
}
test('explicit save, reload and delete preserve solar settings separately from energy',async()=>{
 const solar={...DEFAULT_SUN,latitude:-8,longitude:115,timezone:'Asia/Makassar',minutes:960,heading:90};
 const app=appHarness({'suryajelas:sun:v1':JSON.stringify(solar)});
 assert.deepEqual(JSON.parse(app.eval('JSON.stringify(state.visualSun)')),solar);
 assert.ok(!app.eval('"latitude" in state.input'));app.eval('saveLocal(false)');
 assert.deepEqual(JSON.parse(app.saved.get('suryajelas:sun:v1')),solar);
 const restored=appHarness(Object.fromEntries(app.saved));assert.deepEqual(JSON.parse(restored.eval('JSON.stringify(state.visualSun)')),solar);
 await restored.clear();for(const key of ['sun','visual','input'])assert.equal(restored.saved.has(`suryajelas:${key}:v1`),false);
});
test('snapshot replay resets solar template without adding fields to numerical model',async()=>{
 const app=appHarness({'suryajelas:sun:v1':JSON.stringify({...DEFAULT_SUN,minutes:1200})});
 app.context.replayResult={input:structuredClone(domain.DEFAULT_INPUT)};app.eval('runWorker=async()=>replayResult');app.context.file={size:2,text:async()=>'{}'};
 await app.eval('importJSON(file)');assert.deepEqual(JSON.parse(app.eval('JSON.stringify(state.visualSun)')),DEFAULT_SUN);
 assert.ok(!app.eval('"minutes" in state.input'));assert.ok(!app.eval('"latitude" in state.result.input'));
});

function mountHarness(){
 const nodes=new Map();
 const element=()=>({dataset:{},value:'',type:'',innerHTML:'',textContent:'',attrs:new Map(),listeners:new Map(),classList:{add(){},remove(){},toggle(){}},valid:true,
  setAttribute(k,v){this.attrs.set(k,v)},removeAttribute(k){this.attrs.delete(k)},checkValidity(){return this.valid},
  addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,[]);this.listeners.get(k).push(fn)},
  fire(k){const event={target:this,stopPropagation(){this.stopped=true}};for(const fn of this.listeners.get(k)||[])fn(event);return event},
  clientWidth:260,clientHeight:220,width:260,height:220,cloneNode(){return this},replaceWith(){},
  getContext(type){return type==='2d'?{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}:null;}
 });
 const one=s=>{if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)};
 const roofKeys=['width','length','pitch','panels','orientation','surface'],sunKeys=['date','latitude','longitude','timezone','minutes','heading'];
 const roofControls=roofKeys.map(k=>{const e=one(`[data-roof-control="${k}"]`);e.dataset.roofControl=k;e.type=['orientation','surface'].includes(k)?'select-one':'range';e.value=view.DEFAULT_ROOF[k];return e});
 const sunControls=sunKeys.map(k=>{const e=one(`[data-sun-control="${k}"]`);e.dataset.sunControl=k;e.type=['latitude','longitude'].includes(k)?'number':k==='date'?'date':k==='timezone'?'select-one':'range';e.value=String(DEFAULT_SUN[k]);return e});
 const roofValues=['width','length','pitch','panels'].map(k=>{const e=one(`[data-roof-value="${k}"]`);e.dataset.roofValue=k;return e});
 const presets=[480,720,960,1200].map(m=>{const e=element();e.dataset.sunPreset=String(m);return e});
 const root={querySelector:one,querySelectorAll:s=>({'[data-roof-control]':roofControls,'[data-roof-value]':roofValues,'[data-sun-control]':sunControls,'[data-sun-preset]':presets}[s]||[])};
 return {root,one,presets};
}
test('mounted view updates sunlight on time/heading changes and disposes',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=fn=>{fn();return 0};globalThis.cancelAnimationFrame=()=>{};
 try{
  const h=mountHarness();let solar,roofChanges=0;
  const dispose=view.mountRoofView(h.root,{}, {onSunChange:v=>solar=v,onChange:()=>roofChanges++});
  assert.match(h.one('[data-sun-status]').textContent,/atas horizon/);assert.match(h.one('[data-sun-clock]').textContent,/09:00 WIB/);
  h.presets[3].fire('click');assert.equal(solar.minutes,1200);assert.match(h.one('[data-sun-status]').textContent,/bawah horizon/);assert.equal(h.one('.roof-sun-overlay').innerHTML.includes('sun-disc'),false);
  const heading=h.one('[data-sun-control="heading"]');heading.value='90';assert.ok(heading.fire('input').stopped);assert.equal(solar.heading,90);
  const time=h.one('[data-sun-time]');time.value='08:35';assert.ok(time.fire('change').stopped);assert.equal(solar.minutes,515);assert.match(h.one('[data-sun-clock]').textContent,/08:35 WIB/);
  assert.equal(roofChanges,1);dispose();
 }finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel}
});
test('mounted invalid location keeps last valid geometry and error persists',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;globalThis.requestAnimationFrame=fn=>{fn();return 0};globalThis.cancelAnimationFrame=()=>{};
 try{const h=mountHarness();let solar;const dispose=view.mountRoofView(h.root,{}, {onSunChange:v=>solar=v});const lat=h.one('[data-sun-control="latitude"]');lat.value='100';lat.valid=false;assert.ok(lat.fire('change').stopped);assert.equal(solar.latitude,DEFAULT_SUN.latitude);assert.ok(h.one('[data-sun-error]').textContent);const heading=h.one('[data-sun-control="heading"]');heading.value='90';heading.fire('input');assert.ok(h.one('[data-sun-error]').textContent);lat.value='-8';lat.valid=true;lat.fire('change');assert.equal(solar.latitude,-8);assert.equal(h.one('[data-sun-error]').textContent,'');dispose();}finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel}
});

test('invalid raw coordinate draft reaches parent immediately and survives remount until corrected',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;globalThis.requestAnimationFrame=fn=>{fn();return 0};globalThis.cancelAnimationFrame=()=>{};
 try{
  for(const bad of ['', '100']){
   const first=mountHarness();let draft,solar;
   const dispose=view.mountRoofView(first.root,{}, {onSunDraftChange:v=>draft=v,onSunChange:v=>solar=v});
   const lat=first.one('[data-sun-control="latitude"]');lat.value=bad;lat.valid=bad!== '100';lat.fire('input');
   assert.equal(draft.values.latitude,bad);assert.ok(draft.invalidFields.includes('latitude'));assert.equal(solar.latitude,DEFAULT_SUN.latitude);
   const saved=structuredClone(draft);dispose();
   const second=mountHarness();const dispose2=view.mountRoofView(second.root,{}, {sun:solar,sunDraft:saved,onSunDraftChange:v=>draft=v,onSunChange:v=>solar=v});
   assert.equal(second.one('[data-sun-control="latitude"]').value,bad);assert.ok(draft.invalidFields.includes('latitude'));assert.ok(second.one('[data-sun-error]').textContent);
   const heading=second.one('[data-sun-control="heading"]');heading.value='90';heading.fire('input');assert.ok(draft.invalidFields.includes('latitude'));
   const corrected=second.one('[data-sun-control="latitude"]');corrected.value='-8';corrected.valid=true;corrected.fire('input');assert.equal(solar.latitude,-8);assert.deepEqual(draft.invalidFields,[]);dispose2();
  }
 }finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel}
});
