import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test('static hosting build preserves app assets and permits only OSM tile images externally',async()=>{
  execFileSync(process.execPath,['scripts/build-static.mjs']);
  const html=await fs.readFile('dist/index.html','utf8');
  const headers=await fs.readFile('dist/_headers','utf8');
  assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
  assert.match(html,/img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
  assert.match(html,/script-src 'self';/);
  assert.match(html,/worker-src 'self';/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
  for(const src of ['src/app.js','src/worker.js','src/form-helper.js','src/map-picker.js','public/favicon.svg']){
    assert.deepEqual(await fs.readFile(`dist/${src}`),await fs.readFile(src));
  }
  const map=await fs.readFile('dist/src/map-picker.js','utf8');
  assert.match(map,/img\.referrerPolicy='origin'/);
  const entries=(await fs.readdir('dist')).sort();
  assert.deepEqual(entries,['_headers','index.html','public','src']);
});
