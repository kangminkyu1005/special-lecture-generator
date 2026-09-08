import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../outputs/'+name,import.meta.url),'utf8');
const app=read('app.js');
const feeSource=app.match(/function formatFee\(value\) \{[\s\S]*?\n  \}/)[0];
const fee=vm.runInNewContext(`(${feeSource})`);
test('fee accepts digits, commas, won symbols and an existing unit without duplication',()=>{
  for(const input of ['180000','180,000','180,000원',' 180,000 원 ','₩180000','180000원원'])assert.equal(fee(input),'180,000원');
  assert.equal(fee('0'),'0원');assert.equal(fee(''),'');assert.equal(fee('무료'),'무료');assert.equal(fee('별도 안내'),'별도 안내');
});
test('intro wraps and its height is checked; PDF cannot bypass layout validation',()=>{
  const css=read('special-lecture-generator.html').match(/\.subline \{[\s\S]*?\n  \}/)[0];
  assert.match(css,/white-space: normal/);assert.doesNotMatch(css,/text-overflow: ellipsis/);
  assert.match(app,/layoutFlags.introOverflow = [^;]*scrollHeight/);
  assert.match(app,/#pdfDownload[\s\S]*layoutFlags.cardsOverflow[\s\S]*window.print/);
});
test('quarterly layout refits from requested density, keeps a visible preview warning and blocks all exports',()=>{
  const app=read('quarterly-app.js');
  assert.match(app,/renderSheet\(\);fitContent\(\)/);
  assert.match(app,/previewWarning.id='preview-validation'/);
  assert.match(app,/classList.toggle\('layout-overflow',contentOverflow\)/);
  assert.match(app,/\['png','pdf','print','html'\].*disabled=.*contentOverflow/);
  assert.match(read('quarterly.css'),/\.sheet.layout-overflow\{height:auto;min-height:794px;overflow:visible\}/);
});
