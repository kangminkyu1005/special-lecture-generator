import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../outputs/'+name,import.meta.url),'utf8');
const pages=['special-lecture-generator.html','quarterly-notice.html'];
test('both editors share identical navigation except current page and status id',()=>{
  const headers=pages.map((p,i)=>{
    const html=read(p),header=html.match(/<header class="studio-header">[\s\S]*?<\/header>/)?.[0];
    assert.ok(header);
    assert.equal((header.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(header.includes(`href="${p}" aria-current="page"`));
    assert.equal((html.match(/href="studio-shell.css"/g)||[]).length,1);
    assert.equal((html.match(new RegExp(`id="${i?'save-status':'saveStatus'}"`,'g'))||[]).length,1);
    return header.replace(' aria-current="page"','').replace('id="saveStatus"','id="save-status"');
  });
  assert.equal(headers[0],headers[1]);
});
test('shared header is omitted from printing and both editors flush before navigation',()=>{
  assert.match(read('studio-shell.css'),/@media print\s*\{\s*\.studio-header\s*\{\s*display:none!important/);
  for(const name of ['app.js','quarterly-app.js']){
    const source=read(name);
    assert.match(source,/\.studio-nav[\s\S]*addEventListener\('click'/);
    assert.match(source,/addEventListener\('pagehide'/);
  }
});
