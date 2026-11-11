import test from 'node:test';
import assert from 'node:assert/strict';
import {toWorld,fromWorld,screenLocation,screenPoint,visibleTiles,validCoordinates,MAX_MAP_LATITUDE,MAP_CITIES} from '../src/map-model.js';
import {mapPickerHTML,mountMapPicker} from '../src/map-picker.js';
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('map projection round trips Indonesian and global positions at every zoom',()=>{
 for(let zoom=3;zoom<=19;zoom++)for(const [latitude,longitude] of [[-6.9175,107.6191],[0,0],[70,-170],[-70,170],...MAP_CITIES.map(c=>c.slice(1))]){
  const p=fromWorld(toWorld({latitude,longitude},zoom),zoom);close(p.latitude,latitude);close(p.longitude,longitude);
 }
});
test('map polar clipping does not claim Mercator supports the poles',()=>{
 close(fromWorld(toWorld({latitude:90,longitude:0},19),19).latitude,MAX_MAP_LATITUDE);
 close(fromWorld(toWorld({latitude:-90,longitude:0},19),19).latitude,-MAX_MAP_LATITUDE);
 assert.equal(validCoordinates({latitude:90,longitude:180}),true);
 assert.equal(validCoordinates({latitude:NaN,longitude:0}),false);
 assert.equal(validCoordinates({latitude:0,longitude:181}),false);
});
test('pin and viewport coordinate transforms round trip and cross antimeridian',()=>{
 const center={latitude:-6.9,longitude:107.6};for(const [x,y] of [[0,0],[250,150],[500,300]]){
  const location=screenLocation(center,18,500,300,x,y),point=screenPoint(location,center,18,500,300);close(point.x,x);close(point.y,y);
 }
 const p=screenPoint({latitude:0,longitude:-179.99},{latitude:0,longitude:179.99},10,600,300);assert.ok(Math.abs(p.x-300)<20);
});
test('tiles cover only visible viewport and legal wrapped addresses',()=>{
 for(const center of [{latitude:-6.9,longitude:107.6},{latitude:0,longitude:180},{latitude:85,longitude:-180}])for(const zoom of [3,16,19]){
  const tiles=visibleTiles(center,zoom,600,300);assert.ok(tiles.length>0&&tiles.length<=12);
  for(const tile of tiles){assert.ok(tile.left<600&&tile.left+256>0&&tile.top<300&&tile.top+256>0);const [z,x,y]=tile.url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/).slice(1).map(Number);assert.equal(z,zoom);assert.ok(x>=0&&x<2**zoom&&y>=0&&y<2**zoom);}
 }
 assert.deepEqual(visibleTiles({latitude:0,longitude:0},20,600,300),[]);
 assert.deepEqual(visibleTiles({latitude:0,longitude:0},16,0,300),[]);
});
test('map HTML is offline until activated with privacy disclosure and accessible fallback',()=>{
 const html=mapPickerHTML();assert.doesNotMatch(html,/<(?:img|iframe|script)\b/);assert.match(html,/data-map-active hidden/);assert.match(html,/alamat IP/);assert.match(html,/Tidak ada akses GPS/);assert.match(html,/Ketentuan OSMF/);assert.match(html,/aria-label="Kontrol peta"/);assert.match(html,/©/);assert.match(html,/data-map-pinpoint/);
 assert.doesNotThrow(()=>mountMapPicker(null,{}).dispose());
});
