import {parse,iso,weekday,short,daysText,calculate,makeupDates,monthRows,advance} from './quarterly-engine.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AUTO='playwell.quarterly.v1', SAVES=AUTO+'.saved';
const defaults=()=>({schemaVersion:1,year:2026,quarter:4,start:'2026-10-06',weeks:12,days:[2,3,4,5,6],closures:[],events:[],holidays:[],holidayMode:'auto',academy:'PLAYWELL',logo:'',opacity:40,density:'normal',showCount:false,preCopy:'결석 최소 일주일 전 연락 시 본 수업 참여를 도와드립니다.',groups:[{name:'체스로브릭, 로보틱스 베이직',time:'토요일 오후 4시',week:2,day:6,manual:['','','']},{name:'로보틱스 티어 ~ 탑 티어',time:'토요일 오후 4시',week:4,day:6,manual:['','','']}],carry:{dates:{},closures:[]}});
let state=defaults(),result=null,saveTimer,toastTimer,picker={year:2026,month:10,group:0,slot:0},drafts=[],busy=false;
function normalize(raw){
  if(!raw||raw.schemaVersion!==1) throw new Error('이 생성기에서 저장한 설정 파일을 선택해 주세요.');
  const d=defaults(),s={...d};
  for(const k of Object.keys(d)) if(Object.hasOwn(raw,k))s[k]=raw[k];
  for(const k of ['closures','events','holidays','groups'])if(!Array.isArray(s[k])||s[k].length>100)throw new Error('설정 목록 형식이 올바르지 않습니다.');
  for(const k of ['academy','preCopy','logo'])if(typeof s[k]!=='string')throw new Error('텍스트 설정 형식이 올바르지 않습니다.');
  if(s.logo&&!/^data:image\/(png|jpeg|webp);base64,/.test(s.logo))throw new Error('지원하지 않는 로고 형식입니다.');
  s.opacity=Math.min(60,Math.max(20,Number(s.opacity)||40));s.density=s.density==='compact'?'compact':'normal';
  s.groups=s.groups.map(g=>({name:String(g.name||''),time:String(g.time||''),week:[1,2,3,4].includes(Number(g.week))?Number(g.week):2,day:Number.isInteger(Number(g.day))&&Number(g.day)>=0&&Number(g.day)<=6?Number(g.day):6,manual:[0,1,2].map(i=>{const d=g.manual?.[i]||'';if(d)parse(d);return d;})}));
  s.events=s.events.map(e=>({name:String(e.name||''),date:String(e.date||''),note:String(e.note||'')}));
  s.holidays=s.holidays.map(h=>{parse(h.date);return {date:h.date,name:String(h.name||''),enabled:h.enabled!==false};});
  if(!s.carry||typeof s.carry.dates!=='object'||!Array.isArray(s.carry.closures))s.carry={dates:{},closures:[]};
  Object.keys(s.carry.dates).forEach(parse);s.carry.closures.forEach(c=>{parse(c.start);parse(c.end);});
  calculate(s);return s;
}
try{const raw=localStorage.getItem(AUTO);if(raw)state=normalize(JSON.parse(raw));const ds=JSON.parse(localStorage.getItem(SAVES)||'[]');if(Array.isArray(ds))drafts=ds.slice(0,40);}catch{ /* Invalid storage never prevents a fresh document. */ }
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function store(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(AUTO,JSON.stringify(state));$('#save-status').textContent='이 브라우저에 저장됨';}catch{$('#save-status').textContent='저장 공간 부족 · 설정 파일로 저장하세요';}},250);}
function allClosures(){return [...(state.carry?.closures||[]),...state.closures];}
function closedOn(date){return allClosures().find(c=>date>=c.start&&date<=c.end);}
function holidayCandidates(){
  const first=`${state.year}-${String((state.quarter-1)*3+1).padStart(2,'0')}-01`,last=iso(Date.UTC(state.year,state.quarter*3,0)/86400000);
  const low=[first,result?.start||first].sort()[0],high=[last,result?.end||last].sort().at(-1);
  let rows=[];for(let y=Number(low.slice(0,4));y<=Number(high.slice(0,4));y++)rows.push(...(window.QUARTER_HOLIDAYS?.[y]||[]));
  state.holidays=rows.filter(h=>h.date>=low&&h.date<=high).map(h=>({...h,enabled:true}));
}
function syncFields(){
  for(const k of ['year','quarter','start','weeks','academy','opacity','density'])$('#'+k).value=state[k];
  $('#pre-copy').value=state.preCopy;$('#show-count').checked=state.showCount;
  $('#days').innerHTML=Array.from({length:7},(_,d)=>`<label><input type="checkbox" value="${d}" ${state.days.includes(d)?'checked':''}><span>${'일월화수목금토'[d]}</span></label>`).join('');
  renderEditors();renderDrafts();
}
function renderEditors(){
  $('#closure-list').innerHTML=state.closures.map((c,i)=>`<div class="entry"><div class="entry-heading"><strong>휴원 ${i+1}</strong><button data-remove-closure="${i}">삭제</button></div><label>휴원명<input data-closure="${i}" data-key="name" value="${esc(c.name)}" maxlength="40"></label><div class="pair"><label>시작일<input type="date" data-closure="${i}" data-key="start" value="${esc(c.start)}"></label><label>종료일<input type="date" data-closure="${i}" data-key="end" value="${esc(c.end)}"></label></div></div>`).join('');
  $('#holiday-list').innerHTML=state.holidays.map((h,i)=>`<div class="holiday-row"><input type="checkbox" id="h-${i}" data-holiday="${i}" ${h.enabled?'checked':''}><label for="h-${i}">${esc(h.name)} <span class="small">${short(h.date)}(${'일월화수목금토'[weekday(parse(h.date))]}) · ${closedOn(h.date)?'휴원 기간':'정상 수업'}</span></label></div>`).join('')||'<p class="hint">해당 기간의 후보가 없습니다. 자동 후보는 2020~2045년을 지원하며 그 밖의 연도는 직접 추가해 주세요.</p>';
  renderGroups();
  $('#event-list').innerHTML=state.events.map((e,i)=>`<div class="entry"><div class="entry-heading"><strong>일정 ${i+1}</strong><button data-remove-event="${i}">삭제</button></div><label>일정명<input data-event="${i}" data-key="name" maxlength="80" value="${esc(e.name)}"></label><label>날짜 또는 기간<input data-event="${i}" data-key="date" value="${esc(e.date)}" placeholder="예: 9/25~9/27"></label><label>비고<input data-event="${i}" data-key="note" value="${esc(e.note)}" maxlength="140"></label></div>`).join('');
}
function renderGroups(){
  $('#group-list').innerHTML=state.groups.map((g,i)=>`<div class="entry"><div class="entry-heading"><strong>클래스 ${i+1}</strong><button data-remove-group="${i}">삭제</button></div><label>클래스명<input data-group="${i}" data-key="name" value="${esc(g.name)}" maxlength="80"></label><label>시간<input data-group="${i}" data-key="time" value="${esc(g.time)}" maxlength="40"></label><div class="pair"><label>수업 주차<select data-group="${i}" data-key="week">${[1,2,3,4].map(w=>`<option value="${w}" ${g.week===w?'selected':''}>${w}주차</option>`).join('')}</select></label><label>보강 요일<select data-group="${i}" data-key="day">${Array.from({length:7},(_,d)=>`<option value="${d}" ${g.day===d?'selected':''}>${'일월화수목금토'[d]}요일</option>`).join('')}</select></label></div><div class="date-buttons" id="g-dates-${i}"></div></div>`).join('');
  renderDateButtons();
}
function renderDateButtons(){state.groups.forEach((g,i)=>{const el=$('#g-dates-'+i);if(!el)return;const values=result?makeupDates(state,result,g):[0,1,2].map(()=>({date:''}));el.innerHTML=values.map((v,k)=>`<button data-pick="${i}" data-slot="${k}" class="${v.manual?'manual ':''}${v.date&&closedOn(v.date)?'conflict':''}">${short(v.date)}<small>${v.date&&closedOn(v.date)?'휴원 · 변경 필요':v.manual?'직접 지정':`${k+1}회 · 자동`}</small></button>`).join('');});}
function dateCaption(date){return `${short(date)}(${'일월화수목금토'[weekday(parse(date))]})`;}
function calendar(month){
  const map={...(state.carry?.dates||{}),...result.dates};
  const rows=monthRows(state.year,month);
  const colors=['249,115,22','34,197,94','59,130,246','139,92,246'];
  return `<div class="month"><h2>${month}월</h2><table class="cal"><thead><tr>${Array.from({length:7},(_,d)=>`<th class="${d===0?'sun':d===6?'sat':''}">${'일월화수목금토'[d]}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>{
    const inside=row.filter(c=>c.inMonth),whole=inside.length&&closedOn(inside[0].date);
    if(whole&&inside.every(c=>c.date>=whole.start&&c.date<=whole.end))return `<tr><td colspan="7" class="closed-cell">${esc(whole.name||'휴원')} (${short(whole.start)}~${short(whole.end)})</td></tr>`;
    let cells='';for(let i=0;i<7;i++){
      const cell=row[i],c=cell.inMonth?closedOn(cell.date):null;
      if(c){let span=1;while(i+span<7&&row[i+span].inMonth&&row[i+span].date<=c.end&&row[i+span].date>=c.start)span++;const label=`${c.name||'휴원'} (${short(c.start)}~${short(c.end)})`;cells+=`<td colspan="${span}" class="closed-cell" title="${esc(label)}">${span<3?'휴원':esc(label)}</td>`;i+=span-1;continue;}
      const previousMonth=cell.date<`${state.year}-${String(month).padStart(2,'0')}-01`;
      const show=cell.inMonth||(month===(state.quarter-1)*3+1&&previousMonth&&!!map[cell.date]);
      const badge=show?Number(map[cell.date]):0,bg=badge>=1&&badge<=4?`background:rgba(${colors[badge-1]},${state.opacity/100})`:'';
      cells+=`<td class="${i===0?'sun':i===6?'sat':''} ${!cell.inMonth?'outside-date':''}" style="${bg}">${show?(cell.inMonth?cell.day:short(cell.date)):''}</td>`;
    }return `<tr>${cells}</tr>`;}).join('')}</tbody></table></div>`;
}
function renderSheet(){
  const months=Array.from({length:3},(_,i)=>(state.quarter-1)*3+i+1),colors=['249,115,22','34,197,94','59,130,246','139,92,246'];
  const normal=state.holidays.filter(h=>h.enabled&&!closedOn(h.date));
  const closures=allClosures().filter((c,i,a)=>a.findIndex(x=>x.start===c.start&&x.end===c.end&&x.name===c.name)===i).filter(c=>c.end>=`${state.year}-${String(months[0]).padStart(2,'0')}-01`&&c.start<=result.end);
  $('#sheet').className='sheet '+(state.density==='compact'?'compact':'');
  $('#sheet').innerHTML=`<header class="notice-header"><h1>${state.year}년 ${state.quarter}분기 안내문 (${months[0]}월 ~ ${months[2]}월)</h1><div class="week-legend">${colors.map((c,i)=>`<span style="background:rgba(${c},${state.opacity/100})">${i+1}주차</span>`).join('')}</div></header><section class="calendar-box"><div class="months">${months.map(calendar).join('')}</div><p class="period-note">${state.quarter}분기는 <strong>${short(result.start)} ~ ${short(result.end)}</strong> 까지이며 <strong>${daysText(state.days)}</strong> ${state.showCount?`${state.weeks}주 `:''}수업으로 진행됩니다.</p></section><div class="notice-bottom"><div><section class="notice-section"><h2>휴원 안내</h2><div class="notice-row"><span class="chip">정상 수업</span><span>${normal.length?normal.map(h=>`${esc(h.name)} ${dateCaption(h.date)}`).join(', ')+' 모두 정상 수업':'지정된 휴원 기간 외 공휴일 정상 수업'}</span></div>${closures.map(c=>`<div class="notice-row"><span class="chip closed">휴원 기간</span><span>${esc(c.name||'휴원')} ${dateCaption(c.start)} ~ ${dateCaption(c.end)}</span></div>`).join('')}</section><section class="notice-section event-section"><h2>대회 및 특강 &amp; 주요 일정</h2><table class="event-table"><tbody>${state.events.filter(e=>e.name).length?state.events.filter(e=>e.name).map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.date)||'미정'}</td><td>${esc(e.note)||'-'}</td></tr>`).join(''):'<tr><td colspan="3" class="empty-note">TBD — 일정 확정 후 별도 공지 예정</td></tr><tr><td>-</td><td>-</td><td>-</td></tr>'}</tbody></table></section></div><section class="notice-section"><h2>보강 일정 안내</h2><p>분기별 보강 횟수는 <b>3회</b>입니다. 결석 시 <b>미리 보강</b>을 권장드리며, 어려운 경우 <b>추후 보강</b>으로 참여해 주세요.</p><div class="makeup-sub">▶ 미리 보강</div><p>${esc(state.preCopy)}</p><div class="makeup-sub">▶ 추후 보강</div><p>아래의 보강일에 예약 후 참여할 수 있습니다.</p><table class="makeup-table"><thead><tr><th>클래스명</th><th>시간</th><th>날짜</th></tr></thead><tbody>${state.groups.map(g=>`<tr><td>${esc(g.name)||'클래스명'}</td><td>${esc(g.time)||'미정'}</td><td>${makeupDates(state,result,g).map(v=>short(v.date)).join(', ')}</td></tr>`).join('')}</tbody></table><p class="warn-note">※ 미리 보강(주중 보강), 추후 보강 모두 예약을 꼭 해주셔야 하며 결석 시 보강은 소멸됩니다.</p></section></div><footer class="notice-footer"><span>${esc(state.academy==='PLAYWELL'?'':state.academy)}</span><img src="${esc(state.logo||'playwell-official-logo-main.png')}" alt="${esc(state.academy)} 로고"></footer>`;
}
function layoutWarnings(){
  const issues=[];
  for(const g of state.groups){const dates=makeupDates(state,result,g);if(dates.some(v=>!v.date))issues.push(`${g.name}: 미정 보강일을 선택해 주세요.`);if(dates.some(v=>v.date&&closedOn(v.date)))issues.push(`${g.name}: 휴원 기간과 겹치는 보강일을 변경해 주세요.`);if(new Set(dates.filter(v=>v.date).map(v=>v.date)).size<dates.filter(v=>v.date).length)issues.push(`${g.name}: 보강 날짜가 중복됩니다.`);}
  const bottom=$('.notice-bottom'),footer=$('.notice-footer');
  if(bottom&&[...bottom.children].some(el=>el.scrollHeight>bottom.clientHeight+3)||footer&&footer.getBoundingClientRect().bottom>$('#sheet').getBoundingClientRect().bottom+2)issues.push('한 장의 내용이 넘칩니다. 글자 크기를 줄이거나 문구를 간추려 주세요.');
  return [...new Set(issues)];
}
function update({editors=false,holidays=false}={}){
  try{result=calculate(state);if(holidays&&state.holidayMode==='auto')holidayCandidates();$('#period-result').textContent=`${short(result.start)} ~ ${short(result.end)}`;$('#week-result').textContent=`${result.weeks.length}주 수업 · ${result.skipped.length}주 휴원 · 다음 시작 ${short(result.nextStart)}`;$('#week-list').innerHTML=result.weeks.map(w=>`${w.index}번째 수업 주 · ${w.badge}주차 · ${short(w.start)} ~ ${short(w.end)}`).join('<br>');$('#opacity-value').value=state.opacity+'%';renderSheet();if(editors)renderEditors();else renderDateButtons();fit();$('#validation').textContent=layoutWarnings().join(' ');store();}catch(e){result=null;$('#validation').textContent=e.message;$('#period-result').textContent='입력 확인 필요';$('#week-result').textContent='미리보기는 마지막으로 계산된 상태입니다.';}
  ['png','pdf','print','html','next-quarter'].forEach(k=>$('#'+k).disabled=!result||busy);
}
function fit(){const stage=$('#stage');$('#fit').style.transform=`scale(${Math.max(.1,Math.min((stage.clientWidth-8)/1123,(stage.clientHeight-8)/794,1.5))})`;}
function renderDrafts(){$('#saved-list').innerHTML='<option value="">저장본 선택</option>'+drafts.map((s,i)=>`<option value="${i}">${esc(s.title)}</option>`).join('');}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const filename=()=>`${state.year}년_${state.quarter}분기_안내문`;
async function capture(){
  if(!result)throw new Error('날짜 입력을 확인해 주세요.');
  await document.fonts.ready;
  await Promise.all([...$('#sheet').querySelectorAll('img')].map(i=>i.decode()));
  const warnings=layoutWarnings();if(warnings.some(w=>w.includes('내용이 넘칩니다')))throw new Error('내용이 한 장을 넘습니다. 글자 크기나 문구를 조정해 주세요.');
  return window.html2canvas($('#sheet'),{scale:2.5,backgroundColor:'#fff',logging:false,useCORS:true,width:1123,height:794,windowWidth:1500,windowHeight:1000,onclone:doc=>{const p=doc.querySelector('#sheet');doc.body.innerHTML='';doc.body.append(p);doc.body.style.cssText='margin:0;padding:0;display:block;background:white';p.style.cssText='transform:none;margin:0;width:1123px;height:794px';}});
}
async function exportFile(kind){
  if(busy)return;busy=true;update();toast(kind==='png'?'고해상도 이미지를 만드는 중입니다…':'PDF를 만드는 중입니다…');
  try{const canvas=await capture();if(kind==='png'){const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw new Error('이미지 생성에 실패했습니다.');download(blob,filename()+'.png');}else{const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,297,210);pdf.save(filename()+'.pdf');}toast('다운로드했습니다.');}catch(e){toast(e.message||'다운로드하지 못했습니다. 다시 시도해 주세요.');}finally{busy=false;update();}
}
function pickerRender(){
  $('#picker-month').textContent=`${picker.year}년 ${picker.month}월`;const g=state.groups[picker.group],v=makeupDates(state,result,g)[picker.slot];
  $('#picker-grid').innerHTML='<div class="picker">'+Array.from({length:7},(_,d)=>`<span>${'일월화수목금토'[d]}</span>`).join('')+monthRows(picker.year,picker.month).flat().map(c=>`<button data-date="${c.date}" aria-label="${c.date}${closedOn(c.date)?' 휴원':''}" class="${!c.inMonth?'outside ':''}${closedOn(c.date)?'closed ':''}${v.date===c.date?'selected':''}">${c.day}</button>`).join('')+'</div>';
}
function openPicker(group,slot){if(!result)return;const date=makeupDates(state,result,state.groups[group])[slot].date||result.start;picker={group,slot,year:Number(date.slice(0,4)),month:Number(date.slice(5,7))};$('#date-title').textContent=`${slot+1}회 보강 날짜 선택`;pickerRender();$('#date-dialog').showModal();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  for(const [attr,key] of [['removeClosure','closures'],['removeEvent','events'],['removeGroup','groups']])if(b.dataset[attr]!==undefined){state[key].splice(Number(b.dataset[attr]),1);update({editors:true,holidays:key==='closures'});return;}
  if(b.dataset.pick!==undefined)openPicker(Number(b.dataset.pick),Number(b.dataset.slot));
  if(b.dataset.date){const date=b.dataset.date;if(closedOn(date)){toast('휴원 기간 밖의 보강 날짜를 선택해 주세요.');return;}state.groups[picker.group].manual[picker.slot]=date;$('#date-dialog').close();update();}
});
$('.form-scroll').addEventListener('input',e=>{
  const el=e.target;
  if(el.closest('#days')){state.days=$$('#days input:checked').map(e=>Number(e.value));update({holidays:true});return;}
  for(const [attr,key] of [['closure','closures'],['group','groups'],['event','events']])if(el.dataset[attr]!==undefined){const value=['week','day'].includes(el.dataset.key)?Number(el.value):el.value;state[key][el.dataset[attr]][el.dataset.key]=value;if(key==='groups'&&['week','day'].includes(el.dataset.key))state.groups[el.dataset[attr]].manual=['','',''];update({holidays:key==='closures'});return;}
  if(el.dataset.holiday!==undefined){state.holidayMode='manual';state.holidays[el.dataset.holiday].enabled=el.checked;update();return;}
  if(['year','quarter','weeks','opacity'].includes(el.id))state[el.id]=Number(el.value);
  else if(['start','academy','density'].includes(el.id))state[el.id]=el.value;
  else if(el.id==='pre-copy')state.preCopy=el.value;
  else if(el.id==='show-count')state.showCount=el.checked;
  else return;
  if(['year','quarter'].includes(el.id)){state.holidayMode='auto';state.carry={dates:{},closures:[]};}
  update({holidays:['year','quarter','start','weeks'].includes(el.id)});
});
$$('[role=tab]').forEach((b,i)=>{b.onclick=()=>{$$('[role=tab]').forEach(t=>{t.setAttribute('aria-selected',String(t===b));t.tabIndex=t===b?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=t!==b;});renderEditors();$('.form-scroll').scrollTop=0;};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const a=$$('[role=tab]'),j=e.key==='Home'?0:e.key==='End'?a.length-1:(i+(e.key==='ArrowRight'?1:-1)+a.length)%a.length;a[j].click();a[j].focus();}};});
$('#add-closure').onclick=()=>{state.closures.push({name:'휴원',start:state.start,end:iso(parse(state.start)+4)});update({editors:true,holidays:true});};
$('#add-group').onclick=()=>{state.groups.push({name:'',time:'토요일 오후 4시',week:2,day:6,manual:['','','']});update({editors:true});};
$('#add-event').onclick=()=>{state.events.push({name:'',date:'',note:''});update({editors:true});};
$('#add-holiday').onclick=()=>{try{const date=$('#holiday-date').value;parse(date);const name=$('#holiday-name').value.trim();if(!name)throw new Error('공휴일 이름을 입력해 주세요.');state.holidayMode='manual';state.holidays.push({name,date,enabled:true});update({editors:true});$('#holiday-name').value='';$('#holiday-date').value='';}catch(e){toast(e.message);}};
$('#refresh-holidays').onclick=()=>{state.holidayMode='auto';update({editors:true,holidays:true});};
$('#next-quarter').onclick=()=>{saveDraft(false);state=advance(state,result);syncFields();update({editors:true,holidays:true});toast('다음 분기를 만들었습니다. 휴원 기간과 주요 일정을 확인해 주세요.');};
function saveDraft(notify=true){const title=`${state.year}년 ${state.quarter}분기 · ${new Date().toLocaleString('ko-KR')}`;drafts.unshift({title,state:JSON.parse(JSON.stringify(state))});drafts=drafts.slice(0,40);try{localStorage.setItem(SAVES,JSON.stringify(drafts));renderDrafts();if(notify)toast('현재 분기를 보관했습니다.');}catch{toast('저장 공간이 부족합니다. 설정 파일로 저장해 주세요.');}}
$('#save-draft').onclick=()=>{if(result)saveDraft();};$('#load-draft').onclick=()=>{const v=$('#saved-list').value;if(v==='')return;try{state=normalize(drafts[Number(v)].state);syncFields();update();toast('저장본을 불러왔습니다.');}catch(e){toast(e.message);}};
$('#json-save').onclick=()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),filename()+'_설정.json');
$('#json-load').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>8e6)throw new Error('설정 파일은 8MB 이하로 선택해 주세요.');state=normalize(JSON.parse(await f.text()));syncFields();update();toast('설정을 불러왔습니다.');}catch(err){toast(err.message);}e.target.value='';};
$('#reset').onclick=()=>{if(!confirm('현재 입력을 기본값으로 초기화할까요? 보관한 안내문은 유지됩니다.'))return;state=defaults();syncFields();update({editors:true,holidays:true});};
$('#logo-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>3e6)throw new Error('3MB 이하의 PNG·JPG·WebP 이미지를 선택해 주세요.');state.logo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});update();}catch(err){toast(err.message);}e.target.value='';};$('#logo-reset').onclick=()=>{state.logo='';update();};
$('#picker-prev').onclick=()=>{if(--picker.month<1){picker.month=12;picker.year--;}pickerRender();};$('#picker-next').onclick=()=>{if(++picker.month>12){picker.month=1;picker.year++;}pickerRender();};$('#picker-auto').onclick=()=>{state.groups[picker.group].manual[picker.slot]='';$('#date-dialog').close();update();};
$('#png').onclick=()=>exportFile('png');$('#pdf').onclick=()=>exportFile('pdf');$('#print').onclick=async()=>{await document.fonts.ready;window.print();};
$('#html').onclick=async()=>{try{const css=await (await fetch('quarterly.css')).text(),clone=$('#sheet').cloneNode(true);const logo=clone.querySelector('img');if(!state.logo){const blob=await (await fetch(logo.getAttribute('src'))).blob();logo.src=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob);});}download(new Blob([`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${filename()}</title><style>${css}\nbody{display:flex;justify-content:center;padding:24px}.sheet{box-shadow:0 4px 24px #001e4120}@media print{body{display:block!important;padding:0!important}}</style></head><body>${clone.outerHTML}</body></html>`],{type:'text/html;charset=utf-8'}),filename()+'.html');toast('안내문 HTML을 저장했습니다.');}catch{toast('HTML 저장에 실패했습니다.');}};
$('#zoom').onclick=()=>{const open=$('.preview-area').classList.toggle('expanded');$('#zoom').textContent=open?'편집 화면으로':'크게 보기';fit();};
window.addEventListener('resize',fit);document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('.preview-area').classList.remove('expanded');$('#zoom').textContent='크게 보기';fit();}});
syncFields();update({editors:true,holidays:state.holidayMode==='auto'});document.fonts.ready.then(()=>update());
