/** Strict, local-only hourly energy import. No guessing units, missing values or timezone. */
export const MAX_CSV_BYTES = 4 * 1024 * 1024;
const ZONES = {'Asia/Jakarta':7,'Asia/Makassar':8,'Asia/Jayapura':9};
const validText = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
export function hourlyTimeline(year, timezone) {
 if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Object.hasOwn(ZONES, timezone)) throw new Error('Tahun atau zona waktu seri tidak valid.');
 const start = Date.UTC(year,0,1,-ZONES[timezone]);
 const count = (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/3600000;
 return Array.from({length:count}, (_,t) => new Date(start+t*3600000).toISOString());
}
export function monthlyTotals(values, year, timezone) {
 const stamps=hourlyTimeline(year,timezone), totals=Array(12).fill(0);
 values.forEach((value,j)=>totals[new Date(Date.parse(stamps[j])+ZONES[timezone]*3600000).getUTCMonth()]+=value);
 return totals;
}
export function validateHourlyData(data, input) {
 if (data == null) return [];
 const errors=[];
 if (typeof data!=='object'||Array.isArray(data)) return ['hourlyData: seri harus objek.'];
 const keys=['year','timezone','startUtc','intervalMinutes','sourceName','sourcePeriod','productionKwhPerKwp','loadKwh'];
 if(Object.keys(data).some(k=>!keys.includes(k)))errors.push('hourlyData: field seri tidak dikenal.');
 if(data.year!==input.year||data.timezone!==input.timezone)errors.push('hourlyData: tahun/zona waktu berubah. Hapus atau impor ulang seri yang sesuai.');
 if(data.intervalMinutes!==60)errors.push('hourlyData: interval harus energi 60 menit, bukan daya sesaat.');
 for(const key of ['sourceName','sourcePeriod'])if(!validText(data[key]))errors.push(`hourlyData: ${key} wajib, maksimum 200 karakter.`);
 let stamps;try{stamps=hourlyTimeline(input.year,input.timezone);}catch{return [...errors,'hourlyData: kalender tidak valid.'];}
 if(data.startUtc!==stamps[0])errors.push('hourlyData: waktu awal seri tidak sesuai kalender lokal.');
 if(!data.productionKwhPerKwp&&!data.loadKwh)errors.push('hourlyData: perlu seri produksi atau beban.');
 for(const [key,limit,monthly] of [['productionKwhPerKwp',5,'monthlyYield'],['loadKwh',1e7,'monthlyKwh']]){
  if(data[key]===null)continue;
  if(!Array.isArray(data[key])||data[key].length!==stamps.length||data[key].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>limit)){errors.push(`hourlyData: ${key} harus ${stamps.length} energi nonnegatif, maksimum ${limit} per jam.`);continue;}
  if(Array.isArray(input[monthly])&&input[monthly].length===12){const totals=monthlyTotals(data[key],input.year,input.timezone);if(totals.some((v,m)=>Math.abs(v-input[monthly][m])>Math.max(1e-6,1e-9*Math.max(v,input[monthly][m]))))errors.push(`hourlyData: total ${monthly} harus sama dengan seri impor. Hapus seri sebelum mengubah total.`);}
 }
 if(data.loadKwh&&input.extrapolated)errors.push('hourlyData: beban setahun lengkap bukan ekstrapolasi satu bulan.');
 return errors;
}
/** CSV columns contain ENERGY over the following hour. ISO starts require explicit UTC/offset.
 * production_kwh_per_kwp is AC after source losses, normalized to installed DC kWp.
 * load_kwh is whole-building demand, NOT grid import/net-meter flow.
 */
export function parseHourlyCSV(text, {year, timezone, sourceName, sourcePeriod}) {
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw new Error('CSV harus teks maksimum 4 MiB.');
 if(!validText(sourceName)||!validText(sourcePeriod))throw new Error('Isi nama/referensi sumber dan periode sebelum impor.');
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const header=lines.shift().split(',').map(s=>s.trim());
 const expected=['timestamp','production_kwh_per_kwp','load_kwh'];
 if(header[0]!=='timestamp'||header.length<2||new Set(header).size!==header.length||header.some(h=>!expected.includes(h)))throw new Error('Header CSV: timestamp,production_kwh_per_kwp dan/atau load_kwh. Pakai koma sebagai pemisah dan titik desimal.');
 const stamps=hourlyTimeline(year,timezone);
 if(lines.length!==stamps.length)throw new Error(`CSV perlu tepat ${stamps.length} baris energi satu tahun lokal. Tidak mengisi jam hilang secara otomatis.`);
 const p=header.indexOf('production_kwh_per_kwp'),l=header.indexOf('load_kwh');
 const production=p>=0?[]:null,load=l>=0?[]:null;
 for(let t=0;t<lines.length;t++){
  const cells=lines[t].split(',').map(s=>s.trim()),stamp=cells[0];
  if(cells.length!==header.length||!/^\d{4}-\d{2}-\d{2}T\d{2}:00(?::00(?:\.000)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)||Date.parse(stamp)!==Date.parse(stamps[t]))throw new Error(`Baris ${t+2}: timestamp awal jam tidak cocok ${stamps[t]}. Periksa urutan, tahun, zona, duplikat, dan jam hilang.`);
  for(const [column,values] of [[p,production],[l,load]])if(values){const raw=cells[column];if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)||!Number.isFinite(Number(raw)))throw new Error(`Baris ${t+2}: energi harus angka nonnegatif, bukan sel kosong.`);values.push(Number(raw));}
 }
 const data={year,timezone,startUtc:stamps[0],intervalMinutes:60,sourceName:sourceName.trim(),sourcePeriod:sourcePeriod.trim(),productionKwhPerKwp:production,loadKwh:load};
 const totals={monthlyYield:production?monthlyTotals(production,year,timezone):null,monthlyKwh:load?monthlyTotals(load,year,timezone):null};
 const errors=validateHourlyData(data,{year,timezone,...totals,extrapolated:false});if(errors.length)throw new Error(errors.join('\n'));
 return {data,...totals};
}
export function hourlyCSVTemplate(year,timezone) {
 return 'timestamp,production_kwh_per_kwp,load_kwh\n'+hourlyTimeline(year,timezone).map(s=>s+',,').join('\n')+'\n';
}
