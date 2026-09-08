/* Date-only arithmetic: all internal days are UTC day numbers, never local instants. */
export const DAY = 86400000;
export function parse(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('날짜를 입력해 주세요.');
  const n = Date.parse(s + 'T00:00:00Z') / DAY;
  if (!Number.isFinite(n) || iso(n) !== s) throw new Error('유효한 날짜를 입력해 주세요.');
  return n;
}
export const iso = n => new Date(n * DAY).toISOString().slice(0, 10);
export const weekday = n => new Date(n * DAY).getUTCDay();
export const short = s => s ? `${Number(s.slice(5,7))}/${Number(s.slice(8,10))}` : '미정';
export const daysText = days => days.length>2&&days.every((d,i)=>i===0||d===days[i-1]+1)?`${'일월화수목금토'[days[0]]}~${'일월화수목금토'[days.at(-1)]}`:days.map(d => '일월화수목금토'[d]).join('·');
export function validate(s) {
  if (!Number.isInteger(s.year) || s.year < 1900 || s.year > 2100) throw new Error('연도는 1900~2100 사이로 입력해 주세요.');
  if (![1,2,3,4].includes(s.quarter)) throw new Error('분기를 선택해 주세요.');
  if (!Number.isInteger(s.weeks) || s.weeks < 1 || s.weeks > 52) throw new Error('수업 주 수는 1~52주로 입력해 주세요.');
  if (!Array.isArray(s.days) || !s.days.length || s.days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw new Error('수업 요일을 하나 이상 선택해 주세요.');
  const start=parse(s.start);
  if (!s.days.includes(weekday(start))) throw new Error('시작일은 선택한 수업 요일이어야 합니다.');
  if (!Array.isArray(s.closures) || s.closures.length>30) throw new Error('휴원 기간은 30개까지 입력할 수 있습니다.');
  s.closures.forEach(c=> { if (parse(c.end)<parse(c.start)) throw new Error('휴원 종료일은 시작일 이후여야 합니다.'); });
}
export function calculate(s) {
  validate(s);
  const start=parse(s.start), anchor=weekday(start);
  const offsets=[...new Set(s.days.map(d=>(d-anchor+7)%7))].sort((a,b)=>a-b);
  const closed=s.closures.map(c=>({...c,a:parse(c.start),b:parse(c.end)}));
  const weeks=[], skipped=[], dates={};
  let cursor=start, limit=0;
  while(weeks.length<s.weeks) {
    if (++limit>1100) throw new Error('휴원 기간이 너무 깁니다. 날짜를 확인해 주세요.');
    const scheduled=offsets.map(o=>cursor+o);
    const conflicts=closed.filter(c=>scheduled.some(d=>d>=c.a && d<=c.b));
    if(conflicts.length) skipped.push({start:iso(cursor),end:iso(cursor+offsets.at(-1)),names:conflicts.map(c=>c.name)});
    else {
      const item={index:weeks.length+1,badge:weeks.length%4+1,start:iso(cursor),end:iso(scheduled.at(-1)),dates:scheduled.map(iso)};
      item.dates.forEach(d=>dates[d]=item.badge); weeks.push(item);
    }
    cursor+=7;
  }
  const end=weeks.at(-1).end;
  let next=parse(end)+1;
  while(!s.days.includes(weekday(next))) next++;
  return {weeks,skipped,dates,start:weeks[0].start,end,nextStart:iso(next)};
}
export function makeupDates(s,result,g) {
  // Three course cycles, not three calendar months: a closure may move a cycle into another month.
  return [0,1,2].map(i=> {
    if (g.manual?.[i]) return {date:g.manual[i],manual:true};
    const w=result.weeks[i*4+Number(g.week)-1];
    if(!w) return {date:'',manual:false};
    const a=parse(w.start), date=iso(a+(Number(g.day)-weekday(a)+7)%7);
    return {date,manual:false};
  });
}
export function monthRows(year,month) {
  const first=parse(`${year}-${String(month).padStart(2,'0')}-01`);
  const end=Date.UTC(year,month,0)/DAY;
  const start=first-weekday(first), rows=[];
  for(let d=start;d<=end;d+=7) rows.push(Array.from({length:7},(_,i)=>({date:iso(d+i),inMonth:d+i>=first&&d+i<=end,day:new Date((d+i)*DAY).getUTCDate()})));
  return rows;
}
export function advance(s,result) {
  const quarter=s.quarter%4+1,year=s.year+(s.quarter===4?1:0);
  return {...s,year,quarter,start:result.nextStart,
    carry:{dates:{...(s.carry?.dates||{}),...result.dates},closures:[...(s.carry?.closures||[]),...s.closures]},
    closures:s.closures.filter(c=>c.end>=result.nextStart),events:[],holidays:[],holidayMode:'auto',
    groups:s.groups.map(g=>({...g,manual:['','','']}))};
}
