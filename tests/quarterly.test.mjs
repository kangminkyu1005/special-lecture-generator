import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,makeupDates,advance,parse,monthRows,noticeClosures} from '../outputs/quarterly-engine.js';
const base=()=>({year:2026,quarter:4,start:'2026-10-06',weeks:12,days:[2,3,4,5,6],closures:[],groups:[{week:2,day:6,manual:[]},{week:4,day:6,manual:[]}],carry:{dates:{},closures:[]}});
test('year-end closure remains in the notice after the final class',()=>{
 const s=base(),closure={name:'겨울 교육연수 및 재정비',start:'2026-12-29',end:'2027-01-02'};
 s.closures=[closure];const r=calculate(s);
 assert.equal(r.end,'2026-12-26');assert.deepEqual(noticeClosures(s,r),[closure]);
});
test('notice includes calendar and extended course closures, deduplicates carry and excludes unrelated quarters',()=>{
 const s=base(),current={name:'휴원',start:'2026-10-08',end:'2026-10-09'},extended={name:'연장 수업 중 휴원',start:'2027-01-01',end:'2027-01-01'};
 s.closures=[current,extended,{name:'다음 분기',start:'2027-02-01',end:'2027-02-02'}];
 s.carry.closures=[current,{name:'지난 분기',start:'2026-09-01',end:'2026-09-02'}];
 assert.deepEqual(noticeClosures(s,calculate(s)),[current,extended]);
});
test('2026 Q4 ends Dec 26 and default makeup matches supplied final HTML',()=>{const s=base(),r=calculate(s);assert.equal(r.end,'2026-12-26');assert.equal(r.nextStart,'2026-12-29');assert.equal(Object.keys(r.dates).length,60);assert.deepEqual(makeupDates(s,r,s.groups[0]).map(x=>x.date),['2026-10-17','2026-11-14','2026-12-12']);assert.deepEqual(makeupDates(s,r,s.groups[1]).map(x=>x.date),['2026-10-31','2026-11-28','2026-12-26']);});
test('supplied Q3 vacation example continues into Q4',()=>{const s={...base(),quarter:3,start:'2026-06-30',closures:[{name:'여름방학',start:'2026-07-28',end:'2026-08-03'},{name:'추석',start:'2026-09-22',end:'2026-09-26'}]};const r=calculate(s);assert.equal(r.end,'2026-10-03');assert.equal(r.skipped.length,2);assert.equal(r.dates['2026-08-04'],1);assert.equal(r.dates['2026-09-29'],4);const next=advance(s,r);assert.equal(next.start,'2026-10-06');assert.equal(next.carry.dates['2026-10-03'],4);assert.equal(calculate(next).dates['2026-10-06'],1);});
test('partial vacation intersecting a class day skips whole teaching week',()=>{const s=base();s.closures=[{name:'휴원',start:'2026-10-08',end:'2026-10-09'}];const r=calculate(s);assert.equal(r.start,'2026-10-13');assert.equal(r.end,'2027-01-02');assert.equal(r.dates['2026-10-06'],undefined);});
test('non-class days do not skip a teaching week, duplicate closures skip once',()=>{const s=base();s.closures=[{start:'2026-10-11',end:'2026-10-12'}];assert.equal(calculate(s).end,'2026-12-26');s.closures=[{start:'2026-10-20',end:'2026-10-24'},{start:'2026-10-22',end:'2026-10-23'}];assert.equal(calculate(s).skipped.length,1);});
test('manual makeup outside quarter persists and leap dates validate',()=>{const s=base(),r=calculate(s);s.groups[0].manual=['2027-01-09'];assert.equal(makeupDates(s,r,s.groups[0])[0].date,'2027-01-09');assert.doesNotThrow(()=>parse('2028-02-29'));assert.throws(()=>parse('2026-02-29'));assert.equal(monthRows(2026,10)[0][4].date,'2026-10-01');});
test('non-consecutive days and week limits',()=>{const s=base();s.days=[2,4,6];assert.equal(Object.keys(calculate(s).dates).length,36);s.days=[];assert.throws(()=>calculate(s));s.days=[2];s.weeks=0;assert.throws(()=>calculate(s));});
