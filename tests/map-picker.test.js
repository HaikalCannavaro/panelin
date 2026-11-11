import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMapPicker} from '../src/map-picker.js';
import {screenLocation} from '../src/map-model.js';
import {roofViewHTML} from '../src/roof-view.js';
const initial={latitude:-6.9175,longitude:107.6191};
function harness(){
 const nodes=new Map(),requests=[],created=[],changes=[];
 const make=()=>({style:{},hidden:false,disabled:false,dataset:{},classList:{add(){},remove(){}},listeners:new Map(),children:[],clientWidth:600,clientHeight:300,
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);},
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));},
  fire(type,values={}){const event={target:this,isPrimary:true,button:0,pointerId:1,clientX:300,clientY:150,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};for(const fn of this.listeners.get(type)||[])fn(event);return event;},
  closest(){return null;},focus(){this.focused=true;},append(img){this.children.push(img);img.parent=this;},remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},
  setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},getBoundingClientRect(){return {left:0,top:0};},
  set src(value){this.url=value;requests.push(value);},get src(){return this.url;}
 });
 const one=selector=>{if(!nodes.has(selector))nodes.set(selector,make());return nodes.get(selector);};
 const buttons=['enable','disable','out','in','center','pick'].map(key=>{const button=one(`[data-map-action="${key}"]`);button.dataset.mapAction=key;return button;});
 const root={ownerDocument:{createElement(){const img=make();created.push(img);return img;}},querySelector:one,querySelectorAll:()=>buttons};
 const api=mountMapPicker(root,initial,{onChange:point=>changes.push(point)});
 return {api,one,requests,created,changes,view:one('.map-viewport'),click:key=>one(`[data-map-action="${key}"]`).fire('click'),load:()=>created.filter(i=>!i.removed).forEach(i=>i.onload?.()),fail:()=>created.filter(i=>!i.removed).forEach(i=>i.onerror?.())};
}
const withMap=fn=>{const h=harness();try{fn(h);}finally{h.api.dispose();}};
test('mounted map makes no image requests before opt-in, activates explicitly and removes all on disable',()=>withMap(h=>{
 assert.equal(h.requests.length,0);h.api.updateLocation({latitude:-8.65,longitude:115.2167});assert.equal(h.requests.length,0);
 h.click('enable');assert.ok(h.requests.length>0);assert.equal(h.one('[data-map-active]').hidden,false);assert.equal(h.changes.length,0);
 assert.ok(h.created.every(img=>img.referrerPolicy==='origin'));h.load();assert.match(h.one('[data-map-status]').textContent,/Peta siap/);
 const requests=h.requests.length;h.click('enable');assert.equal(h.requests.length,requests);
 h.click('disable');assert.equal(h.one('[data-map-active]').hidden,true);assert.equal(h.one('[data-map-consent]').hidden,false);assert.equal(h.one('.map-tile-layer').children.length,0);
 h.api.updateLocation(initial);assert.equal(h.requests.length,requests);assert.equal(h.changes.length,0);
}));
test('clicking a loaded map updates coordinates; incomplete/failed tiles cannot silently choose a point',()=>withMap(h=>{
 h.click('enable');h.click('pick');assert.equal(h.changes.length,0);assert.match(h.one('[data-map-status]').textContent,/Tunggu/);
 h.load();h.view.fire('pointerdown',{clientX:400,clientY:200});h.view.fire('pointerup',{clientX:400,clientY:200});assert.equal(h.changes.length,1);
 const expected=screenLocation(initial,16,600,300,400,200);assert.ok(Math.abs(h.changes[0].latitude-expected.latitude)<1e-6);assert.ok(Math.abs(h.changes[0].longitude-expected.longitude)<1e-6);
 h.fail();assert.match(h.one('[data-map-status]').textContent,/gagal dimuat/);h.click('pick');assert.equal(h.changes.length,1);
}));
test('drag requests only final viewport; cancel does not move selected location or request new tiles',()=>withMap(h=>{
 h.click('enable');h.load();const requests=h.requests.length;
 h.view.fire('pointerdown');h.view.fire('pointermove',{clientX:900,clientY:150});assert.equal(h.requests.length,requests);h.view.fire('pointercancel');assert.equal(h.requests.length,requests);assert.equal(h.changes.length,0);
 h.view.fire('pointerdown');h.view.fire('pointermove',{clientX:900,clientY:150});h.view.fire('pointerup',{clientX:900,clientY:150});assert.ok(h.requests.length>requests);assert.equal(h.changes.length,0);
 h.load();h.click('pick');assert.ok(h.changes[0].longitude<initial.longitude);
}));
test('keyboard navigation and city presets never select a house until explicit confirmation',()=>withMap(h=>{
 h.click('enable');h.load();let requests=h.requests.length;
 h.view.fire('keydown',{key:'+',ctrlKey:true});assert.equal(h.requests.length,requests);
 assert.equal(h.view.fire('keydown',{key:'+'}).prevented,true);assert.match(h.one('[data-map-zoom]').textContent,/17/);assert.equal(h.changes.length,0);
 h.view.fire('keydown',{key:'ArrowRight'});h.load();h.view.fire('keydown',{key:'Enter'});assert.equal(h.changes.length,1);
 const city=h.one('[data-map-city]');city.value='5';assert.equal(city.fire('change').stopped,true);assert.equal(h.changes.length,1);assert.match(h.one('[data-map-status]').textContent,/belum berubah/);assert.match(h.one('[data-map-zoom]').textContent,/12/);
 h.load();h.click('pick');assert.equal(h.changes.length,2);assert.ok(Math.abs(h.changes[1].latitude+8.65)<1e-5);
}));
test('zoom limits and teardown remain safe after repeated interactions',()=>withMap(h=>{
 h.click('enable');for(let i=0;i<20;i++)h.click('out');assert.equal(h.one('[data-map-action="out"]').disabled,true);assert.match(h.one('[data-map-zoom]').textContent,/3/);
 for(let i=0;i<25;i++)h.click('in');assert.equal(h.one('[data-map-action="in"]').disabled,true);assert.match(h.one('[data-map-zoom]').textContent,/19/);
 h.api.dispose();const requests=h.requests.length;h.click('enable');h.view.fire('keydown',{key:'Enter'});assert.equal(h.requests.length,requests);assert.equal(h.changes.length,0);
}));
test('roof UI includes easy facing choices without claiming the camera changes north',()=>{
 const html=roofViewHTML({},{});assert.equal([...html.matchAll(/data-sun-heading="/g)].length,8);assert.match(html,/utara sejati/);assert.match(html,/Rotasi kamera tidak mengubah arah ini/);
});
