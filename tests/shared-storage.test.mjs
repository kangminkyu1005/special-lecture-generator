import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {noticeApi} from '../worker/notices.ts';
const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE shared_notices(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)');
const env = { DB: { prepare(query) {
 return { bind(...params) { return {
  async first() { return sql.prepare(query).get(...params); },
  async run() { return {meta: {changes: sql.prepare(query).run(...params).changes}}; }
 }; } };
} } };

const data={current:{schemaVersion:1,groups:[],weeks:12},drafts:[]};
const req=(method='GET',body,id='quarterly')=>new Request('https://example.com/api/notices/'+id,{method,headers:{'Content-Type':'application/json','Origin':'https://example.com'},body:body?JSON.stringify(body):undefined});
test('shared data persists across independent requests; stale writers cannot overwrite',async()=>{
 assert.deepEqual((await (await noticeApi(req(),env)).json()).revision,0);
 assert.equal((await noticeApi(req('PUT',{revision:0,data}),env)).status,200);
 const read=await (await noticeApi(req(),env)).json();assert.equal(read.data.current.weeks,12);assert.equal(read.revision,1);
 assert.equal((await noticeApi(req('PUT',{revision:0,data:{...data,current:{...data.current,weeks:11}}}),env)).status,409);
 assert.equal((await (await noticeApi(req(),env)).json()).data.current.weeks,12);
 assert.equal((await noticeApi(req('PUT',{revision:1,data:{...data,current:{...data.current,weeks:11}}}),env)).status,200);
 assert.equal((await (await noticeApi(req(),env)).json()).data.current.weeks,11);
 assert.equal((await (await noticeApi(req('GET',null,'lecture'),env)).json()).revision,0);
});
test('bad requests and missing database report recoverable errors',async()=>{
 assert.equal((await noticeApi(req('PUT',{revision:-1,data}),env)).status,400);
 assert.equal((await noticeApi(req('PUT',{revision:2,data:{}}),env)).status,400);
 assert.equal((await noticeApi(req(),{})).status,503);
 assert.equal((await noticeApi(new Request('https://example.com/api/notices/quarterly',{method:'PUT',headers:{Origin:'https://other.com'}}),env)).status,403);
});
