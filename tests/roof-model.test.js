import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ROOF,ROOF_TYPES,normalizeRoof,roofGeometry,layoutPanels} from '../src/roof-model.js';
import {sceneGeometry} from '../src/roof-renderer.js';
import {DEFAULT_INPUT} from '../src/domain.js';

const types = Object.keys(ROOF_TYPES);
const dimensions = [[4,4],[8,10],[10,8],[12,12],[20,24],[20,4],[4,24]];
const epsilon = 1e-8;
const minus = (a,b) => a.map((n,i) => n-b[i]);
const dot = (a,b) => a.reduce((sum,n,i) => sum+n*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const close = (actual,expected,message) => assert.ok(Math.abs(actual-expected)<epsilon,`${message}: ${actual} != ${expected}`);
const finitePoint = p => {assert.equal(p.length,3);assert.ok(p.every(Number.isFinite));};
function freezeDeep(value) {
  if(value && typeof value==='object') {Object.values(value).forEach(freezeDeep);Object.freeze(value);}
  return value;
}
function checkFace(points) {
  assert.ok(points.length>=3);
  points.forEach(finitePoint);
  // The renderer triangulates as a fan. Check every resulting triangle.
  for(let i=1;i<points.length-1;i++) assert.ok(Math.hypot(...cross(minus(points[i],points[0]),minus(points[i+1],points[0])))>epsilon,'nondegenerate fan triangle');
}
function checkContained(corner,polygon,margin) {
  // Independent convex half-plane test, avoiding the production pointInside helper.
  const area2 = polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const inwardDistance=Math.sign(area2)*(dx*(corner[1]-a[1])-dy*(corner[0]-a[0]))/Math.hypot(dx,dy);
    assert.ok(inwardDistance>=margin-epsilon,'panel corner respects every roof edge inset');
  }
}

test('roof normalization supplies defaults and clamps finite dimensions without coercing strings',()=>{
  for(const raw of [undefined,null,[],false,'gable',{}]) assert.deepEqual(normalizeRoof(raw),DEFAULT_ROOF);
  assert.deepEqual(normalizeRoof({type:'unknown',width:-1,length:100,pitch:90,panels:9.6,orientation:'landscape',surface:'d'}),
    {...DEFAULT_ROOF,width:4,length:24,pitch:45,panels:10,orientation:'landscape',surface:'d'});
  assert.deepEqual(normalizeRoof({width:'12',length:Infinity,pitch:NaN,panels:'24',surface:'<script>',orientation:'invalid'}),DEFAULT_ROOF);
  assert.deepEqual(normalizeRoof({width:100,length:-1,pitch:-1,panels:500}),{...DEFAULT_ROOF,width:20,length:4,pitch:10,panels:300});
  assert.equal(normalizeRoof({panels:-100}).panels,0);
  assert.notEqual(normalizeRoof(DEFAULT_ROOF),DEFAULT_ROOF);
});

