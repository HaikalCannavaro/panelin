import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateGeographicProduction,validateGeo,geographicSurfaces,geographicSample} from '../src/geo-production.js';
import {createTimeline} from '../src/domain.js';
import {solarPosition} from '../src/sun-model.js';
const base=()=>({year:2025,timezone:'Asia/Jakarta',monthlyYield:Array(12).fill(120),geo:{latitude:-6.9,longitude:107.6,heading:180,roof:{type:'gable',width:8,length:10,pitch:28,orientation:'portrait',surface:'a'},diffuseFraction:.5,albedo:.2,additionalLoss:0}});
const run=i=>estimateGeographicProduction(i,createTimeline(i.year,i.timezone));
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('optional geography never invents coordinates',()=>{assert.equal(estimateGeographicProduction({geo:null},[]),null);assert.equal(estimateGeographicProduction({},[]),null);assert.deepEqual(validateGeo(null),[]);assert.ok(validateGeo({}).length);});
test('strict geography rejects malformed, unknown, nonfinite and out-of-range inputs',()=>{
 for(const key of ['latitude','longitude','heading','diffuseFraction','albedo','additionalLoss'])for(const value of [NaN,Infinity,'1',null,undefined]){const i=base();i.geo[key]=value;assert.ok(validateGeo(i.geo).length,key);assert.throws(()=>run(i));}
 for(const [key,value] of [['latitude',91],['longitude',181],['heading',360],['diffuseFraction',-1],['albedo',1.1],['additionalLoss',1.1],['extra',1]]){const i=base();i.geo[key]=value;assert.ok(validateGeo(i.geo).length);}
 for(const [key,value] of [['width',3],['length',25],['pitch',46],['surface','c'],['type','other'],['orientation','other'],['panels',1.5]]){const i=base();i.geo.roof[key]=value;assert.ok(validateGeo(i.geo).length);}
 const i=base();i.geo.roof.panels=300;assert.deepEqual(validateGeo(i.geo),[]);
});
test('horizontal roof exactly preserves each reference monthly yield without additional losses',()=>{
 const i=base();i.geo.roof.type='flat';const result=run(i),timeline=createTimeline(i.year,i.timezone),totals=Array(12).fill(0);
 result.productionWeights.forEach((v,j)=>totals[timeline[j].month]+=v);totals.forEach((v,m)=>close(v,i.monthlyYield[m]));result.monthlyMultipliers.forEach(v=>close(v,1));
});
test('production never leaks into a fully astronomical nighttime hour',()=>{
 const i=base(),r=run(i),timeline=createTimeline(i.year,i.timezone);
 let nights=0,days=0;
 for(let j=0;j<timeline.length;j++){const t=timeline[j];const lit=[5,15,25,35,45,55].some(offset=>solarPosition({...i.geo,timezone:i.timezone,date:t.date,minutes:t.hour*60+offset}).daylight);if(!lit){assert.equal(r.productionWeights[j],0);nights++;}else {assert.ok(r.productionWeights[j]>0);days++;}}
 assert.ok(nights>3000&&days>3000);
});
test('face headings agree with roof local coordinate mapping and symmetric faces',()=>{
 const i=base(),s=geographicSurfaces(i.geo);assert.ok(s[0].normal[0]<0);
 const west=[-1/Math.sqrt(2),1/Math.sqrt(2),0],east=[-west[0],west[1],0];
 assert.ok(geographicSample(west,s,0,0).poa>geographicSample(east,s,0,0).poa);
 const first=run(i);i.geo.heading=0;i.geo.roof.surface='b';const opposite=run(i);
 first.productionWeights.forEach((v,j)=>close(v,opposite.productionWeights[j]));
 i.geo.roof.surface='all';const both=run(i);i.geo.heading=180;const rotated=run(i);both.productionWeights.forEach((v,j)=>close(v,rotated.productionWeights[j]));
});
test('location, heading, year and timezone affect production profile',()=>{
 const original=run(base());
 for(const change of [i=>i.geo.latitude=45,i=>i.geo.longitude=120,i=>i.geo.heading=90,i=>i.year=2024,i=>i.timezone='Asia/Jayapura']){const i=base();change(i);const r=run(i);assert.notDeepEqual(r.productionWeights,original.productionWeights);assert.ok(r.productionWeights.every(v=>Number.isFinite(v)&&v>=0));if(i.year===2024)assert.equal(r.productionWeights.length,8784);}
});
test('additional loss scales hourly production once and is monotone',()=>{
 const i=base(),a=run(i);i.geo.additionalLoss=.2;const b=run(i);a.productionWeights.forEach((v,j)=>close(b.productionWeights[j],.8*v));i.geo.additionalLoss=1;assert.ok(run(i).productionWeights.every(v=>v===0));
});
test('selected area fractions sum to one with no capacity truncated by drawing',()=>{
 for(const type of ['flat','gable','hip','l']){const i=base();i.geo.roof.type=type;i.geo.roof.surface='all';close(geographicSurfaces(i.geo).reduce((sum,s)=>sum+s.weight,0),1);}
 const i=base(),t=createTimeline(i.year,i.timezone);assert.deepEqual(estimateGeographicProduction(i,t,1),estimateGeographicProduction(i,t,10000));
});
test('polar day/night stays physical and impossible positive reference months are rejected',()=>{
 const i=base();i.geo.latitude=90;i.monthlyYield=Array(12).fill(0);i.monthlyYield[5]=120;i.geo.roof.type='flat';const result=run(i),t=createTimeline(i.year,i.timezone);
 assert.ok(result.productionWeights.every((v,j)=>t[j].month===5?v>0:v===0));
 i.monthlyYield[11]=120;assert.throws(()=>run(i),/tidak ada matahari/);
});
test('full calendar, dates and timezone are mandatory',()=>{
 const i=base(),t=createTimeline(i.year,i.timezone);assert.throws(()=>estimateGeographicProduction(i,t.slice(1)),/kalender/);t[0]={...t[0],date:'2025-01-02'};assert.throws(()=>estimateGeographicProduction(i,t),/konsisten/);i.timezone='UTC';assert.throws(()=>estimateGeographicProduction(i,t),/zona waktu/);
});
