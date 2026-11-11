/** Web Mercator math for the optional, user-activated map. No network or GPS. */
export const TILE_SIZE=256, MAX_MAP_LATITUDE=85.0511287798066;
export const MIN_MAP_ZOOM=3, MAX_MAP_ZOOM=19;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const wrapLongitude=value=>((value+180)%360+360)%360-180;
export function validCoordinates(value){return value&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)&&Math.abs(value.latitude)<=90&&Math.abs(value.longitude)<=180;}
export function toWorld({latitude,longitude},zoom){
 const size=TILE_SIZE*2**zoom,lat=clamp(latitude,-MAX_MAP_LATITUDE,MAX_MAP_LATITUDE)*Math.PI/180;
 return {x:(longitude+180)/360*size,y:clamp((1-Math.asinh(Math.tan(lat))/Math.PI)/2*size,0,size)};
}
export function fromWorld({x,y},zoom){
 const size=TILE_SIZE*2**zoom;
 return {latitude:Math.atan(Math.sinh(Math.PI*(1-2*clamp(y,0,size)/size)))*180/Math.PI,longitude:wrapLongitude(x/size*360-180)};
}
export function screenLocation(center,zoom,width,height,x,y){
 const p=toWorld(center,zoom);return fromWorld({x:p.x+x-width/2,y:p.y+y-height/2},zoom);
}
export function screenPoint(location,center,zoom,width,height){
 const p=toWorld(location,zoom),c=toWorld(center,zoom),size=TILE_SIZE*2**zoom;
 let dx=p.x-c.x;if(dx>size/2)dx-=size;if(dx<-size/2)dx+=size;
 return {x:width/2+dx,y:height/2+p.y-c.y};
}
/** Only tiles intersecting this viewport. Never prefetch another view/zoom. */
export function visibleTiles(center,zoom,width,height){
 if(!validCoordinates(center)||!Number.isInteger(zoom)||zoom<MIN_MAP_ZOOM||zoom>MAX_MAP_ZOOM||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
 const p=toWorld(center,zoom),left=p.x-width/2,top=p.y-height/2,count=2**zoom,tiles=[];
 for(let y=Math.max(0,Math.floor(top/TILE_SIZE));y<=Math.min(count-1,Math.ceil((top+height)/TILE_SIZE)-1);y++){
  for(let x=Math.floor(left/TILE_SIZE);x<=Math.ceil((left+width)/TILE_SIZE)-1;x++){
   const tileX=((x%count)+count)%count;
   tiles.push({key:`${zoom}/${x}/${y}`,url:`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`,left:x*TILE_SIZE-left,top:y*TILE_SIZE-top});
  }
 }
 return tiles;
}
// Approximate city centers to help navigation, never selected house locations.
export const MAP_CITIES=Object.freeze([
 ['Bandung',-6.9175,107.6191],['Jakarta',-6.1754,106.8272],['Surabaya',-7.2575,112.7521],['Yogyakarta',-7.7956,110.3695],
 ['Semarang',-6.9667,110.4167],['Denpasar',-8.65,115.2167],['Medan',3.5952,98.6722],['Padang',-0.9471,100.4172],
 ['Palembang',-2.9761,104.7754],['Pekanbaru',0.5071,101.4478],['Pontianak',-0.0263,109.3425],['Balikpapan',-1.2379,116.8529],
 ['Banjarmasin',-3.3186,114.5944],['Samarinda',-0.5022,117.1536],['Makassar',-5.1477,119.4327],['Manado',1.4748,124.8421],
 ['Mataram',-8.5833,116.1167],['Kupang',-10.1772,123.607],['Ambon',-3.6954,128.1814],['Jayapura',-2.5337,140.7181]
]);
