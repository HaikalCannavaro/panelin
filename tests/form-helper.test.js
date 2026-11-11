import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {walkthroughSteps,createWalkthroughSession,mountFormHelper,walkthroughScrollDelta} from '../src/form-helper.js';

// Deliberately small DOM boundary for lifecycle tests. Not a browser/AT audit.
class NodeStub {
  constructor(doc, tag = 'div', attrs = {}) {
    this.ownerDocument = doc; this.tagName = tag; this.attrs = new Map(Object.entries(attrs)); this.children = []; this.listeners = new Map(); this.dataset = {}; this.style = {bottom: '',setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};
    this.classList = {values: new Set(),add(...v){v.forEach(x=>this.values.add(x));},remove(...v){v.forEach(x=>this.values.delete(x));},contains(v){return this.values.has(v);}};
    this.rect = {top: 700, bottom: 780, left: 30, right: 650, height: 80}; this.open = false;
  }
  set id(v){this.attrs.set('id',v);} get id(){return this.attrs.get('id')||'';} get name(){return this.attrs.get('name')||'';}
  set className(v){this.classList.values=new Set(v.split(/\s+/));} get className(){return [...this.classList.values].join(' ');}
  get isConnected(){return this === this.ownerDocument.documentElement || Boolean(this.parentElement?.isConnected);}
  append(node){this.children.push(node);node.parentElement=this;}
  before(node){const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,node);node.parentElement=p;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  contains(node){return node===this||this.children.some(n=>n.contains(node));}
  setAttribute(k,v){this.attrs.set(k,String(v));} getAttribute(k){return this.attrs.get(k)??null;} removeAttribute(k){this.attrs.delete(k);}
  matches(s){if(s.includes('input:not('))return ['input','select','textarea','button','summary'].includes(this.tagName);if(s[0]==='.')return this.classList.contains(s.slice(1));if(s[0]==='#')return this.id===s.slice(1);if(s==='[data-helper-action]')return Boolean(this.dataset.helperAction);return this.tagName===s;}
  closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null;}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  querySelector(s){return this.selectors?.get(s)||this.querySelectorAll(s)[0]||null;}
  addEventListener(k,f){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f);}
  removeEventListener(k,f){this.listeners.get(k)?.delete(f);}
  dispatch(k, event={}){const e={target:this,preventDefault(){this.prevented=true;},...event};for(const fn of [...this.listeners.get(k)||[]])fn(e);return e;}
  focus(){this.ownerDocument.activeElement=this;}
  click(){this.dispatch('click');}
  getBoundingClientRect(){return this.rect;}
  set innerHTML(html){
    this.html=html;this.children=[];
    if(this.className==='helper-launch-bar'){const b=new NodeStub(this.ownerDocument,'button',{'aria-expanded':'false'});this.append(b);}
    if(this.className==='form-helper-card'){
      const h=new NodeStub(this.ownerDocument,'h2',{id:'form-helper-title'});h.textContent=html.match(/<h2[^>]*>(.*?)<\/h2>/)?.[1];this.append(h);
      const p=new NodeStub(this.ownerDocument,'p',{id:'form-helper-description'});this.append(p);
      for(const name of ['close','focus','back','next']){const b=new NodeStub(this.ownerDocument,'button');b.dataset.helperAction=name;this.append(b);}
    }
  }
  get innerHTML(){return this.html;}
}
function harness(selectors = ['#year'], {reduced=false}={}) {
  const doc = {activeElement:null,listeners:new Map()};
  doc.documentElement=new NodeStub(doc,'html');doc.body=new NodeStub(doc,'body');doc.documentElement.append(doc.body);
  doc.createElement=tag=>new NodeStub(doc,tag);doc.addEventListener=NodeStub.prototype.addEventListener.bind(doc);doc.removeEventListener=NodeStub.prototype.removeEventListener.bind(doc);doc.dispatch=NodeStub.prototype.dispatch.bind(doc);
  doc.getElementById=id=>doc.documentElement.querySelector('#'+id);
  const frames=new Map();let id=0;
  const win=new NodeStub(doc,'window');win.innerHeight=900;win.matchMedia=()=>({matches:reduced});win.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};win.cancelAnimationFrame=id=>frames.delete(id);win.scrolls=[];win.scrollBy=value=>win.scrolls.push(value);doc.defaultView=win;
  const wizard=new NodeStub(doc);wizard.className='wizard';wizard.selectors=new Map();doc.body.append(wizard);
  const form=new NodeStub(doc,'form');form.submits=0;form.requestSubmit=()=>form.submits++;wizard.append(form);
  for(const selector of selectors){
    const field=new NodeStub(doc);field.className=selector[0]==='.'?selector.slice(1):'field';
    const input=new NodeStub(doc,'input',{id:selector.slice(1),name:selector.slice(1),'aria-describedby':'existing-hint'});field.append(input);form.append(field);
    wizard.selectors.set(selector,selector[0]==='.'?field:input);
  }
  const prior=new NodeStub(doc,'button');wizard.selectors.set('[data-action="prev"]',prior);wizard.append(prior);
  const flush=()=>{for(const [key,fn]of [...frames]){frames.delete(key);fn();}};
  const card=()=>doc.getElementById('form-helper-card');
  const action=name=>{const node=card().children.find(n=>n.dataset.helperAction===name);card().dispatch('click',{target:node});};
  const launch=()=>wizard.querySelector('.helper-launch-bar').querySelector('button').click();
  return {doc,win,wizard,form,flush,card,action,launch,prior,target:s=>wizard.selectors.get(s)};
}