for(const type of types) {
  test(`${type}: finite, planar, nondegenerate geometry at boundary and rectangular dimensions`,()=>{
    for(const [width,length] of dimensions) for(const pitch of [10,28,45]) {
      const roof=roofGeometry({type,width,length,pitch});
      assert.equal(roof.surfaces.length,{flat:1,gable:2,hip:4,l:2}[type]);
      assert.equal(new Set(roof.surfaces.map(s=>s.id)).size,roof.surfaces.length);
      close(roof.footprintArea,width*length*(type==='l'?1-.45*.45:1),'footprint area');
      close(Math.max(...roof.footprint.map(p=>p[0]))-Math.min(...roof.footprint.map(p=>p[0])),width,'width');
      close(Math.max(...roof.footprint.map(p=>p[1]))-Math.min(...roof.footprint.map(p=>p[1])),length,'length');
      const rise=(type==='gable'?width/2:type==='hip'?Math.min(width,length)/2:0)*Math.tan(pitch*Math.PI/180);
      close(roof.height,3.2+rise,'height');
      assert.equal(roof.walls.length,type==='l'?6:4);
      assert.equal(roof.gables.length,type==='gable'?2:0);
      [...roof.walls,...roof.gables].forEach(checkFace);
      for(const s of roof.surfaces) {
        checkFace(s.points);
        for(const axis of [s.normal,s.u,s.v]) close(Math.hypot(...axis),1,'unit frame');
        close(dot(s.u,s.v),0,'orthogonal axes');
        assert.ok(s.normal[1]>0);
        s.points.forEach((p,i)=>{
          const relative=minus(p,s.origin);
          close(dot(relative,s.normal),0,'planar face');
          close(dot(relative,s.u),s.polygon[i][0],'local u coordinate');
          close(dot(relative,s.v),s.polygon[i][1],'local v coordinate');
        });
      }
    }
  });
  test(`${type}: panel rectangles fit on their selected surface with the stated inset`,()=>{
    for(const [width,length] of dimensions) for(const orientation of ['portrait','landscape']) for(const area of [.1,2.6,10]) {
      const roof=roofGeometry({type,width,length,pitch:28});
      const layout=layoutPanels(roof,300,area,orientation);
      close(layout.panelWidth*layout.panelHeight,area,'module area');
      close(Math.max(layout.panelWidth,layout.panelHeight)/Math.min(layout.panelWidth,layout.panelHeight),1.7,'module aspect ratio');
      assert.equal(layout.panels.length,layout.shown);
      assert.equal(layout.shown,Math.min(layout.wanted,layout.available));
      assert.equal(layout.unshown,layout.wanted-layout.shown);
      for(const panel of layout.panels) {
        const s=roof.surfaces.find(s=>s.id===panel.surface);
        assert.ok(s);checkFace(panel.points);
        panel.corners.forEach((corner,i)=>{
          checkContained(corner,s.polygon,layout.margin);
          const relative=minus(panel.points[i],s.origin);
          close(dot(relative,s.normal),.045,'panel lift');
          close(dot(relative,s.u),corner[0],'panel u coordinate');
          close(dot(relative,s.v),corner[1],'panel v coordinate');
        });
      }
      for(const s of roof.surfaces) {
        const single=layoutPanels(roof,300,area,orientation,s.id);
        assert.ok(single.panels.every(p=>p.surface===s.id));
        assert.ok(single.available<=layout.available);
      }
    }
  });
  test(`${type}: full rendered scene contains finite nondegenerate faces`,()=>{
    const roof=roofGeometry({type});
    const scene=sceneGeometry(roof,layoutPanels(roof,12));
    assert.ok(scene.faces.length>roof.surfaces.length);
    scene.faces.forEach(f=>{checkFace(f.points);assert.ok(f.color.every(Number.isFinite));});
    scene.lines.forEach(l=>{l.points.forEach(finitePoint);assert.ok(Math.hypot(...minus(...l.points))>epsilon);});
  });
}

test('requested versus shown counts are exact when fitting, overflowing, absent or invalid',()=>{
  const roof=roofGeometry({type:'flat',width:8,length:10});
  const capacity=layoutPanels(roof,300).available;
  assert.ok(capacity>1 && capacity<300);
  for(const count of [0,1,capacity,capacity+1,300]) {
    const result=layoutPanels(roof,count);
    assert.equal(result.wanted,count);
    assert.equal(result.shown,Math.min(count,capacity));
    assert.equal(result.unshown,Math.max(0,count-capacity));
    assert.equal(result.panels.length,result.shown);
  }
  for(const count of [NaN,Infinity,undefined,null,'12',-1]) assert.equal(layoutPanels(roof,count).wanted,0);
  assert.equal(layoutPanels(roof,4.6).wanted,5);
  assert.equal(layoutPanels(roof,999).wanted,300);
  const missing=layoutPanels(roof,12,2.6,'portrait','d');
  assert.equal(missing.shown,0);assert.equal(missing.unshown,12);
  const portrait=layoutPanels(roof,12,2.6,'portrait'),landscape=layoutPanels(roof,12,2.6,'landscape');
  close(portrait.panelWidth,landscape.panelHeight,'rotated width');
  close(portrait.panelHeight,landscape.panelWidth,'rotated height');
});

test('visual geometry, panel layout and renderer preserve frozen numerical inputs and geometry',()=>{
  const numerical=freezeDeep(structuredClone(DEFAULT_INPUT));
  const before=structuredClone(numerical);
  const visual=freezeDeep({...DEFAULT_ROOF,type:'hip',width:12,length:8});
  for(const config of [numerical,visual]) {
    const original=structuredClone(config);
    const roof=freezeDeep(roofGeometry(config));
    const geometryBefore=structuredClone(roof);
    const layout=freezeDeep(layoutPanels(roof,30,numerical.panelArea));
    sceneGeometry(roof,layout);
    assert.deepEqual(config,original);
    assert.deepEqual(roof,geometryBefore);
  }
  assert.deepEqual(numerical,before);
});
