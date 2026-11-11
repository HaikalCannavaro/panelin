/** Optional geometric production proxy. No weather/irradiance accuracy claim.
 * See docs/GEO-PRODUCTION.md for reference semantics and limitations. */
import {solarPosition,TIMEZONES} from './sun-model.js';
import {roofGeometry,ROOF_TYPES} from './roof-model.js';
export const GEO_MODEL_VERSION='geometric-poa-proxy-1.0';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const inRange=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
/** Strict input validation: optional means null/undefined, never guessed coordinates. */
export function validateGeo(geo){
 if(geo==null)return [];
 if(!object(geo))return ['geo: wajib objek atau null.'];
 const errors=[];
 const known=['latitude','longitude','heading','roof','diffuseFraction','albedo','additionalLoss'];
 for(const k of Object.keys(geo))if(!known.includes(k))errors.push(`geo.${k}: field tidak dikenal.`);
 for(const [k,min,max] of [['latitude',-90,90],['longitude',-180,180],['heading',0,359],['diffuseFraction',0,1],['albedo',0,1],['additionalLoss',0,1]])if(!inRange(geo[k],min,max))errors.push(`geo.${k}: wajib angka finite ${min}–${max}.`);
 if(!Number.isInteger(geo.heading))errors.push('geo.heading: wajib derajat bilangan bulat.');
 const r=geo.roof;
 if(!object(r))errors.push('geo.roof: wajib objek.');
 else {
  for(const k of Object.keys(r))if(!['type','width','length','pitch','orientation','surface','panels'].includes(k))errors.push(`geo.roof.${k}: field tidak dikenal.`);
  if(!Object.hasOwn(ROOF_TYPES,r.type))errors.push('geo.roof.type: bentuk atap tidak dikenal.');
  for(const [k,min,max] of [['width',4,20],['length',4,24],['pitch',10,45]])if(!inRange(r[k],min,max))errors.push(`geo.roof.${k}: wajib angka finite ${min}–${max}.`);
  if(r.panels!==undefined&&(!inRange(r.panels,0,300)||!Number.isInteger(r.panels)))errors.push('geo.roof.panels: wajib bilangan bulat 0–300.');
  if(!['portrait','landscape'].includes(r.orientation))errors.push('geo.roof.orientation: orientasi panel tidak dikenal.');
  const faces={flat:['a'],l:['a','b'],gable:['a','b'],hip:['a','b','c','d']}[r.type]||[];
  if(r.surface!=='all'&&!faces.includes(r.surface))errors.push('geo.roof.surface: bidang tidak tersedia pada bentuk atap ini.');
 }
 return errors;
}
function polygonArea(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;}
/** Selected 3D faces define equal module density per roof area, not a packing simulation. */
export function geographicSurfaces(geo){
 const errors=validateGeo(geo);if(errors.length)throw new Error(errors.join('\n'));if(geo==null)return [];
 const faces=roofGeometry(geo.roof).surfaces.filter(s=>geo.roof.surface==='all'||s.id===geo.roof.surface).map(s=>({id:s.id,normal:[...s.normal],area:polygonArea(s.polygon)}));
 const total=faces.reduce((n,s)=>n+s.area,0);
 if(!(total>0))throw new Error('Luas bidang geografis harus positif.');
 return faces.map(s=>({...s,weight:s.area/total,tilt:Math.acos(Math.max(-1,Math.min(1,s.normal[1])))*180/Math.PI}));
}
/** One daylight sample, in the shared roof-local coordinates. Unitless proxies. */
export function geographicSample(direction,surfaces,diffuseFraction,albedo){
 const up=direction[1];if(up<=0)return {horizontal:0,poa:0};
 // GHI proxy = cos(zenith); DHI = d*GHI; DNI = (1-d).
 const horizontal=up,diffuse=diffuseFraction*horizontal;
 let poa=0;
 for(const s of surfaces){
  const cosine=Math.max(0,s.normal.reduce((v,n,j)=>v+n*direction[j],0));
  const sky=(1+s.normal[1])/2,ground=(1-s.normal[1])/2;
  poa+=s.weight*((1-diffuseFraction)*cosine+diffuse*sky+horizontal*albedo*ground);
 }
 return {horizontal,poa};
}
/** Full calendar year hourly kWh/kWp, normalized against horizontal-reference AC yield.
 * panelCount is intentionally irrelevant: area fractions scale all installed capacity.
 * No layout truncation or feasibility promise is made by this production model. */
