import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const headers=await fs.readFile(path.join(root,'hosting/_headers'),'utf8');
const csp=headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
if(!csp?.includes('img-src \'self\' data: https://tile.openstreetmap.org'))throw new Error('The hosting CSP must permit OpenStreetMap tiles.');
// A document policy also protects hosts that do not implement _headers.
// frame-ancestors is response-header-only and is omitted from the meta policy.
const documentCsp=csp.replace(/;\s*frame-ancestors\s+[^;]+/g,'');
const source=await fs.readFile(path.join(root,'index.html'),'utf8');
if(!/<head>/i.test(source))throw new Error('index.html must contain a head element.');
const html=source.replace(/<head>/i,`<head><meta http-equiv="Content-Security-Policy" content="${documentCsp.replaceAll('&','&amp;').replaceAll('"','&quot;')}"><meta name="referrer" content="no-referrer">`);
await fs.mkdir(dist,{recursive:true});
await fs.writeFile(path.join(dist,'index.html'),html);
await fs.copyFile(path.join(root,'hosting/_headers'),path.join(dist,'_headers'));
for(const directory of ['src','public']){
  const target=path.join(dist,directory);
  await fs.rm(target,{recursive:true,force:true});
  await fs.mkdir(target,{recursive:true});
  for(const entry of await fs.readdir(path.join(root,directory),{withFileTypes:true})){
    const allowed=directory==='src'?/\.(?:js|css)$/:/\.(?:svg|png|json)$/;
    if(!entry.isFile()||!allowed.test(entry.name))throw new Error(`Unexpected public asset: ${directory}/${entry.name}`);
    await fs.copyFile(path.join(root,directory,entry.name),path.join(target,entry.name));
  }
}
console.log('Built static Panelin assets in dist/ with a local-only script policy and optional OpenStreetMap images.');
