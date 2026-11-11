/**
 * Approximate solar geometry for visualization, 2000–2100.
 * NOAA/Meeus Julian-century equations, east-positive longitude:
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * https://gml.noaa.gov/grad/solcalc/main.js
 * Geometric solar-center elevation: no atmospheric refraction, terrain,
 * weather, irradiance, or energy-yield prediction. Not survey-grade.
 * Dates/times are explicit local civil time, never host-browser timezone.
 */
export const TIMEZONES = Object.freeze({
  'Asia/Jakarta': Object.freeze({offset:7,label:'WIB (UTC+7)'}),
  'Asia/Makassar': Object.freeze({offset:8,label:'WITA (UTC+8)'}),
  'Asia/Jayapura': Object.freeze({offset:9,label:'WIT (UTC+9)'})
});
export const DEFAULT_SUN = Object.freeze({latitude:-6.9175,longitude:107.6191,timezone:'Asia/Jakarta',date:'2026-11-11',minutes:540,heading:180});
const rad=Math.PI/180, deg=180/Math.PI;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrap=(v,n=360)=>((v%n)+n)%n;
const finite=(v,d,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):d;
function validDate(v) {
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const [y,m,d]=v.split('-').map(Number);
  return y>=2000&&y<=2100&&new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===v;
}
/** Invalid types fall back to explicit sample defaults; finite numbers clamp. */
export function normalizeSun(raw={}) {
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  return Object.freeze({
    latitude:finite(v.latitude,DEFAULT_SUN.latitude,-90,90),
    longitude:finite(v.longitude,DEFAULT_SUN.longitude,-180,180),
    timezone:Object.hasOwn(TIMEZONES,v.timezone)?v.timezone:DEFAULT_SUN.timezone,
    date:validDate(v.date)?v.date:DEFAULT_SUN.date,
    minutes:Math.round(finite(v.minutes,DEFAULT_SUN.minutes,0,1439)),
    heading:Math.round(finite(v.heading,DEFAULT_SUN.heading,0,359))
  });
}
/** Projection factor for direct light only, not percentage of power produced. */
export function incidenceCosine(normal,direction) {
  if(!validVector(normal)||!validVector(direction)||direction[1]<=0)return 0;
  const lengths=Math.hypot(...normal)*Math.hypot(...direction);
  return lengths?clamp(normal.reduce((sum,n,i)=>sum+n*direction[i],0)/lengths,0,1):0;
}
const validVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function solarPosition(raw={}) {
  const config=normalizeSun(raw),{latitude,longitude,date,minutes,timezone,heading}=config;
  const [year,month,day]=date.split('-').map(Number);
  const utcMilliseconds=Date.UTC(year,month-1,day)+(minutes-60*TIMEZONES[timezone].offset)*60000;
  const t=(utcMilliseconds/86400000+2440587.5-2451545)/36525;
  const meanLongitude=wrap(280.46646+t*(36000.76983+0.0003032*t));
  const meanAnomaly=(357.52911+t*(35999.05029-0.0001537*t))*rad;
  const eccentricity=0.016708634-t*(0.000042037+0.0000001267*t);
  const center=Math.sin(meanAnomaly)*(1.914602-t*(0.004817+0.000014*t))+Math.sin(2*meanAnomaly)*(0.019993-0.000101*t)+Math.sin(3*meanAnomaly)*0.000289;
  const omega=(125.04-1934.136*t)*rad;
  const apparentLongitude=(meanLongitude+center-0.00569-0.00478*Math.sin(omega))*rad;
  const obliquity=(23+(26+(21.448-t*(46.815+t*(0.00059-t*0.001813)))/60)/60+0.00256*Math.cos(omega))*rad;
  const declination=Math.asin(Math.sin(obliquity)*Math.sin(apparentLongitude));
  const y=Math.tan(obliquity/2)**2,l=meanLongitude*rad;
  const equationOfTime=4*deg*(y*Math.sin(2*l)-2*eccentricity*Math.sin(meanAnomaly)+4*eccentricity*y*Math.sin(meanAnomaly)*Math.cos(2*l)-0.5*y*y*Math.sin(4*l)-1.25*eccentricity*eccentricity*Math.sin(2*meanAnomaly));
  const hourAngle=(wrap(minutes+equationOfTime+4*longitude-60*TIMEZONES[timezone].offset,1440)/4-180)*rad;
  const lat=latitude*rad;
  const east=-Math.cos(declination)*Math.sin(hourAngle);
  const north=Math.cos(lat)*Math.sin(declination)-Math.sin(lat)*Math.cos(declination)*Math.cos(hourAngle);
  const up=Math.sin(lat)*Math.sin(declination)+Math.cos(lat)*Math.cos(declination)*Math.cos(hourAngle);
  const worldDirection=Object.freeze([east,up,north]);
  // Front (+Z) has heading clockwise from north; local +X is heading -90°.
  // Default heading 180°: local +X=east, +Y=up, +Z=south.
  const h=heading*rad;
  const localDirection=Object.freeze([-east*Math.cos(h)+north*Math.sin(h),up,east*Math.sin(h)+north*Math.cos(h)]);
  const elevation=Math.asin(clamp(up,-1,1))*deg;
  return Object.freeze({config,elevation,azimuth:wrap(Math.atan2(east,north)*deg),declination:declination*deg,equationOfTime,utcMilliseconds,worldDirection,localDirection,daylight:up>0,incidenceCosine:normal=>incidenceCosine(normal,localDirection)});
}
/** Project opposite sunlight onto horizontal ground in the same coordinate frame.
 * No projection at/below 3°: very long horizon shadows are numerically/visually unhelpful.
 * Caller clips to the lawn. Points below ground invalidate this projection.
 */
export function projectedShadow(points,sunDirection,groundY=-0.175) {
  if(!validVector(sunDirection)||!Number.isFinite(groundY)||!Array.isArray(points)||!points.length)return null;
  const length=Math.hypot(...sunDirection);
  if(!length||sunDirection[1]/length<=Math.sin(3*rad)||!points.every(p=>validVector(p)&&p[1]>=groundY))return null;
  return Object.freeze(points.map(p=>{
    const distance=(p[1]-groundY)/sunDirection[1];
    return Object.freeze([p[0]-sunDirection[0]*distance,groundY,p[2]-sunDirection[2]*distance]);
  }));
}
/** All samples include night; callers may filter daylight and break paths at horizon. */
export function dailySunPath(raw={},stepMinutes=30) {
  const config=normalizeSun(raw),step=Math.round(finite(stepMinutes,30,5,240));
  const samples=[];
  for(let minutes=0;minutes<1440;minutes+=step)samples.push(solarPosition({...config,minutes}));
  return Object.freeze(samples);
}
