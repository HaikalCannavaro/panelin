import {MAP_CITIES,MIN_MAP_ZOOM,MAX_MAP_ZOOM,MAX_MAP_LATITUDE,validCoordinates,toWorld,fromWorld,screenLocation,screenPoint,visibleTiles} from './map-model.js';

export function mapPickerHTML(){return `<section class="map-picker" data-map-pinpoint aria-label="Pilih titik rumah di peta"><div class="map-heading"><strong>Titik rumah, lebih mudah.</strong><span>Opsional · peta online</span></div><p class="map-copy">Aktifkan peta, cari rumahmu, lalu ketuk atapnya. Koordinat di bawah akan mengikuti titik yang kamu pilih. Nama kota tidak memilih rumah secara otomatis.</p><div data-map-consent><p class="map-privacy">Peta dari OpenStreetMap. Saat diaktifkan, penyedia menerima alamat IP, asal situs, dan area peta yang kamu lihat. Tidak ada akses GPS, pencarian alamat, atau pengiriman nama rumah. Koordinat manual tetap bisa digunakan tanpa peta.</p><div class="map-links"><a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">Privasi OSMF</a><a href="https://wiki.osmfoundation.org/wiki/Terms_of_Use" target="_blank" rel="noopener noreferrer">Ketentuan OSMF</a></div><button type="button" class="btn compact" data-map-action="enable">Aktifkan peta OpenStreetMap</button></div><div data-map-active hidden><div class="map-topbar"><label>Dekati kota <small>bukan memilih rumah</small><select data-map-city><option value="">Koordinat saat ini</option>${MAP_CITIES.map(([name],i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><button type="button" class="link-button" data-map-action="disable">Matikan peta</button></div><div class="map-viewport" tabindex="0" role="group" aria-label="Peta rumah interaktif. Tombol panah menggeser, plus minus mengubah zoom, Enter menaruh titik di tengah." aria-describedby="map-instructions"><div class="map-tile-layer" aria-hidden="true"></div><div class="map-crosshair" aria-hidden="true"></div><div class="map-house-pin" aria-hidden="true"><span>Rumah</span><svg viewBox="0 0 32 42"><path d="M16 40C12 33 2 24 2 16a14 14 0 0 1 28 0c0 8-10 17-14 24Z"/><circle cx="16" cy="16" r="5"/></svg></div><span class="map-north" aria-hidden="true">↑ U</span><span class="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</span></div><div class="map-toolbar" role="group" aria-label="Kontrol peta"><button type="button" data-map-action="out" aria-label="Perkecil peta">−</button><span data-map-zoom></span><button type="button" data-map-action="in" aria-label="Perbesar peta">+</button><button type="button" data-map-action="center">Ke titik rumah</button><button type="button" class="map-pick" data-map-action="pick">Pasang titik di tengah</button></div><p class="map-copy" id="map-instructions">Ketuk untuk menaruh titik. Geser untuk pindah area, lalu perbesar agar atap terlihat. Keyboard: panah untuk geser, + / − untuk zoom, Enter untuk memilih tengah. Gulir halaman tetap normal.</p><p class="map-status" data-map-status role="status" aria-live="polite"></p><p class="map-copy map-coordinate" data-map-coordinate></p><p class="map-copy">Peta bukan citra satelit atau survei. Detail bangunan dan posisi bisa meleset; angka desimal bukan jaminan akurasi. Cek titiknya, lalu isi arah depan bangunan. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Laporkan masalah peta</a>.</p></div></section>`;}