export function estimateGeographicProduction(input,timeline,_panelCount){
 const geo=input?.geo;if(geo==null)return null;
 const errors=validateGeo(geo);
 if(!Number.isInteger(input.year)||!inRange(input.year,2000,2100))errors.push('geo: tahun wajib 2000–2100.');
 if(!Object.hasOwn(TIMEZONES,input.timezone))errors.push('geo: zona waktu Indonesia tidak valid.');
 if(!Array.isArray(input.monthlyYield)||input.monthlyYield.length!==12||input.monthlyYield.some(v=>!inRange(v,0,500)))errors.push('geo: yield referensi wajib 12 angka 0–500.');
 if(errors.length)throw new Error(errors.join('\n'));
 const expectedLength=(new Date(Date.UTC(input.year,2,0)).getUTCDate()===29?366:365)*24;
 if(!Array.isArray(timeline)||timeline.length!==expectedLength)throw new Error('geo: timeline wajib satu tahun kalender lengkap.');
 const surfaces=geographicSurfaces(geo),horizontalTotals=Array(12).fill(0),poaTotals=Array(12).fill(0),raw=[];
 const start=Date.UTC(input.year,0,1);
 for(let index=0;index<timeline.length;index++){
  const t=timeline[index],expected=new Date(start+index*3600000),date=expected.toISOString().slice(0,10);
  if(!t||t.date!==date||t.hour!==expected.getUTCHours()||t.month!==expected.getUTCMonth())throw new Error('geo: tanggal/jam timeline tidak konsisten.');
  let horizontal=0,poa=0;
  for(const midpoint of [5,15,25,35,45,55]){
   const sun=solarPosition({latitude:geo.latitude,longitude:geo.longitude,heading:geo.heading,timezone:input.timezone,date:t.date,minutes:t.hour*60+midpoint});
   const sample=geographicSample(sun.localDirection,surfaces,geo.diffuseFraction,geo.albedo);
   horizontal+=sample.horizontal/6;poa+=sample.poa/6;
  }
  horizontalTotals[t.month]+=horizontal;poaTotals[t.month]+=poa;raw.push(poa);
 }
 for(let m=0;m<12;m++)if(horizontalTotals[m]===0&&input.monthlyYield[m]>0)throw new Error(`geo: tidak ada matahari pada bulan ${m+1}; yield referensi positif tidak dapat dinormalisasi.`);
 const loss=1-geo.additionalLoss;
 const monthlyMultipliers=horizontalTotals.map((h,m)=>h?poaTotals[m]/h*loss:0);
 const productionWeights=raw.map((v,j)=>{const m=timeline[j].month;return horizontalTotals[m]?v/horizontalTotals[m]*input.monthlyYield[m]*loss:0;});
 return {productionWeights,monthlyMultipliers,metadata:{model:GEO_MODEL_VERSION,source:'NOAA/Meeus solar geometry; Sandia PVPMC isotropic transposition formulas; user scenario inputs',method:'NOAA solar geometry; six 10-minute midpoint samples/hour; isotropic POA proxy',reference:'monthlyYield: horizontal-reference AC kWh/kWp/month, before optional additionalLoss',surfaceWeighting:'selected-roof-face-area; uniform installed kWp per roof area; independent of visual packing',surfaces,assumptions:{diffuseFraction:geo.diffuseFraction,albedo:geo.albedo,additionalLoss:geo.additionalLoss},limitations:['Not measured irradiance or a weather forecast.','No clouds, temperature, terrain, obstruction or inter-panel shading, inverter clipping or structural feasibility.','Linear irradiation-to-AC scaling; no measured production accuracy validation.']}};
}
