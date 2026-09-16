import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../outputs/shared-sync.js',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,10));
function browser(server,initial){
 let state=structuredClone(initial),interval,online=true;
 const buttons={};const status={textContent:''};
 const panel={offsetHeight:40,querySelector(s){return buttons[s]??=( {hidden:true} )}};
 const editor={inert:false,addEventListener(){}};
 const document={hidden:false,createElement:()=>panel,documentElement:{style:{setProperty(){}}},querySelector:s=>s==='.studio-header'?{after(){}}:editor,addEventListener(){}};
 const storage=new Map();
 const context={document,ResizeObserver:class{observe(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{interval=fn},AbortSignal,Event,JSON,console,
 fetch:async(url,options)=>{if(!online)throw Error('offline');if(options.method==='PUT'){const input=JSON.parse(options.body);if(input.revision!==server.revision)return {ok:false,status:409,json:async()=>({error:'conflict'})};server.data=input.data;server.revision++;return {ok:true,json:async()=>({revision:server.revision})};}return {ok:true,json:async()=>structuredClone(server)};}};
 context.window={addEventListener(){},dispatchEvent(){}};vm.runInNewContext(source,context);
 const sync=context.window.createNoticeSync({id:'quarterly',read:()=>state,apply:d=>state=d,status});
 return {edit(value){state.current.weeks=value;sync.changed()},tick:()=>interval(),get data(){return state},get status(){return status.textContent},buttons,storage,setOnline:value=>online=value};
}
test('independent devices share edits, preserve pending offline work, and expose conflicts',async()=>{
 const initial={current:{weeks:12},drafts:[]},server={data:null,revision:0};
 const a=browser(server,initial),b=browser(server,initial);await wait();
 a.edit(11);a.tick();await wait();b.tick();await wait();assert.equal(b.data.current.weeks,11);
 const c=browser(server,initial);await wait();assert.equal(c.data.current.weeks,11);
 a.setOnline(false);a.edit(10);a.tick();await wait();assert.match(a.status,/연결 대기/);assert.equal(server.data.current.weeks,11);assert.ok(a.storage.size);
 a.setOnline(true);a.tick();await wait();b.tick();await wait();assert.equal(b.data.current.weeks,10);
 a.edit(9);b.edit(8);a.tick();await wait();b.tick();await wait();assert.match(b.status,/다른 화면/);assert.equal(server.data.current.weeks,9);assert.equal(b.data.current.weeks,8);
 await b.buttons['[data-reload]'].onclick();assert.equal(b.data.current.weeks,9);assert.ok(b.storage.size);
});
