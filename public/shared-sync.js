/* Shared source of truth; local storage is only a recovery copy. */
window.createNoticeSync = function ({id, read, apply, status, legacy}) {
  let revision=0, ready=false, pending=false, busy=false, applying=false, conflict=false, timer, last='', generation=0;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fingerprint=x=>JSON.stringify(x,(k,v)=>k==='updatedAt'?undefined:v);
  const backupKey='playwell.shared-recovery.'+id;
  const box=document.createElement('div');box.className='shared-sync-panel';
  box.innerHTML='<span>공용 안내문 · 이 링크를 연 사람과 함께 편집합니다.</span><button type="button" data-legacy hidden>이 기기의 기존 내용 가져오기</button><button type="button" data-recovery hidden>미저장 입력 복구</button><button type="button" data-reload hidden>공용 내용 불러오기</button><button type="button" data-retry hidden>내 입력 다시 저장</button>';
  document.querySelector('.studio-header').after(box);
  new ResizeObserver(()=>{document.documentElement.style.setProperty('--sync-height',box.offsetHeight+'px');window.dispatchEvent(new Event('resize'));}).observe(box);
  const button=n=>box.querySelector('[data-'+n+']');
  let recovery=null;try{recovery=JSON.parse(localStorage.getItem(backupKey));}catch{}
  button('recovery').hidden=!recovery;button('legacy').hidden=!legacy;
  const setStatus=s=>{status.textContent=s;};
  const recoverySave=()=>{try{localStorage.setItem(backupKey,JSON.stringify(read()));}catch{}};
  const mark=()=>{if(!ready||applying)return;const data=read();if(fingerprint(data)===last&&!pending)return;pending=true;generation++;recoverySave();setStatus(conflict?'동시 수정 확인 필요 · 내 입력 보관됨':'공용 저장 대기 중…');clearTimeout(timer);timer=setTimeout(tick,350);};
  const accept=(data)=>{applying=true;try{apply(clone(data));last=fingerprint(read());}finally{applying=false;}};
  async function request(method='GET',data) {
    const response=await fetch('/api/notices/'+id,{method,cache:'no-store',headers:method==='PUT'?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12000)});
    const result=await response.json();if(!response.ok){const e=new Error(result.error||'연결 실패');e.status=response.status;throw e;}return result;
  }
  async function tick(){
    if(busy||conflict)return;busy=true;
    try {
      if(!ready){
        const remote=await request();revision=remote.revision;
        if(remote.data)accept(remote.data);else last=fingerprint(read());
        ready=true;setStatus('공용 연결됨 · 자동 갱신 중');
      } else if(pending){
        const data=clone(read()), sentGeneration=generation;
        setStatus('공용 저장 중…');const result=await request('PUT',{revision,data});revision=result.revision;last=fingerprint(data);
        pending=sentGeneration!==generation;
        if(!pending){try{localStorage.removeItem(backupKey);}catch{}button('recovery').hidden=true;}
        setStatus(pending?'공용 저장 대기 중…':'공용 저장됨 · 자동 갱신 중');
      } else {
        const remote=await request();
        // An edit may have started while the read request was in flight.
        if(pending)return;
        if(remote.revision!==revision&&remote.data){accept(remote.data);revision=remote.revision;setStatus('최신 내용 반영됨 · 자동 갱신 중');}
        else setStatus('공용 연결됨 · 자동 갱신 중');
      }
    }catch(error){
      if(error.status===409){conflict=true;button('reload').hidden=false;button('retry').hidden=false;setStatus('다른 화면에서 수정됨 · 아래에서 선택해 주세요');}
      else setStatus(error.status===413?error.message:'연결 대기 · 입력 보관 중, 자동 재시도');
    }finally{busy=false;}
  }
  button('legacy').onclick=()=>{if(!ready)return;accept(legacy);last='';mark();button('legacy').hidden=true;};
  button('recovery').onclick=()=>{if(!ready)return;accept(recovery);last='';mark();button('recovery').hidden=true;};
  button('reload').onclick=async()=>{try{const r=await request();if(r.data)accept(r.data);revision=r.revision;pending=false;conflict=false;button('reload').hidden=true;button('retry').hidden=true;setStatus('공용 내용 불러옴 · 이전 입력은 복구 가능');try{recovery=JSON.parse(localStorage.getItem(backupKey));}catch{}button('recovery').hidden=!recovery;}catch{setStatus('연결 실패 · 다시 눌러 주세요');}};
  button('retry').onclick=async()=>{try{const r=await request();revision=r.revision;conflict=false;button('reload').hidden=true;button('retry').hidden=true;await tick();}catch{setStatus('연결 실패 · 다시 눌러 주세요');}};
  document.querySelector('.studio-nav').addEventListener('click',async e=>{const link=e.target.closest('a');if(!link||!pending)return;e.preventDefault();await tick();if(!pending)window.location.href=link.href;});
  window.addEventListener('pagehide',()=>{if(pending)recoverySave();});
  window.addEventListener('online',tick);window.addEventListener('focus',tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.addEventListener('beforeunload',e=>{if(pending){recoverySave();e.preventDefault();e.returnValue='';}});
  // Block initial editing until the authoritative state has loaded.
  const editor=document.querySelector('.editor')||document.querySelector('.panel');
  if(editor)editor.inert=true;
  const initial=async()=>{await tick();if(ready&&editor)editor.inert=false;};initial();
  setInterval(()=>{if(!document.hidden){if(!ready)initial();else tick();}},2000);
  return {changed:mark, get applying(){return applying;}};
};
