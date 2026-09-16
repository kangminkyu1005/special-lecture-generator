const ids = new Set(['quarterly', 'lecture']);
const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store'}});
export async function noticeApi(request: Request, env: any) {
  const url = new URL(request.url), id = url.pathname.split('/').pop()!;
  if (!ids.has(id)) return json({error:'없는 안내문입니다.'},404);
  if (!env.DB) return json({error:'공용 저장소에 연결할 수 없습니다.'},503);
  try {
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT payload, revision, updated_at FROM shared_notices WHERE id = ?').bind(id).first();
      return json(row ? {data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at} : {data:null,revision:0,updatedAt:null});
    }
    if (request.method !== 'PUT') return json({error:'지원하지 않는 요청입니다.'},405);
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({error:'허용되지 않은 요청입니다.'},403);
    if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'JSON 형식이 필요합니다.'},415);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1800000) return json({error:'안내문 용량이 큽니다. 로고 크기 또는 저장본 수를 줄여 주세요.'},413);
    let input; try {input=JSON.parse(raw);} catch {return json({error:'올바른 JSON이 아닙니다.'},400);}
    if (!Number.isSafeInteger(input.revision) || input.revision < 0 || !input.data || !Array.isArray(input.data.drafts) || input.data.drafts.length>100 || !input.data.current || typeof input.data.current !== 'object') return json({error:'안내문 형식이 올바르지 않습니다.'},400);
    const current = input.data.current;
    if (id==='quarterly' ? current.schemaVersion!==1 || !Array.isArray(current.groups) : !current.fields || !Array.isArray(current.exclusions) || !Array.isArray(current.schedules)) return json({error:'안내문 형식이 올바르지 않습니다.'},400);
    const updatedAt = new Date().toISOString(), payload=JSON.stringify(input.data);
    const result = input.revision===0
      ? await env.DB.prepare('INSERT INTO shared_notices (id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(id,payload,updatedAt).run()
      : await env.DB.prepare('UPDATE shared_notices SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(payload,updatedAt,id,input.revision).run();
    if (!result.meta.changes) return json({error:'다른 화면에서 먼저 수정했습니다. 내용을 확인해 주세요.'},409);
    return json({revision:input.revision+1,updatedAt});
  } catch (error) {console.error('Notice storage failed', error); return json({error:'공용 저장에 실패했습니다. 잠시 후 다시 시도합니다.'},503);}
}