/** Explicit activation is ephemeral. Coordinates are stored only by the host's save action. */
export function mountMapPicker(root,initial,options={}){
 const noop={updateLocation(){},dispose(){}};
 if(!root||typeof root.querySelector!=='function'||!validCoordinates(initial)||!root.querySelector('.map-viewport'))return noop;
 const el=s=>root.querySelector(s),view=el('.map-viewport'),layer=el('.map-tile-layer'),pin=el('.map-house-pin');
 let selected={latitude:initial.latitude,longitude:initial.longitude},center={...selected},zoom=16,enabled=false,disposed=false,drag=null,raf=0,loadingTimer=0;
 const tiles=new Map(),listeners=[];
 const on=(node,type,handler)=>{node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));};
 const size=()=>({width:view.clientWidth,height:view.clientHeight});
 const status=message=>{el('[data-map-status]').textContent=message;};
 function readout(){el('[data-map-coordinate]').textContent=`Titik terpilih: ${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}. Arah depan bangunan diatur terpisah di bawah.`;}
 function loadStatus(){
  if(!enabled||disposed)return;
  if([...tiles.values()].some(t=>t.state==='error'))status('Sebagian peta gagal dimuat. Cek koneksi, atau matikan peta dan isi koordinat manual. Tidak ada titik yang berubah otomatis.');
  else if([...tiles.values()].some(t=>t.state==='loading'))status('Memuat peta. Kamu tetap dapat memakai koordinat manual.');
  else status('Peta siap. Perbesar dan ketuk atap rumah, atau pasang titik di tengah.');
 }
 function positionPin(){
  const {width,height}=size(),p=screenPoint(selected,center,zoom,width,height);
  pin.hidden=Math.abs(selected.latitude)>MAX_MAP_LATITUDE||p.x<0||p.x>width||p.y<0||p.y>height;
  pin.style.left=`${p.x}px`;pin.style.top=`${p.y}px`;
 }
 function render(){
  if(!enabled||disposed)return;
  const {width,height}=size();if(!width||!height)return;
  const needed=visibleTiles(center,zoom,width,height),keys=new Set(needed.map(t=>t.key));
  for(const [key,tile] of tiles)if(!keys.has(key)){tile.img.onload=null;tile.img.onerror=null;tile.img.remove();tiles.delete(key);}
  for(const item of needed){
   let tile=tiles.get(item.key);
   if(!tile){
    const img=root.ownerDocument.createElement('img');img.alt='';img.draggable=false;img.width=256;img.height=256;
    // OSM requires a valid Referer. Only the site origin, never a URL path/query.
    img.referrerPolicy='origin';img.decoding='async';
    tile={img,state:'loading',left:item.left,top:item.top};tiles.set(item.key,tile);
    img.onload=()=>{tile.state='loaded';loadStatus();};img.onerror=()=>{tile.state='error';img.classList.add('map-tile-error');loadStatus();};
    layer.append(img);img.src=item.url; // Browser HTTP cache, no fetch bypass/cache busting.
   }
   tile.left=item.left;tile.top=item.top;tile.img.style.left=`${item.left}px`;tile.img.style.top=`${item.top}px`;
  }
  positionPin();el('[data-map-zoom]').textContent=`Zoom ${zoom}`;
  el('[data-map-action="out"]').disabled=zoom===MIN_MAP_ZOOM;el('[data-map-action="in"]').disabled=zoom===MAX_MAP_ZOOM;
  loadStatus();clearTimeout(loadingTimer);loadingTimer=setTimeout(()=>{if(enabled&&[...tiles.values()].some(t=>t.state==='loading'))status('Peta belum selesai dimuat. Jaringan atau layanan peta mungkin tidak tersedia. Koordinat manual tetap dapat dipakai.');},10000);
 }
 function schedule(){if(disposed||raf)return;raf=requestAnimationFrame(()=>{raf=0;render();});}
 function clearTiles(){for(const tile of tiles.values()){tile.img.onload=null;tile.img.onerror=null;tile.img.remove();}tiles.clear();}
 function endDrag(){drag=null;layer.style.transform='';pin.style.transform='';view.classList.remove('dragging');}
 function disable(){enabled=false;endDrag();clearTiles();clearTimeout(loadingTimer);el('[data-map-active]').hidden=true;el('[data-map-consent]').hidden=false;el('[data-map-action="enable"]').focus();}
 function pick(x,y){
  if(!enabled)return;
  const tile=[...tiles.values()].find(t=>x>=t.left&&x<t.left+256&&y>=t.top&&y<t.top+256);
  if(!tile||tile.state!=='loaded'){status('Tunggu peta pada titik ini selesai dimuat, atau gunakan koordinat manual.');return;}
  const {width,height}=size(),point=screenLocation(center,zoom,width,height,x,y);
  selected={latitude:Number(point.latitude.toFixed(6)),longitude:Number(point.longitude.toFixed(6))};
  positionPin();readout();options.onChange?.({...selected});status(`Titik rumah diperbarui ke ${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}. Periksa arah depan bangunan di bawah.`);
 }
 function pan(dx,dy){const p=toWorld(center,zoom);center=fromWorld({x:p.x+dx,y:p.y+dy},zoom);render();}
 function action(name){
  if(name==='enable'){enabled=true;el('[data-map-consent]').hidden=true;el('[data-map-active]').hidden=false;render();view.focus();return;}
  if(name==='disable'){disable();return;}if(!enabled)return;
  if(name==='in'||name==='out'){zoom=Math.min(MAX_MAP_ZOOM,Math.max(MIN_MAP_ZOOM,zoom+(name==='in'?1:-1)));render();}
  else if(name==='center'){center={...selected};render();}
  else if(name==='pick'){const {width,height}=size();pick(width/2,height/2);}
 }
 for(const button of root.querySelectorAll('[data-map-action]'))on(button,'click',()=>action(button.dataset.mapAction));
 on(el('[data-map-city]'),'change',event=>{event.stopPropagation();const value=event.target.value;if(value===''){center={...selected};zoom=16;}else{const city=MAP_CITIES[Number(value)];if(!city)return;center={latitude:city[1],longitude:city[2]};zoom=12;}render();status('Peta didekatkan. Titik rumah belum berubah; perbesar lalu ketuk atap rumahmu.');});
 on(view,'keydown',event=>{
  if(event.target!==view||event.ctrlKey||event.metaKey||event.altKey||!enabled)return;
  const moves={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]};
  if(moves[event.key]){event.preventDefault();pan(...moves[event.key]);}
  else if(['+','=','-','Enter','Home'].includes(event.key)){event.preventDefault();action(event.key==='Enter'?'pick':event.key==='Home'?'center':event.key==='-'?'out':'in');}
 });
 on(view,'pointerdown',event=>{
  if(!enabled||event.button!==0||event.target.closest('a')||!event.isPrimary)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0,moved:false,center:{...center}};view.setPointerCapture(event.pointerId);view.classList.add('dragging');
 });
 on(view,'pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  drag.dx=event.clientX-drag.x;drag.dy=event.clientY-drag.y;drag.moved||=Math.hypot(drag.dx,drag.dy)>6;
  // No new tile requests during dragging. Request the final visible viewport on release.
  layer.style.transform=`translate(${drag.dx}px,${drag.dy}px)`;pin.style.transform=`translate(${drag.dx}px,${drag.dy}px)`;
 });
 on(view,'pointerup',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const d=drag;endDrag();if(view.hasPointerCapture(event.pointerId))view.releasePointerCapture(event.pointerId);
  if(d.moved){const p=toWorld(d.center,zoom);center=fromWorld({x:p.x-d.dx,y:p.y-d.dy},zoom);render();}
  else{const rect=view.getBoundingClientRect();pick(event.clientX-rect.left,event.clientY-rect.top);}
 });
 on(view,'pointercancel',endDrag);on(view,'lostpointercapture',endDrag);
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(view);readout();
 return {
  updateLocation(location){if(!validCoordinates(location))return;if(location.latitude===selected.latitude&&location.longitude===selected.longitude)return;selected={latitude:location.latitude,longitude:location.longitude};center={...selected};readout();if(enabled)render();},
  dispose(){disposed=true;enabled=false;observer?.disconnect();listeners.forEach(off=>off());clearTiles();clearTimeout(loadingTimer);if(raf)cancelAnimationFrame(raf);}
 };
}