test('each wizard stage has distinct contextual guide items and no unknown stage',()=>{
  for(let step=0;step<4;step++){
    const items=walkthroughSteps({step});assert.ok(items.length>=6);assert.equal(new Set(items.map(i=>i.id)).size,items.length);
    items.forEach(i=>{assert.ok(i.selector&&i.title&&i.description&&i.hint);});
  }
  assert.deepEqual(walkthroughSteps({step:4}),[]);
});

test('billing and consumption branches track the visible form controls',()=>{
  const regular=walkthroughSteps({step:0});assert.equal(regular.find(i=>i.id==='consumption').selector,'#monthlyValue');assert.ok(regular.some(i=>i.id==='consent'));assert.ok(!regular.some(i=>i.id==='months'));
  const alternative=walkthroughSteps({step:0,inputMode:'charge',monthlyMode:'full'});assert.equal(alternative.find(i=>i.id==='consumption').selector,'#energyCharge');assert.ok(alternative.some(i=>i.id==='months'));assert.ok(!alternative.some(i=>i.id==='consent'));
});

test('launch, highlight, focus field, Escape and repeated launch preserve original descriptions',()=>{
  const h=harness(),session=createWalkthroughSession(),dispose=mountFormHelper(h.wizard,{step:0},session),input=h.target('#year');input.value='2031';
  for(let i=0;i<3;i++){
    h.launch();h.flush();assert.equal(session.active,true);assert.ok(input.closest('.field').classList.contains('walkthrough-target'));assert.equal(input.getAttribute('aria-describedby'),'existing-hint form-helper-description');assert.equal(h.doc.activeElement.tagName,'h2');
    h.action('focus');assert.equal(h.doc.activeElement,input);
    const e=h.doc.dispatch('keydown',{key:'Escape'});assert.equal(e.prevented,true);assert.equal(session.active,false);assert.equal(h.card(),null);assert.equal(h.doc.activeElement,input);assert.equal(input.getAttribute('aria-describedby'),'existing-hint');assert.equal(input.value,'2031');
  }
  dispose();assert.equal(h.doc.listeners.get('keydown').size,0);assert.equal(h.win.listeners.get('resize').size,0);assert.ok(!h.doc.documentElement.classList.contains('walkthrough-open'));
});

test('next/back move guide only, stage continuation uses existing submit validation',()=>{
  const h=harness(['#year','#periodMonth']),s=createWalkthroughSession(),dispose=mountFormHelper(h.wizard,{step:0},s);h.launch();assert.equal(s.id,'year');h.action('next');assert.equal(s.id,'period');assert.equal(h.form.submits,0);h.action('back');assert.equal(s.id,'year');h.action('next');h.action('next');assert.equal(h.form.submits,1);assert.equal(s.active,true);dispose();
});

test('guide survives a form rerender without resetting input focus or section',()=>{
  const h=harness(['#year','#periodMonth']),s=createWalkthroughSession();let dispose=mountFormHelper(h.wizard,{step:0},s);h.launch();h.action('next');h.action('focus');dispose();assert.equal(s.id,'period');assert.equal(s.focus.id,'periodMonth');
  dispose=mountFormHelper(h.wizard,{step:0},s);assert.equal(h.doc.activeElement,h.target('#periodMonth'));assert.equal(s.id,'period');assert.equal(h.doc.body.querySelectorAll('.form-helper-card').length,1);dispose();
});

test('new stage starts at its first available field and backward crossing resumes the last',()=>{
  const s=createWalkthroughSession();s.active=true;s.stage=0;s.id='consent';
  const h=harness(['#city','#budget']);const dispose=mountFormHelper(h.wizard,{step:1},s);assert.equal(s.id,'city');h.action('back');assert.equal(s.reverse,true);dispose();
  const a=harness(['#year','#periodMonth']);const finish=mountFormHelper(a.wizard,{step:0},s);assert.equal(s.id,'period');assert.equal(s.reverse,false);finish();
});

test('final guide action never submits or computes the simulation',()=>{
  const h=harness(['#horizon']),s=createWalkthroughSession(),dispose=mountFormHelper(h.wizard,{step:3},s);h.launch();h.action('next');assert.equal(h.form.submits,0);assert.equal(s.active,false);assert.equal(h.doc.activeElement.tagName,'button');dispose();
});

