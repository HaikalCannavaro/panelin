/** Roof geometry shared by the illustration and optional geographic energy proxy.
 * Geometry is simplified; neither path validates structural or physical fit. */
export const ROOF_TYPES = Object.freeze({flat:'Datar',gable:'Pelana',hip:'Limas',l:'Bentuk L'});
export const DEFAULT_ROOF = Object.freeze({type:'gable',width:8,length:10,pitch:28,panels:12,orientation:'portrait',surface:'all'});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const finite=(v,fallback,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):fallback;
export function normalizeRoof(value={}) {
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {type:Object.hasOwn(ROOF_TYPES,v.type)?v.type:DEFAULT_ROOF.type,
    width:finite(v.width,8,4,20),length:finite(v.length,10,4,24),pitch:finite(v.pitch,28,10,45),
    panels:Math.round(finite(v.panels,12,0,300)),orientation:v.orientation==='landscape'?'landscape':'portrait',
    surface:['all','a','b','c','d'].includes(v.surface)?v.surface:'all'};
}
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const scale=(a,n)=>a.map(v=>v*n);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>scale(v,1/(Math.hypot(...v)||1));
function surface(id,label,points) {
  const u=unit(sub(points[1],points[0]));
  let normal=unit(cross(u,sub(points[2],points[0])));
  if(normal[1]<0)normal=scale(normal,-1);
  const v=unit(cross(normal,u));
  return {id,label,points,origin:points[0],u,v,normal,polygon:points.map(p=>[dot(sub(p,points[0]),u),dot(sub(p,points[0]),v)])};
}
export function roofGeometry(raw) {
  const config=normalizeRoof(raw),{width:w,length:l,type,pitch}=config,h=3.2;
  const at=(x,z,y=h)=>[x,y,z],x=w/2,z=l/2,t=Math.tan(pitch*Math.PI/180);
  let footprint=[[-x,-z],[x,-z],[x,z],[-x,z]],surfaces=[],gables=[];
  if(type==='flat')surfaces=[surface('a','Bidang A', [at(-x,-z),at(x,-z),at(x,z),at(-x,z)])];
  if(type==='l'){
    const cutX=w*.05,cutZ=l*.05;
    footprint=[[-x,-z],[x,-z],[x,cutZ],[cutX,cutZ],[cutX,z],[-x,z]];
    surfaces=[surface('a','Sayap A',[at(-x,-z),at(x,-z),at(x,cutZ),at(-x,cutZ)]),surface('b','Sayap B',[at(-x,cutZ),at(cutX,cutZ),at(cutX,z),at(-x,z)])];
  }
  if(type==='gable'){
    const r=h+x*t;
    surfaces=[surface('a','Bidang A',[at(-x,-z),at(0,-z,r),at(0,z,r),at(-x,z)]),surface('b','Bidang B',[at(0,-z,r),at(x,-z),at(x,z),at(0,z,r)])];
    gables=[[at(-x,-z),at(x,-z),at(0,-z,r)],[at(x,z),at(-x,z),at(0,z,r)]];
  }
  if(type==='hip'){
    const rise=Math.min(x,z)*t;
    const r1=x<=z?at(0,-z+x,h+rise):at(-x+z,0,h+rise);
    const r2=x<=z?at(0,z-x,h+rise):at(x-z,0,h+rise);
    const a=at(-x,-z),b=at(x,-z),c=at(x,z),d=at(-x,z);
    const faces=x<=z?[[a,b,r1],[b,c,r2,r1],[c,d,r2],[d,a,r1,r2]]:[[a,b,r2,r1],[b,c,r2],[c,d,r1,r2],[d,a,r1]];
    surfaces=faces.map((p,i)=>surface('abcd'[i],'Bidang '+'ABCD'[i],p.filter((v,j)=>j===0||Math.hypot(...sub(v,p[j-1]))>1e-8)));
  }
  const walls=footprint.map((p,i)=>{const q=footprint[(i+1)%footprint.length];return [[p[0],0,p[1]],[q[0],0,q[1]],[q[0],h,q[1]],[p[0],h,p[1]]];});
  const footprintArea=Math.abs(footprint.reduce((s,p,i)=>{const q=footprint[(i+1)%footprint.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
  return {config,footprint,footprintArea,walls,gables,surfaces,height:Math.max(...surfaces.flatMap(s=>s.points.map(p=>p[1])))};
}
function edgeDistance(p,a,b){const d=[b[0]-a[0],b[1]-a[1]],t=clamp(((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]**2+d[1]**2||1),0,1);return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);}
export function pointInside(p,poly,margin=0){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside&&poly.every((a,i)=>edgeDistance(p,a,poly[(i+1)%poly.length])>=margin-1e-8);
}
/** Rectangular grid on planar roof faces, with illustrative 0.4 m edge inset and 0.12 m gaps.
 * The assumed module aspect ratio (1:1.7) is NOT a manufacturer specification. */
export function layoutPanels(geometry,count,panelArea=2.6,orientation='portrait',selectedSurface='all') {
  const wanted=Math.round(finite(count,0,0,300)),area=finite(panelArea,2.6,.1,10),short=Math.sqrt(area/1.7),long=short*1.7;
  const pw=orientation==='landscape'?long:short,ph=orientation==='landscape'?short:long;
  const slots=[],margin=.4,gap=.12;
  for(const s of geometry.surfaces){
    if(selectedSurface!=='all'&&s.id!==selectedSurface)continue;
    const xs=s.polygon.map(p=>p[0]),ys=s.polygon.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const cols=Math.max(0,Math.floor((maxX-minX-2*margin+gap)/(pw+gap))),rows=Math.max(0,Math.floor((maxY-minY-2*margin+gap)/(ph+gap)));
    const sx=(minX+maxX-(cols*pw+Math.max(0,cols-1)*gap))/2,sy=(minY+maxY-(rows*ph+Math.max(0,rows-1)*gap))/2;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=sx+col*(pw+gap),y=sy+row*(ph+gap),corners=[[x,y],[x+pw,y],[x+pw,y+ph],[x,y+ph]];
      if(corners.every(p=>pointInside(p,s.polygon,margin))){
        const points=corners.map(([a,b])=>add(add(add(s.origin,scale(s.u,a)),scale(s.v,b)),scale(s.normal,.045)));
        slots.push({surface:s.id,corners,points,normal:s.normal});
      }
    }
  }
  // Spread across available faces before moving to the next row, for readable sketches.
  const groups=geometry.surfaces.map(s=>slots.filter(p=>p.surface===s.id));
  const ordered=[];for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])ordered.push(group[i]);
  return {panels:ordered.slice(0,wanted),wanted,shown:Math.min(wanted,slots.length),available:slots.length,unshown:Math.max(0,wanted-slots.length),panelWidth:pw,panelHeight:ph,margin,gap};
}
