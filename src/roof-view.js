import {mapPickerHTML,mountMapPicker} from './map-picker.js';
import {DEFAULT_ROOF,ROOF_TYPES,normalizeRoof,roofGeometry,layoutPanels} from './roof-model.js';
import {createRoofRenderer} from './roof-renderer.js';
import {DEFAULT_SUN,TIMEZONES,normalizeSun,solarPosition,incidenceCosine} from './sun-model.js';
export {DEFAULT_SUN,normalizeSun};
export {DEFAULT_ROOF,normalizeRoof};
const number=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(n);
const roofIcons={flat:'<path d="M4 12h24v4H4zM7 16v12h18V16"/>',gable:'<path d="m3 16 13-11 13 11M6 14v14h20V14M16 5v11"/>',hip:'<path d="m3 17 8-11h10l8 11H3ZM7 17v11h18V17M11 6l5 11 5-11"/>',l:'<path d="M5 6h22v12H16v10H5V6ZM5 13h11v15M16 13h11"/>'};
function range(key,label,min,max,step,value,unit){return `<div class="roof-range"><label for="visual-${key}">${label}<output data-roof-value="${key}" for="visual-${key}">${number(value)}${unit}</output></label><input type="range" id="visual-${key}" data-roof-control="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;}
const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
const zoneLabel=zone=>TIMEZONES[zone].label.split(' ')[0];
const directionName=azimuth=>['U','TL','T','TG','S','BD','B','BL'][Math.round(azimuth/45)%8];
const pathCache=new Map();
function dayline(config,sun){
 const key=[config.latitude,config.longitude,config.date,config.timezone].join('|');
 let samples=pathCache.get(key);
 if(!samples){samples=Array.from({length:97},(_,i)=>solarPosition({...config,minutes:Math.min(1439,i*15)}).elevation);if(pathCache.size>12)pathCache.clear();pathCache.set(key,samples);}
 const X=m=>12+m/1440*576,Y=e=>50-e/90*32;
 const curve=samples.map((e,i)=>`${i?'L':'M'}${X(i*15).toFixed(1)},${Y(e).toFixed(1)}`).join(' ');
 return `<svg viewBox="0 0 600 98" role="img" aria-label="Ketinggian matahari sepanjang tanggal terpilih. Garis tengah adalah horizon 0 derajat."><path d="M12 50H588" class="sun-horizon"/><text x="13" y="43">0°</text><path d="${curve}" class="sun-day-curve"/><line x1="${X(config.minutes)}" y1="10" x2="${X(config.minutes)}" y2="83" class="sun-time-line"/><circle cx="${X(config.minutes)}" cy="${Y(sun.elevation)}" r="4.5" class="sun-day-dot"/>${[0,6,12,18,24].map(h=>`<text x="${X(h*60)}" y="95" text-anchor="${h===0?'start':h===24?'end':'middle'}">${String(h).padStart(2,'0')}.00</text>`).join('')}</svg>`;
}
function sunViewHTML(s,energyLinked=false){return `<section class="sun-lab" aria-labelledby="sun-title"><div class="sun-heading"><div><div class="eyebrow">Cahaya mengikuti waktu</div><h4 id="sun-title">Satu atap, sepanjang hari.</h4></div><span class="sun-status" data-sun-status></span></div><div class="sun-metrics"><div><span>Waktu lokal</span><strong data-sun-clock></strong></div><div><span>Elevasi geometris</span><strong data-sun-elevation></strong></div><div><span>Azimut matahari</span><strong data-sun-azimuth></strong></div></div><div class="sun-dayline" data-sun-dayline></div><label class="sr-only" for="sun-minutes">Geser waktu lokal matahari</label><input id="sun-minutes" class="sun-time-slider" type="range" data-sun-control="minutes" min="0" max="1439" step="1" value="${s.minutes}"><div class="sun-presets" role="group" aria-label="Waktu cepat">${[[480,'Pagi','08.00'],[720,'Siang','12.00'],[960,'Sore','16.00'],[1200,'Malam','20.00']].map(([m,label,t])=>`<button type="button" data-sun-preset="${m}"><strong>${label}</strong><span>${t}</span></button>`).join('')}</div><div class="sun-fields"><label>Tanggal lokal<input type="date" data-sun-control="date" min="2000-01-01" max="2100-12-31" value="${s.date}"></label><label>Jam lokal<input type="time" data-sun-time value="${clock(s.minutes)}" step="60"></label><label>Zona waktu 3D<select data-sun-control="timezone">${Object.entries(TIMEZONES).map(([key,z])=>`<option value="${key}" ${key===s.timezone?'selected':''}>${z.label}</option>`).join('')}</select></label></div><details class="sun-location" open><summary>Lokasi & arah bangunan <span data-sun-location></span></summary><p class="sun-hint">Awal: contoh Bandung, bukan lokasi otomatis. Tentukan titik rumah lewat peta opsional atau koordinat manual; nama kota di kalkulasi tidak mengubah posisi 3D.</p>${mapPickerHTML()}<div class="sun-fields coordinates"><label>Lintang (°)<input type="number" data-sun-control="latitude" value="${s.latitude}" min="-90" max="90" step="any"><small>+ utara · − selatan</small></label><label>Bujur (°)<input type="number" data-sun-control="longitude" value="${s.longitude}" min="-180" max="180" step="any"><small>+ timur · − barat</small></label></div><div class="roof-range"><label for="sun-heading">Arah depan bangunan<output data-sun-value="heading"></output></label><input id="sun-heading" type="range" data-sun-control="heading" min="0" max="359" step="1" value="${s.heading}"></div><div class="sun-heading-picker" role="group" aria-label="Arah depan bangunan dari utara sejati">${[[0,'Utara'],[45,'Timur laut'],[90,'Timur'],[135,'Tenggara'],[180,'Selatan'],[225,'Barat daya'],[270,'Barat'],[315,'Barat laut']].map(([heading,label])=>`<button type="button" data-sun-heading="${heading}" aria-pressed="${s.heading===heading}">${label}</button>`).join('')}</div><p class="sun-hint">0° utara sejati · 90° timur · 180° selatan · 270° barat. Pilih arah terdekat, lalu geser untuk menyesuaikan derajatnya. Depan adalah sisi pintu. Rotasi kamera tidak mengubah arah ini.</p></details><p data-sun-error class="sun-error" role="status"></p><div class="sun-face-heading">Sudut datang langsung per bidang <span>0° = tegak lurus bidang</span></div><div class="sun-faces" data-sun-faces></div><p class="sun-hint" data-sun-note></p><p class="sun-model-note">Posisi astronomis perkiraan, dihitung offline. Bukan data cuaca atau irradiansi. Sudut datang bukan persentase produksi. ${energyLinked?'Lokasi dan arah dipakai dalam model geometri energi; tanggal dan jam di sini hanya untuk melihat posisi matahari.':'Kontrol 3D tidak mengubah hasil energi sampai model geometri diaktifkan pada sumber produksi.'}</p></section>`;}
export function roofViewHTML(raw,options={}){
 const c=normalizeRoof(raw),linked=options.panelCount!=null,sun=normalizeSun(options.sun);
 return `<section class="roof-lab ${options.compact?'compact':''}" aria-labelledby="roof-lab-title"><div class="roof-lab-heading"><div><div class="eyebrow">Bentuk dulu. Jelajahi bersama.</div><h3 id="roof-lab-title">Rumahmu, dalam tiga dimensi.</h3><p>Geser waktu. Lihat arah cahaya dan bayangan berubah.</p></div><span class="pill">3D interaktif</span></div><div class="roof-workspace"><div class="roof-stage-column"><div class="roof-stage"><div class="roof-stage-label"><span class="roof-live-dot"></span> MODEL ILUSTRATIF <span data-roof-template>${ROOF_TYPES[c.type]}</span></div><canvas class="roof-canvas" tabindex="0" role="img" aria-label="Model rumah 3D interaktif. Gunakan tombol putar dan zoom di bawah, atau tombol panah saat kanvas dipilih." aria-describedby="roof-interaction-help">Model 3D memerlukan Canvas. Ringkasan ukuran dan panel tersedia di bawah.</canvas><svg class="roof-sun-overlay" aria-hidden="true"></svg><div class="roof-axis" aria-hidden="true">UTARA SEJATI<span>U · T · S · B</span></div><div class="roof-instruction" id="roof-interaction-help">Geser untuk memutar · Cubit atau gunakan + / − untuk zoom</div></div><div class="roof-toolbar" role="group" aria-label="Kontrol kamera 3D"><button type="button" data-roof-camera="left" aria-label="Putar rumah ke kiri">↶</button><button type="button" data-roof-camera="right" aria-label="Putar rumah ke kanan">↷</button><span></span><button type="button" data-roof-camera="out" aria-label="Perkecil model">−</button><button type="button" data-roof-camera="in" aria-label="Perbesar model">+</button><button type="button" data-roof-camera="top">Dari atas</button><button type="button" data-roof-camera="reset">Reset sudut</button></div><div class="roof-readout" aria-live="polite" aria-atomic="true"><div><span>Denah ilustrasi</span><strong data-roof-footprint></strong></div><div><span>Panel tergambar</span><strong data-roof-count></strong></div><div><span>Sumber jumlah panel</span><strong>${linked?'Opsi hasil terpilih':'Eksplorasi visual'}</strong></div></div><p class="roof-capacity-note" data-roof-warning role="status"></p>${sunViewHTML(sun,options.energyLinked)}</div><div class="roof-controls"><div class="roof-control-heading"><span>01</span><strong>Pilih bentuk atap</strong></div><div class="roof-type-picker" role="group" aria-label="Bentuk atap">${Object.entries(ROOF_TYPES).map(([key,label])=>`<button type="button" data-roof-type="${key}" aria-pressed="${c.type===key}" class="${c.type===key?'selected':''}"><svg viewBox="0 0 32 32" aria-hidden="true">${roofIcons[key]}</svg>${label}</button>`).join('')}</div><div class="roof-control-heading"><span>02</span><strong>Atur bentuk rumah</strong></div>${range('width','Lebar denah',4,20,.5,c.width,' m')}${range('length','Panjang denah',4,24,.5,c.length,' m')}${range('pitch','Kemiringan visual',10,45,1,c.pitch,'°')}<p class="roof-control-hint" data-roof-pitch-note></p><div class="roof-control-heading"><span>03</span><strong>Jelajahi susunan panel</strong></div>${linked?`<div class="roof-linked-count"><strong>${number(options.panelCount)} panel</strong><span>Mengikuti opsi kapasitas yang sedang dilihat.</span></div>`:range('panels','Jumlah panel visual',0,60,1,c.panels,' panel')}<div class="roof-select-row"><label for="visual-orientation">Susunan</label><select id="visual-orientation" data-roof-control="orientation"><option value="portrait" ${c.orientation==='portrait'?'selected':''}>Tegak</option><option value="landscape" ${c.orientation==='landscape'?'selected':''}>Mendatar</option></select></div><div class="roof-select-row"><label for="visual-surface">Bidang atap</label><select id="visual-surface" data-roof-control="surface"></select></div><p class="roof-control-hint">Penempatan berupa grid contoh, bukan rancangan pemasangan.</p></div></div><div class="roof-disclaimer">${options.energyLinked?'<strong>Geometri tersambung ke hitungan energi.</strong> Koordinat, arah depan bangunan, bentuk, kemiringan, dan bidang terpilih memengaruhi model energi. Ukuran hanya membobot luas bidang, bukan membuktikan panel muat. Tanggal dan jam visual tidak membatasi simulasi tahunan.':'<strong>Geometri energi belum diaktifkan.</strong> Kontrol 3D tidak mengubah produksi, biaya, atau penghematan sampai kamu memilih model geometri pada sumber produksi.'} Luas efektif atap untuk kalkulasi tetap diisi terpisah. Bayangan tanah hanya ilustrasi, bukan pengurang produksi. Cuaca lokal, bayangan antarpanel, hambatan sekitar, jarak aman, dan kecocokan komponen belum diverifikasi.</div><details class="roof-details"><summary>Asumsi gambar & penyimpanan</summary><p>Tinggi dinding contoh 3,2 m. Atap bentuk L memakai dua bidang datar. Rasio sisi modul diasumsikan 1:1,7 dengan luas modul dari input kalkulasi; bukan ukuran produk tertentu. Grid memberi tepi 0,4 m dan sela 0,12 m hanya untuk ilustrasi, bukan ketentuan keselamatan. Semua bidang disederhanakan tanpa talang dan hambatan.</p><p>Pengaturan 3D tersimpan jika kamu memilih “Simpan di browser”. Saat geometri energi aktif, data geometri untuk kalkulasi ikut dalam snapshot JSON. Jam dan sudut kamera visual tidak ikut. Rotasi kamera tidak mengubah arah bangunan. Zona waktu perlu kamu cocokkan dengan lokasi; peta tidak menebaknya. Peta online hanya dimuat setelah kamu aktifkan, dan perlu diaktifkan ulang saat membuka tampilan baru.</p><p data-roof-renderer-note></p></details></section>`;
}
export function mountRoofView(root,raw,options={}){
 if(!root)return()=>{};
 let config=normalizeRoof(raw),sunConfig=normalizeSun(options.sun),geometry,layout,sun,drag=null,pinch=null,disposed=false,raf=0;
 const canvas=root.querySelector('canvas'),renderer=createRoofRenderer(canvas),pointers=new Map();
 let mapPicker;
 const el=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];
 function drawOverlay(o){
   const svg=el('.roof-sun-overlay');svg.setAttribute('viewBox',`0 0 ${o.width} ${o.height}`);
   const labels=o.cardinals.map(({label,point})=>`<text x="${point[0]}" y="${point[1]}" class="compass-label">${label}</text>`).join('');
   svg.innerHTML=labels+(sun.daylight?`<line x1="${o.origin[0]}" y1="${o.origin[1]}" x2="${o.sun[0]}" y2="${o.sun[1]}" class="sun-ray"/><circle cx="${o.sun[0]}" cy="${o.sun[1]}" r="20" class="sun-halo"/><circle cx="${o.sun[0]}" cy="${o.sun[1]}" r="9" class="sun-disc"/>`:'');
 }
 function reportSunDraft(){
   const values={},invalidFields=[];
   for(const control of all('[data-sun-control]')){
     const key=control.dataset.sunControl,value=String(control.value);values[key]=value;
     let valid=value.trim()!==''&&control.checkValidity();
     if(['latitude','longitude','heading','minutes'].includes(key)){const n=Number(value),bounds={latitude:[-90,90],longitude:[-180,180],heading:[0,359],minutes:[0,1439]}[key];valid&&=Number.isFinite(n)&&n>=bounds[0]&&n<=bounds[1]&&(!['heading','minutes'].includes(key)||Number.isInteger(n));}
     if(key==='timezone')valid&&=Object.hasOwn(TIMEZONES,value);
     if(key==='date')valid&&=/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<='2100-12-31'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
     if(valid)control.removeAttribute('aria-invalid');else{control.setAttribute('aria-invalid','true');invalidFields.push(key);}
   }
   el('[data-sun-error]').textContent=invalidFields.length?'Ada input lokasi atau tanggal belum valid. Tampilan memakai nilai valid terakhir. Jika geometri energi aktif, perbaiki lokasi/zona/arah sebelum melanjutkan kalkulasi.':'';
   options.onSunDraftChange?.({values,invalidFields});
   return invalidFields;
 }
 function updateSun(){
   sun=solarPosition(sunConfig);
   mapPicker?.updateLocation(sunConfig);
   el('.roof-stage').classList.toggle('night',!sun.daylight);
   el('[data-sun-status]').textContent=sun.daylight?'Matahari di atas horizon':'Matahari di bawah horizon';
   el('[data-sun-status]').classList.toggle('night',!sun.daylight);
   el('[data-sun-elevation]').textContent=number(sun.elevation)+'°';
   el('[data-sun-azimuth]').textContent=number(sun.azimuth)+'° · '+directionName(sun.azimuth);
   el('[data-sun-location]').textContent=`${number(sunConfig.latitude)}°, ${number(sunConfig.longitude)}° · ${zoneLabel(sunConfig.timezone)}`;
   el('[data-sun-clock]').textContent=clock(sunConfig.minutes)+' '+zoneLabel(sunConfig.timezone);
   el('[data-sun-value="heading"]').textContent=number(sunConfig.heading)+'° · '+directionName(sunConfig.heading);
   el('[data-sun-control="minutes"]').value=sunConfig.minutes;
   el('[data-sun-control="heading"]').value=sunConfig.heading;
   all('[data-sun-heading]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.sunHeading)===sunConfig.heading)));
   el('[data-sun-time]').value=clock(sunConfig.minutes);
   el('[data-sun-dayline]').innerHTML=dayline(sunConfig,sun);
   el('[data-sun-faces]').innerHTML=geometry.surfaces.map(surface=>{
     const cosine=incidenceCosine(surface.normal,sun.localDirection);
     const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
     return `<span><strong>${surface.label}</strong>${!sun.daylight?'Malam':cosine<=0?'Membelakangi matahari':number(angle)+'° dari normal'}</span>`;
   }).join('');
   el('[data-sun-note]').textContent=!sun.daylight?'Tidak ada cahaya matahari langsung. Cahaya redup tetap ditampilkan agar bentuk rumah terbaca.':sun.elevation<3?'Dekat horizon: bayangan tanah disembunyikan agar proyeksi tidak tak terbatas. Posisi geometris tanpa refraksi.':'Bayangan bangunan dan pohon diproyeksikan ke tanah datar, dipotong di batas lahan. Bukan analisis bayangan pada panel.';
   all('[data-sun-preset]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.sunPreset)===sunConfig.minutes)));
   reportSunDraft();options.onSunChange?.({...sunConfig});redraw();
 }
 function redraw(){if(disposed||raf)return;raf=requestAnimationFrame(()=>{raf=0;const overlay=renderer.draw(geometry,layout,sun);if(overlay)drawOverlay(overlay);});}
 function update(rebuildSurfaces=false){
   geometry=roofGeometry(config);
   if(!geometry.surfaces.some(s=>s.id===config.surface)&&config.surface!=='all')config.surface='all';
   layout=layoutPanels(geometry,options.panelCount??config.panels,options.panelArea,config.orientation,config.surface);
   all('[data-roof-value]').forEach(o=>{const key=o.dataset.roofValue;o.textContent=number(config[key])+(key==='pitch'?'°':key==='panels'?' panel':' m');});
   const flat=['flat','l'].includes(config.type);
   el('[data-roof-control="pitch"]').disabled=flat;
   el('[data-roof-value="pitch"]').textContent=flat?'0° · datar':number(config.pitch)+'°';
   el('[data-roof-pitch-note]').textContent=flat?'Template ini memakai bidang atap datar.':'Hanya bentuk model, terpisah dari metadata kemiringan atap.';
   el('[data-roof-template]').textContent=ROOF_TYPES[config.type];
   el('[data-roof-footprint]').textContent=number(config.width)+' × '+number(config.length)+' m';
   el('[data-roof-count]').textContent=layout.shown+' / '+layout.wanted;
   el('[data-roof-warning]').textContent=layout.unshown?`${layout.unshown} panel belum tergambar pada grid ini. Ubah ukuran, susunan, atau bidang visual. Angka simulasi tidak diubah dan gambar bukan bukti panel dapat dipasang.`:`${number(geometry.footprintArea)} m² denah ilustrasi · ${layout.shown} panel tergambar. Bukan verifikasi muat atap.`;
   el('[data-roof-warning]').classList.toggle('warn',layout.unshown>0);
   renderer.canvas.setAttribute('aria-label',`Model rumah 3D atap ${ROOF_TYPES[config.type]}, lebar ${config.width} meter, panjang ${config.length} meter. ${layout.shown} dari ${layout.wanted} panel tergambar. Gunakan tombol kamera atau tombol panah untuk memutar.`);
   all('[data-roof-type]').forEach(b=>{const selected=b.dataset.roofType===config.type;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
   if(rebuildSurfaces)el('[data-roof-control="surface"]').innerHTML='<option value="all">Semua bidang</option>'+geometry.surfaces.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
   el('[data-roof-control="surface"]').value=config.surface;
   options.onChange?.({...config});updateSun();
 }
 const stop=e=>e.stopPropagation();
 all('[data-sun-control]').forEach(control=>{
   control.addEventListener('change',stop);
   const updateControl=e=>{
     e.stopPropagation();
     const invalid=reportSunDraft(),key=control.dataset.sunControl;
     if(invalid.includes(key))return;
     sunConfig=normalizeSun({...sunConfig,[key]:['latitude','longitude','minutes','heading'].includes(key)?Number(control.value):control.value});updateSun();
   };
   control.addEventListener('input',updateControl);
   if(control.type==='number'||control.type==='date'||control.type==='select-one')control.addEventListener('change',updateControl);
 });
 el('[data-sun-time]').addEventListener('change',e=>{e.stopPropagation();if(!e.target.value)return;const [h,m]=e.target.value.split(':').map(Number);sunConfig=normalizeSun({...sunConfig,minutes:h*60+m});updateSun();});
 all('[data-sun-heading]').forEach(b=>b.addEventListener('click',()=>{sunConfig=normalizeSun({...sunConfig,heading:Number(b.dataset.sunHeading)});updateSun();}));
 all('[data-sun-preset]').forEach(b=>b.addEventListener('click',()=>{sunConfig=normalizeSun({...sunConfig,minutes:Number(b.dataset.sunPreset)});updateSun();}));
 all('[data-roof-control]').forEach(control=>{
   control.addEventListener('change',stop);
   control.addEventListener('input',e=>{e.stopPropagation();const key=control.dataset.roofControl;config=normalizeRoof({...config,[key]:control.type==='range'?Number(control.value):control.value});update();});
 });
 all('[data-roof-type]').forEach(b=>b.addEventListener('click',()=>{config.type=b.dataset.roofType;config.surface='all';update(true);}));
 function cameraAction(action){const c=renderer.camera;
   if(action==='left')c.yaw-=.25;if(action==='right')c.yaw+=.25;
   if(action==='in')c.zoom=Math.min(2,c.zoom*1.15);if(action==='out')c.zoom=Math.max(.65,c.zoom/1.15);
   if(action==='up')c.elevation=Math.min(1.5,c.elevation+.12);if(action==='down')c.elevation=Math.max(.16,c.elevation-.12);
   if(action==='top')c.elevation=1.5;
   if(action==='reset')Object.assign(c,{yaw:-.68,elevation:.57,zoom:1});
   redraw();
 }
 all('[data-roof-camera]').forEach(b=>b.addEventListener('click',()=>cameraAction(b.dataset.roofCamera)));
 const view=renderer.canvas;
 view.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const actions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'in','=':'in','-':'out',Home:'reset'};if(actions[e.key]){e.preventDefault();cameraAction(actions[e.key]);}});
 view.addEventListener('pointerdown',e=>{if(e.button!==0)return;view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag=[e.clientX,e.clientY];pinch=null;view.classList.add('dragging');});
 view.addEventListener('pointermove',e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.set(e.pointerId,[e.clientX,e.clientY]);
   if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch&&distance>0)renderer.camera.zoom=Math.max(.65,Math.min(2,renderer.camera.zoom*distance/pinch));pinch=distance;drag=null;}
   else if(drag){renderer.camera.yaw+=(e.clientX-drag[0])*.008;renderer.camera.elevation=Math.max(.16,Math.min(1.5,renderer.camera.elevation+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];}
   else drag=[e.clientX,e.clientY];
   redraw();
 });
 const end=e=>{pointers.delete(e.pointerId);drag=null;pinch=null;if(!pointers.size)view.classList.remove('dragging');};
 view.addEventListener('pointerup',end);view.addEventListener('pointercancel',end);view.addEventListener('lostpointercapture',end);
 // Do not intercept page scrolling. Wheel zoom is intentional while the canvas has keyboard focus.
 view.addEventListener('wheel',e=>{if(document.activeElement!==view)return;e.preventDefault();cameraAction(e.deltaY<0?'in':'out');},{passive:false});
 view.addEventListener('webglcontextlost',e=>{e.preventDefault();el('[data-roof-renderer-note]').textContent='Konteks grafis terputus. Buka ulang tab Atap 3D untuk memuat model kembali; hasil kalkulasi tetap tersedia.';});
 el('[data-roof-renderer-note]').textContent=renderer.mode==='webgl'?'Model dirender lokal dengan WebGL, tanpa layanan 3D eksternal.':renderer.mode==='fallback'?'Browser memakai renderer Canvas 3D alternatif dengan depth buffer lokal.':'Canvas tidak tersedia pada browser ini. Gunakan ringkasan ukuran dan panel di atas.';
 mapPicker=mountMapPicker(el('[data-map-pinpoint]'),sunConfig,{onChange:point=>{
   sunConfig=normalizeSun({...sunConfig,...point});
   for(const key of ['latitude','longitude']){const control=el(`[data-sun-control="${key}"]`);control.value=sunConfig[key];control.removeAttribute('aria-invalid');}
   updateSun();
 }});
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(redraw):null;observer?.observe(view);
 for(const control of all('[data-sun-control]')){const key=control.dataset.sunControl;if(options.sunDraft?.values&&Object.hasOwn(options.sunDraft.values,key))control.value=options.sunDraft.values[key];}
 update(true);
 // updateSun resets range readouts. Restore attempted values once more, so no
 // invalid draft can disappear merely because the view mounted again.
 for(const control of all('[data-sun-control]')){const key=control.dataset.sunControl;if(options.sunDraft?.values&&Object.hasOwn(options.sunDraft.values,key))control.value=options.sunDraft.values[key];}
 reportSunDraft();
 return ()=>{disposed=true;mapPicker?.dispose();observer?.disconnect();if(raf)cancelAnimationFrame(raf);renderer.dispose();};
}
