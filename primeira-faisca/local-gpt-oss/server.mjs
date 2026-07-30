import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const OLLAMA_BASE = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const DEFAULT_MODEL = process.env.LOCAL_MODEL || 'gpt-oss:20b';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://ezrafchev.github.io';
const MAX_BODY = 48_000;

function cors(req, res) {
  const origin = String(req.headers.origin || '');
  const allowed = !origin || origin === ALLOWED_ORIGIN || origin === 'http://localhost:8787' || origin === 'http://127.0.0.1:8787';
  res.setHeader('Access-Control-Allow-Origin', allowed && origin ? origin : ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network');
  res.setHeader('Cache-Control', 'no-store');
  return allowed;
}
function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function normalize(body) {
  return {
    model:String(body?.model || DEFAULT_MODEL),
    messages:Array.isArray(body?.messages) ? body.messages.slice(-20).map((item) => ({
      role:['system','assistant','user'].includes(item?.role) ? item.role : 'user',
      content:String(item?.content || '').slice(0,6000)
    })).filter((item) => item.content) : [],
    temperature:Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : .6,
    top_p:Number.isFinite(Number(body?.top_p)) ? Number(body.top_p) : .92,
    max_tokens:Math.min(Math.max(Number(body?.max_tokens || 1800), 32), 6000),
    stream:Boolean(body?.stream),
    response_format:body?.response_format
  };
}

const server = http.createServer(async (req, res) => {
  if (!cors(req, res)) return json(res, 403, { error:'Origem não autorizada.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/tags`);
      const data = await response.json().catch(() => ({}));
      return json(res, response.ok ? 200 : 502, { ok:response.ok, runtime:'ollama', default_model:DEFAULT_MODEL, models:data?.models?.map((item)=>item.name) || [] });
    } catch (error) { return json(res, 502, { ok:false, error:error?.message || 'Runtime local indisponível.' }); }
  }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { error:'Rota não encontrada.' });

  try {
    const payload = normalize(await readBody(req));
    if (!payload.messages.length) return json(res, 400, { error:'Envie ao menos uma mensagem.' });
    const upstream = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload)
    });
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return json(res, upstream.status, data?.error ? data : { error:`O runtime local respondeu ${upstream.status}.` });
    }
    res.writeHead(200, { 'Content-Type':upstream.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control':'no-store' });
    if (!upstream.body) return res.end(await upstream.text());
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    if (error?.message === 'BODY_TOO_LARGE') return json(res, 413, { error:'Solicitação muito grande.' });
    return json(res, 502, { error:error?.message || 'Falha no bridge local.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Primeira Faísca gpt-oss bridge: http://127.0.0.1:${PORT}`);
  console.log(`Ollama: ${OLLAMA_BASE} | modelo padrão: ${DEFAULT_MODEL}`);
});