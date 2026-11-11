import {add,sub,scale,cross,dot} from './roof-model.js';
import {solarPosition,projectedShadow} from './sun-model.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const interpolate=(p,q,t)=>add(p,scale(sub(q,p),t));
function polygon(points,color,edge=null,normal=null){const raw=normal||scale(cross(sub(points[1],points[0]),sub(points[2],points[0])),-1);return {points,color:rgb(color),edge:edge?rgb(edge):null,normal:scale(raw,1/(Math.hypot(...raw)||1))};}
function box(x,y,z,w,h,d,color){
 const a=[x,y,z],b=[x+w,y,z],c=[x+w,y,z+d],e=[x,y,z+d],top=p=>add(p,[0,h,0]);
 return [[a,b,top(b),top(a)],[b,c,top(c),top(b)],[c,e,top(e),top(c)],[e,a,top(a),top(e)],[top(a),top(b),top(c),top(e)]].map(p=>polygon(p,color));
}
function cone(x,y,z,r,h,color,sides=9){const out=[];for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;out.push(polygon([[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x,y+h,z]],color));}return out;}
export function sceneGeometry(roof,layout,sun=null){
 const {width:w,length:l}=roof.config,faces=[],lines=[],casters=[];
 const line=(a,b,c='#7293a0')=>lines.push({points:[a,b],color:rgb(c)});
 faces.push(...box(-w/2-2,-.45,-l/2-2,w+4,.26,l+4,'#c1d0ad'));
 faces.push(...box(-w/2-.35,-.18,-l/2-.35,w+.7,.18,l+.7,'#e6e5d3'));
 // The foundation follows the same L footprint instead of filling its courtyard.
 if(roof.config.type==='l')faces.splice(5,5);
 for(const wall of roof.walls){
   faces.push(polygon(wall,'#f0ebd7','#b7b69b'));
   const a=wall[0],b=wall[1],edge=sub(b,a),length=Math.hypot(...edge),u=scale(edge,1/length),normal=[u[2],0,-u[0]],offset=scale(normal,.012);
   // Window bays are attached to each wall and inherit the roof's footprint.
   const bays=Math.max(1,Math.floor(length/2.7));
   for(let k=0;k<bays;k++){
     const center=(k+.5)*length/bays,half=Math.min(.6,length*.2);
     const midpoint=add(a,scale(u,center));if(Math.abs(midpoint[0])<1&&Math.abs(midpoint[2]-l/2)<.01)continue;
     const at=(d,y)=>add(add(a,scale(u,d)),add([0,y,0],offset));
     const p=[at(center-half,1.15),at(center+half,1.15),at(center+half,2.25),at(center-half,2.25)];
     faces.push(polygon(p,'#668d8b','#e6e9d9'));
     line(at(center,1.15),at(center,2.25),'#e4e8d7');line(at(center-half,1.7),at(center+half,1.7),'#d4decd');
   }
 }
 faces.push(...roof.gables.map(p=>polygon(p,'#e6e0c9','#babca3')));
 for(const surface of roof.surfaces)faces.push(polygon(surface.points,'#6d8171','#dce2cd',surface.normal));
 // A door and approach on the front wall make the footprint easy to read.
 faces.push(...box(-.58,0,l/2+.025,1.16,2.3,.045,'#a39b79'));
 faces.push(...box(-.72,-.1,l/2,1.44,.1,.6,'#dedfc9'));
 for(let i=0;i<3;i++)faces.push(...box(-.65,-.18,l/2+.6+i*.4,1.3,.04,.28,'#e9e7d7'));
 for(const panel of layout.panels){
   const p=panel.points;
   faces.push(polygon(p,'#244f64','#bad1d3',panel.normal));
   const lift=scale(panel.normal,.006);
   for(let j=1;j<4;j++)line(add(interpolate(p[0],p[1],j/4),lift),add(interpolate(p[3],p[2],j/4),lift),'#547b8d');
   for(let j=1;j<7;j++)line(add(interpolate(p[0],p[3],j/7),lift),add(interpolate(p[1],p[2],j/7),lift),'#547b8d');
 }
 casters.push(...roof.walls,...roof.gables,...roof.surfaces.map(s=>s.points));
 for(const [x,z,r] of [[-w/2-1.1,l/2-.5,.65],[w/2+1.05,-l/2+.5,.7]]){
   faces.push(...box(x-.07,-.18,z-.07,.14,1.1,.14,'#a49d78'));
   const tree=[...cone(x,.4,z,r,2.1,'#89a77b'),...cone(x,1.2,z,r*.78,1.5,'#a2b78b')];faces.push(...tree);casters.push(...tree.map(f=>f.points));
 }
 if(sun?.daylight){
   for(const points of casters){
     const projection=projectedShadow(points,sun.localDirection);
     if(!projection)continue;
     const clipped=clipGroundPolygon(projection,[-w/2-2,w/2+2,-l/2-2,l/2+2]);
     if(clipped.length>=3&&Math.abs(clipped.reduce((a,p,i)=>{const q=clipped[(i+1)%clipped.length];return a+p[0]*q[2]-q[0]*p[2];},0))>1e-7){
       const shadow=polygon(clipped,'#778873',null,[0,1,0]);shadow.unlit=true;shadow.shadow=true;faces.push(shadow);
     }
   }
 }
 return {faces,lines};
}
/** Sutherland–Hodgman clip on a convex horizontal ground projection. */
export function clipGroundPolygon(points,[minX,maxX,minZ,maxZ]){
 let out=points.map(p=>[...p]);
 for(const [axis,limit,sign] of [[0,minX,1],[0,maxX,-1],[2,minZ,1],[2,maxZ,-1]]){
   const input=out;out=[];if(!input.length)break;
   for(let i=0;i<input.length;i++){
     const a=input[i],b=input[(i+1)%input.length],insideA=sign*(a[axis]-limit)>=0,insideB=sign*(b[axis]-limit)>=0;
     if(insideA)out.push(a);
     if(insideA!==insideB)out.push(interpolate(a,b,(limit-a[axis])/(b[axis]-a[axis])));
   }
 }
 return out.filter((p,i)=>i===0||Math.hypot(...sub(p,out[i-1]))>1e-8).filter((p,i,a)=>i!==a.length-1||Math.hypot(...sub(p,a[0]))>1e-8);
}
/** Ambient contribution is a readability aid, not modeled diffuse irradiance. */
export function faceLighting(face,sun){
 if(face.unlit)return sun.daylight? .43+.57*Math.max(0,sun.localDirection[1]):.38;
 return sun.daylight?.43+.57*Math.max(0,dot(face.normal,sun.localDirection)):.38;
}
export function createRoofRenderer(canvas){
 let gl;
 try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{}
 let ctx,program,pos,color,buffer,colors,disposed=false;
 const camera={yaw:-.68,elevation:.57,zoom:1};
 if(gl){
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return shader;};
   try{
     const vs=compile(gl.VERTEX_SHADER,'attribute vec3 position; attribute vec3 color; varying vec3 tint; void main(){gl_Position=vec4(position,1.0);tint=color;}');
     const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 tint; void main(){gl_FragColor=vec4(tint,1.0);}');
     program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
     if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program unavailable');
     pos=gl.getAttribLocation(program,'position');color=gl.getAttribLocation(program,'color');buffer=gl.createBuffer();colors=gl.createBuffer();
   }catch{gl=null;}
 }
 if(!gl){
   // A WebGL context cannot be replaced with 2D on the same canvas.
   const replacement=canvas.cloneNode(true);canvas.replaceWith(replacement);canvas=replacement;
   ctx=canvas.getContext('2d');
 }
 function draw(roof,layout,sun=solarPosition()){
   if(disposed)return;
   const width=canvas.clientWidth||600,height=canvas.clientHeight||420,dpr=Math.min(2,globalThis.devicePixelRatio||1);
   if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
   const {faces,lines}=sceneGeometry(roof,layout,sun),cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),ce=Math.cos(camera.elevation),se=Math.sin(camera.elevation);
   const rotate=p=>{const x=p[0]*cy-p[2]*sy,z=p[0]*sy+p[2]*cy;return [x,p[1]*ce-z*se,p[1]*se+z*ce];};
   const radius=Math.max(roof.config.width,roof.config.length)/2+2.2,heading=sun.config.heading*Math.PI/180;
   const toLocal=(east,north)=>[-east*Math.cos(heading)+north*Math.sin(heading),-.15,east*Math.sin(heading)+north*Math.cos(heading)];
   const cardinals=[['U',0,radius],['T',radius,0],['S',0,-radius],['B',-radius,0]].map(([label,e,n])=>({label,point:toLocal(e,n)}));
   const origin=[0,roof.height*.45,0],sunPoint=add(origin,scale(sun.localDirection,radius*.95));
   // Fixed light-independent bounds keep the house steady while scrubbing time.
   const bounds=faces.filter(f=>!f.shadow).flatMap(f=>f.points.map(rotate));
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2;bounds.push(rotate([Math.sin(a)*radius,-.15,Math.cos(a)*radius]));}
   for(const p of [[-radius,roof.height+radius*.75,-radius],[radius,roof.height+radius*.75,radius]])bounds.push(rotate(p));
   const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
   const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
   const size=Math.min(width*.88/(maxX-minX),(height-90)/(maxY-minY))*camera.zoom;
   const project=p=>{const q=rotate(p);return [width/2+(q[0]-centerX)*size,height/2+7-(q[1]-centerY)*size,q[2]];};

   if(gl){
     gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(program);
     const verts=[],cols=[],edges=[],edgeCols=[];
     const projected=p=>{const q=project(p);return [q[0]/width*2-1,1-q[1]/height*2,-q[2]/100];};
     for(const f of faces){
       const light=faceLighting(f,sun);
       const tint=f.color.map(c=>c*light);
       for(let i=1;i<f.points.length-1;i++)for(const p of [f.points[0],f.points[i],f.points[i+1]]){verts.push(...projected(p));cols.push(...tint);}
       if(f.edge)for(let i=0;i<f.points.length;i++)for(const p of [f.points[i],f.points[(i+1)%f.points.length]]){const q=projected(p);q[2]-=.00003;edges.push(...q);edgeCols.push(...f.edge.map(n=>n*(sun.daylight?1:.48)));}
     }
     for(const line of lines)for(const p of line.points){const q=projected(p);q[2]-=.00003;edges.push(...q);edgeCols.push(...line.color.map(n=>n*(sun.daylight?1:.48)));}
     const upload=(data,tints,mode)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,colors);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(tints),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,0,0);gl.drawArrays(mode,0,data.length/3);};
     upload(verts,cols,gl.TRIANGLES);upload(edges,edgeCols,gl.LINES);
   }else if(ctx){
     // Dependency-free software depth buffer: the same geometry works without WebGL.
     // Render at CSS resolution and let the browser scale on high-DPI devices.
     const W=Math.round(width),H=Math.round(height),pixels=ctx.createImageData(W,H),depth=new Float32Array(W*H);depth.fill(-Infinity);
     const data=pixels.data;
     const put=(x,y,z,color)=>{if(x<0||x>=W||y<0||y>=H)return;const i=y*W+x;if(z<depth[i]-.00001)return;depth[i]=z;const k=i*4;data[k]=color[0];data[k+1]=color[1];data[k+2]=color[2];data[k+3]=255;};
     const triangle=(a,b,c,color)=>{
       const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-8)return;
       const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0])));
       const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
       for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
         const u=((b[0]-x-.5)*(c[1]-y-.5)-(b[1]-y-.5)*(c[0]-x-.5))/area;
         const v=((c[0]-x-.5)*(a[1]-y-.5)-(c[1]-y-.5)*(a[0]-x-.5))/area;
         const w=1-u-v;if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)put(x,y,u*a[2]+v*b[2]+w*c[2],color);
       }
     };
     const stroke=(a,b,color)=>{const n=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))));for(let i=0;i<=n;i++){const t=i/n;put(Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),a[2]+(b[2]-a[2])*t+.035,color);}};
     const edges=[];
     for(const f of faces){
       const points=f.points.map(project),lighting=faceLighting(f,sun);
       const color=f.color.map(n=>Math.round(n*255*lighting));
       for(let i=1;i<points.length-1;i++)triangle(points[0],points[i],points[i+1],color);
       if(f.edge)for(let i=0;i<points.length;i++)edges.push({a:points[i],b:points[(i+1)%points.length],color:f.edge.map(n=>Math.round(n*255*(sun.daylight?1:.48)))});
     }
     for(const line of lines)edges.push({a:project(line.points[0]),b:project(line.points[1]),color:line.color.map(n=>Math.round(n*255*(sun.daylight?1:.48)))});
     for(const edge of edges)stroke(edge.a,edge.b,edge.color);
     // putImageData ignores transforms; a temporary canvas preserves high-DPI sizing.
     if(canvas.width===W&&canvas.height===H)ctx.putImageData(pixels,0,0);
     else{const scratch=draw.scratch||(draw.scratch=document.createElement('canvas'));scratch.width=W;scratch.height=H;scratch.getContext('2d').putImageData(pixels,0,0);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(scratch,0,0,canvas.width,canvas.height);}

   }
   return {width,height,origin:project(origin),sun:project(sunPoint),cardinals:cardinals.map(c=>({...c,point:project(c.point)}))};
 }
 function dispose(){disposed=true;if(gl){gl.deleteBuffer(buffer);gl.deleteBuffer(colors);gl.deleteProgram(program);}}
 return {canvas,camera,draw,dispose,mode:gl?'webgl':ctx?'fallback':'unavailable'};
}
