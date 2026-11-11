import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SUN,TIMEZONES,normalizeSun,solarPosition,incidenceCosine,projectedShadow,dailySunPath} from '../src/sun-model.js';
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≈ ${expected} ±${tolerance}`);

test('explicit Bandung sample and all nested public data are immutable',()=>{
  assert.deepEqual(normalizeSun(),DEFAULT_SUN);
  assert.equal(DEFAULT_SUN.minutes,540);
  assert.equal(TIMEZONES['Asia/Jakarta'].offset,7);
  assert.ok(Object.isFrozen(TIMEZONES['Asia/Jakarta']));
  const p=solarPosition();
  assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.config)&&Object.isFrozen(p.localDirection));
  assert.ok(p.daylight&&p.worldDirection[0]>0);
  near(Math.hypot(...p.worldDirection),1);
});
test('normalization clamps finite numbers and rejects malformed dates/types',()=>{
  for(const v of [null,[],false,42])assert.deepEqual(normalizeSun(v),DEFAULT_SUN);
  for(const date of ['2026-02-29','2100-02-29','2026-04-31','1999-12-31','2101-01-01','2026-1-01','garbage'])assert.equal(normalizeSun({date}).date,DEFAULT_SUN.date);
  for(const date of ['2000-02-29','2024-02-29','2100-12-31'])assert.equal(normalizeSun({date}).date,date);
  const c=normalizeSun({latitude:99,longitude:-200,minutes:1440,heading:360,timezone:'UTC'});
  assert.deepEqual(c,{...DEFAULT_SUN,latitude:90,longitude:-180,minutes:1439,heading:359});
  assert.equal(normalizeSun({minutes:60.7}).minutes,61);
  assert.deepEqual(normalizeSun({latitude:NaN,longitude:Infinity,minutes:'540',heading:null}),DEFAULT_SUN);
});
test('NREL SPA reference case agrees within visualization tolerance',()=>{
  // Reda & Andreas, NREL/TP-560-34302 Table A5.1:
  // 2003-10-17 12:30:30 MST = 2003-10-18 02:30:30 WIB,
  // latitude 39.742476, longitude -105.1786. Table topocentric declination
  // -9.316179° and hour angle 11.10629° imply geometric e0≈39.87205°,
  // azimuth=194.340241°. Our minute UI rounds down 30 seconds;
  // intentionally allow 0.2° for that timing difference and simpler algorithm.
  // https://www.nrel.gov/docs/fy08osti/34302.pdf
  // Accessible primary-report archive: https://digital.library.unt.edu/ark:/67531/metadc1416160/m2/1/high_res_d/15003974.pdf
  const p=solarPosition({latitude:39.742476,longitude:-105.1786,date:'2003-10-18',minutes:150});
  near(p.elevation,39.872046,0.2);
  near(p.azimuth,194.340241,0.2);
});
test('equinox equator noon, east morning, west evening and night',()=>{
  const base={latitude:0,longitude:105,date:'2026-03-20'};
  const noon=solarPosition({...base,minutes:720});
  assert.ok(noon.elevation>87&&noon.elevation<90);
  assert.ok(solarPosition({...base,minutes:540}).worldDirection[0]>0);
  assert.ok(solarPosition({...base,minutes:900}).worldDirection[0]<0);
  const night=solarPosition({...base,minutes:0});
  assert.ok(!night.daylight&&night.elevation< -85);
  assert.equal(night.incidenceCosine(night.localDirection),0);
});
test('seasonal declination and polar night/day remain finite',()=>{
  const june=solarPosition({date:'2026-06-21',latitude:90,minutes:720});
  const december=solarPosition({date:'2026-12-21',latitude:90,minutes:720});
  near(june.declination,23.44,0.05);
  near(december.declination,-23.44,0.05);
  assert.ok(june.daylight&&!december.daylight);
  for(const p of [june,december,solarPosition({latitude:-90})])assert.ok(Number.isFinite(p.elevation)&&Number.isFinite(p.azimuth));
});
test('timezone conversion preserves instant including UTC date crossing',()=>{
  const a=solarPosition({date:'2026-11-11',minutes:0,timezone:'Asia/Jakarta'});
  for(const [timezone,minutes] of [['Asia/Makassar',60],['Asia/Jayapura',120]]) {
    const b=solarPosition({date:'2026-11-11',minutes,timezone});
    near(a.elevation,b.elevation);near(a.azimuth,b.azimuth);
    assert.equal(a.utcMilliseconds,b.utcMilliseconds);
  }
  assert.equal(new Date(a.utcMilliseconds).toISOString(),'2026-11-10T17:00:00.000Z');
  const west=solarPosition({longitude:-180}),east=solarPosition({longitude:180});
  near(west.elevation,east.elevation);near(west.azimuth,east.azimuth);
});
test('building heading rotates horizontal axes without changing sky geometry',()=>{
  const south=solarPosition({heading:180}),north=solarPosition({heading:0}),east=solarPosition({heading:90});
  near(south.localDirection[0],south.worldDirection[0]);
  near(south.localDirection[2],-south.worldDirection[2]);
  near(north.localDirection[0],-south.localDirection[0]);
  near(north.localDirection[2],-south.localDirection[2]);
  near(east.localDirection[2],south.worldDirection[0]);
  near(east.elevation,south.elevation);near(east.azimuth,south.azimuth);
});
test('incidence is normalized, nonnegative and zero at night',()=>{
  near(incidenceCosine([0,2,0],[0,4,0]),1);
  near(incidenceCosine([0,1,0],[1,1,0]),Math.SQRT1_2);
  assert.equal(incidenceCosine([-1,0,0],[1,1,0]),0);
  for(const v of [[0,0,0],[NaN,1,0],null])assert.equal(incidenceCosine(v,[1,1,0]),0);
  assert.equal(incidenceCosine([0,-1,0],[0,-1,0]),0);
});
test('ground shadows extend opposite sun and suppress horizon singularity',()=>{
  const points=[[0,3,0],[2,3,0]];
  assert.deepEqual(projectedShadow(points,[1,1,0],0),[[-3,0,0],[-1,0,0]]);
  assert.deepEqual(points,[[0,3,0],[2,3,0]]);
  assert.equal(projectedShadow(points,[1,0,0]),null);
  assert.equal(projectedShadow(points,[1,0.001,0]),null);
  assert.equal(projectedShadow(points,[Math.cos(3*Math.PI/180),Math.sin(3*Math.PI/180),0]),null);
  assert.equal(projectedShadow(points,[0,-1,0]),null);
  assert.equal(projectedShadow([[0,-2,0]],[1,1,0]),null);
  assert.equal(projectedShadow([], [1,1,0]),null);
  assert.deepEqual(projectedShadow(points,[0,1,0],0),[[0,0,0],[2,0,0]]);
});
test('daily path is immutable and preserves configuration',()=>{
  const path=dailySunPath({date:'2026-06-21',heading:90},60);
  assert.equal(path.length,24);
  assert.ok(Object.isFrozen(path));
  assert.equal(path[12].config.minutes,720);
  assert.equal(path[12].config.heading,90);
  assert.ok(path.some(p=>p.daylight)&&path.some(p=>!p.daylight));
});