test('closing restores focus from card, routing away resets session, disposal is idempotent',()=>{
  const h=harness(),s=createWalkthroughSession(),dispose=mountFormHelper(h.wizard,{step:0},s);h.launch();h.action('close');assert.equal(h.doc.activeElement.tagName,'button');h.launch();dispose();dispose();mountFormHelper(null,{},s)();assert.equal(s.active,false);assert.equal(s.focus,null);assert.equal(h.card(),null);
});

test('helper-opened details are restored when leaving but explicit user toggles are respected',()=>{
  const h=harness(['#panelWp','#horizon']),input=h.target('#panelWp'),field=input.closest('.field'),details=new NodeStub(h.doc,'details');field.remove();details.append(field);h.form.append(details);const summary=new NodeStub(h.doc,'summary');details.append(summary);
  const s=createWalkthroughSession(),dispose=mountFormHelper(h.wizard,{step:3},s);h.launch();h.action('next');assert.equal(details.open,true);h.action('back');assert.equal(details.open,false);h.action('next');h.wizard.dispatch('click',{target:summary});h.action('close');assert.equal(details.open,true);dispose();
});

test('scroll placement avoids bottom guide on narrow layouts and honors reduced motion',()=>{
  const card={top:420,bottom:800,left:12,right:380};assert.equal(walkthroughScrollDelta({top:350,bottom:450,left:20,right:370},card,800),330);assert.equal(walkthroughScrollDelta({top:100,bottom:200,left:20,right:370},card,800),0);assert.equal(walkthroughScrollDelta({top:350,bottom:450,left:20,right:700},{...card,left:800,right:1160},800),0);
  const h=harness(['#year'],{reduced:true}),dispose=mountFormHelper(h.wizard,{step:0});h.launch();h.flush();assert.ok(h.win.scrolls.length);assert.equal(h.win.scrolls[0].behavior,'instant');dispose();
});

test('guide does not intercept field arrow keys or Escape during text composition',()=>{
  const h=harness(),dispose=mountFormHelper(h.wizard,{step:0});h.launch();h.action('focus');assert.equal(h.doc.dispatch('keydown',{key:'ArrowLeft'}).prevented,undefined);assert.equal(h.doc.dispatch('keydown',{key:'Escape',isComposing:true}).prevented,undefined);assert.ok(h.card());dispose();
});

test('integration includes CSS and cleanup, non-modal semantics and motion/print fallbacks',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/form-helper.css',import.meta.url),'utf8');assert.match(app,/function render\(\)\{disposeHelper\(\)/);assert.match(index,/form-helper\.css/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/@media print/);
  const h=harness(),dispose=mountFormHelper(h.wizard,{step:0});h.launch();assert.equal(h.card().getAttribute('role'),'region');assert.equal(h.card().getAttribute('aria-modal'),null);assert.match(h.card().innerHTML,/type="button"/);dispose();
});

test('optional map, geo and CSV guidance discloses fallback and avoids double correction',()=>{
  const items=walkthroughSteps({step:1,geo:true,hourlyData:{productionKwhPerKwp:[1]}});
  assert.match(items.find(i=>i.id==='map').hint,/Opsional/);assert.match(items.find(i=>i.id==='geo-link').hint,/Tanpa ini/);assert.match(items.find(i=>i.id==='solar-source').hint,/horizontal/);assert.match(items.find(i=>i.id==='yield').description,/tidak dapat diedit/);assert.equal(items.find(i=>i.id==='hourly').selector,'#hourly-file');assert.match(items.find(i=>i.id==='hourly').hint,/Matikan hubungan geografis/);
});

test('validation errors receive their own highlighted recovery step',()=>{
  const h=harness(['#year']);const alert=new NodeStub(h.doc);alert.className='notice error';h.form.append(alert);h.wizard.selectors.set('.notice.error',alert);
  const s=createWalkthroughSession();s.active=true;s.stage=0;s.id='year';const dispose=mountFormHelper(h.wizard,{step:0,errors:['year: invalid']},s);assert.equal(s.id,'validation');assert.ok(alert.classList.contains('walkthrough-target'));h.action('next');assert.equal(s.id,'year');dispose();
});

test('visual keyboard resizing reserves space for a field instead of covering the whole viewport',()=>{
  const h=harness();h.win.visualViewport=new NodeStub(h.doc);h.win.visualViewport.height=360;h.win.visualViewport.offsetTop=0;
  const dispose=mountFormHelper(h.wizard,{step:0});h.launch();h.flush();assert.equal(h.card().style.maxHeight,'220px');assert.equal(h.card().style.bottom,'552px');dispose();assert.equal(h.win.visualViewport.listeners.get('resize').size,0);
});
