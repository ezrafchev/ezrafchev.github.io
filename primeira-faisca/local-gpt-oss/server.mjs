import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const OLLAMA_BASE = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.LOCAL_MODEL || 'gpt-oss:20b';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://ezrafchev.github.io';
const MAX_BODY = 64_000;
const CLOUD_MODELS = new Set(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'chat-latest']);
const REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max']);

const MODEL_CATALOG = [
  {
    id: 'gpt-oss:20b',
    family: 'OpenAI',
    name: 'gpt-oss 20B',
    size: '14 GB',
    memory: 'aprox. 16 GB',
    tier: 'Mais capaz da OpenAI para PC',
    description: 'Raciocínio local avançado, saídas estruturadas e uso sem cobrança por token de API.'
  },
  {
    id: 'gpt-oss:120b',
    family: 'OpenAI',
    name: 'gpt-oss 120B',
    size: '65 GB',
    memory: 'GPU com cerca de 80 GB',
    tier: 'Máxima capacidade local',
    description: 'Versão de maior capacidade; indicada para hardware de classe datacenter.'
  },
  {
    id: 'qwen3:8b',
    family: 'Qwen',
    name: 'Qwen3 8B',
    size: '5,2 GB',
    memory: 'aprox. 8 GB',
    tier: 'Melhor equilíbrio',
    description: 'Boa qualidade multilíngue e raciocínio com exigência moderada de memória.'
  },
  {
    id: 'qwen3:4b',
    family: 'Qwen',
    name: 'Qwen3 4B',
    size: '2,5 GB',
    memory: 'aprox. 5 GB',
    tier: 'Recomendado para PCs médios',
    description: 'Rápido, competente em português e adequado para conversas e leituras.'
  },
  {
    id: 'phi4-mini',
    family: 'Microsoft',
    name: 'Phi-4 Mini',
    size: '2,5 GB',
    memory: 'aprox. 5 GB',
    tier: 'Raciocínio leve',
    description: 'Modelo compacto com bom desempenho em instruções, matemática e raciocínio.'
  },
  {
    id: 'gemma3:4b',
    family: 'Google',
    name: 'Gemma 3 4B',
    size: '3,3 GB',
    memory: 'aprox. 6 GB',
    tier: 'Multilíngue e multimodal',
    description: 'Modelo compacto com amplo suporte de idiomas e contexto extenso.'
  },
  {
    id: 'llama3.2:3b',
    family: 'Meta',
    name: 'Llama 3.2 3B',
    size: '2,0 GB',
    memory: 'aprox. 4 GB',
    tier: 'Mais leve',
    description: 'Alternativa pequena com suporte oficial ao português.'
  }
];
const CATALOG_IDS = new Set(MODEL_CATALOG.map((item) => item.id));

let openAIKey = String(process.env.OPENAI_API_KEY || '').trim();

function cors(req, res) {
  const origin = String(req.headers.origin || '');
  const allowed = !origin || origin === ALLOWED_ORIGIN || origin === 'http://localhost:8787' || origin === 'http://127.0.0.1:8787';
  res.setHeader('Access-Control-Allow-Origin', allowed && origin ? origin : ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return allowed;
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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

async function ollamaModels() {
  const response = await fetch(`${OLLAMA_BASE}/api/tags`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Ollama respondeu ${response.status}.`);
  return Array.isArray(data?.models) ? data.models : [];
}

function installedMatch(installed, id) {
  return installed.some((item) => item?.name === id || item?.model === id || (id.endsWith(':latest') && item?.name === id.slice(0, -7)));
}

function normalizeLocalChat(body) {
  return {
    model: String(body?.model || DEFAULT_MODEL),
    messages: Array.isArray(body?.messages) ? body.messages.slice(-20).map((item) => ({
      role: ['system', 'developer', 'assistant', 'user'].includes(item?.role) ? item.role : 'user',
      content: String(item?.content || '').slice(0, 7000)
    })).filter((item) => item.content) : [],
    temperature: Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : 0.6,
    top_p: Number.isFinite(Number(body?.top_p)) ? Number(body.top_p) : 0.92,
    max_tokens: Math.min(Math.max(Number(body?.max_tokens || 1800), 32), 7000),
    stream: Boolean(body?.stream),
    response_format: body?.response_format
  };
}

function outputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item?.text || '')
    .join('\n')
    .trim();
}

async function handleOpenAI(body, res) {
  if (!openAIKey) return json(res, 401, { error: 'Nenhum token da OpenAI está conectado ao bridge local.' });
  const requested = String(body?.model || 'gpt-5.6-sol');
  const model = CLOUD_MODELS.has(requested) ? requested : 'gpt-5.6-sol';
  const requestedEffort = String(body?.reasoning_effort || (model === 'gpt-5.6-sol' ? 'high' : 'medium'));
  const effort = REASONING_EFFORTS.has(requestedEffort) ? requestedEffort : 'medium';
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-16).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: [{ type: 'input_text', text: String(item?.content || '').slice(0, 3500) }]
  })) : [];
  const context = String(body?.context || '').slice(0, 10_000);
  const instructions = String(body?.instructions || `Você é Faísca, uma assistente completa em português do Brasil. Use o contexto apenas quando relevante.\n\nCONTEXTO OPCIONAL:\n${context}`);

  const payload = {
    model,
    instructions,
    input: messages,
    max_output_tokens: Math.min(Math.max(Number(body?.max_output_tokens || 1800), 64), 6000),
    store: false
  };
  if (model !== 'chat-latest') payload.reasoning = { effort };
  if (Boolean(body?.use_web)) {
    payload.tools = [{ type: 'web_search' }];
    payload.tool_choice = 'auto';
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
      'X-Client-Request-Id': globalThis.crypto?.randomUUID?.() || `pf-local-${Date.now()}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(res, response.status, { error: data?.error?.message || `OpenAI respondeu ${response.status}.` });
  const text = outputText(data);
  if (!text) return json(res, 502, { error: 'A OpenAI não retornou texto.' });
  return json(res, 200, { text, model: data?.model || model, response_id: data?.id || '', reasoning_effort: effort });
}

async function proxyStream(upstream, res, fallbackType = 'application/x-ndjson; charset=utf-8') {
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || fallbackType,
    'Cache-Control': 'no-store'
  });
  if (!upstream.body) return res.end(await upstream.text());
  const reader = upstream.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  if (!cors(req, res)) return json(res, 403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const installed = await ollamaModels();
      return json(res, 200, {
        ok: true,
        runtime: 'ollama',
        default_model: DEFAULT_MODEL,
        token_connected: Boolean(openAIKey),
        models: installed.map((item) => item?.name || item?.model).filter(Boolean)
      });
    }

    if (req.method === 'GET' && url.pathname === '/models/catalog') {
      const installed = await ollamaModels();
      return json(res, 200, {
        models: MODEL_CATALOG.map((item) => ({ ...item, installed: installedMatch(installed, item.id) })),
        installed: installed.map((item) => item?.name || item?.model).filter(Boolean)
      });
    }

    if (req.method === 'POST' && url.pathname === '/models/pull') {
      const body = await readBody(req);
      const model = String(body?.model || '').trim();
      if (!CATALOG_IDS.has(model)) return json(res, 400, { error: 'Modelo fora do catálogo permitido.' });
      const upstream = await fetch(`${OLLAMA_BASE}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true })
      });
      return proxyStream(upstream, res);
    }

    if (req.method === 'DELETE' && url.pathname === '/models') {
      const body = await readBody(req);
      const model = String(body?.model || '').trim();
      if (!CATALOG_IDS.has(model)) return json(res, 400, { error: 'Modelo fora do catálogo permitido.' });
      const upstream = await fetch(`${OLLAMA_BASE}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      const data = await upstream.json().catch(() => ({}));
      return json(res, upstream.ok ? 200 : upstream.status, upstream.ok ? { ok: true, model } : { error: data?.error || `Ollama respondeu ${upstream.status}.` });
    }

    if (url.pathname === '/session/openai-key') {
      if (req.method === 'GET') return json(res, 200, { connected: Boolean(openAIKey), source: process.env.OPENAI_API_KEY ? 'environment' : openAIKey ? 'memory' : 'none' });
      if (req.method === 'POST') {
        const body = await readBody(req);
        const token = String(body?.token || '').trim();
        if (token.length < 20 || !/^sk-[A-Za-z0-9_-]+/.test(token)) return json(res, 400, { error: 'Token da OpenAI inválido.' });
        openAIKey = token;
        return json(res, 200, { connected: true, storage: 'memory-only' });
      }
      if (req.method === 'DELETE') {
        if (process.env.OPENAI_API_KEY) return json(res, 409, { error: 'A chave veio da variável de ambiente e não pode ser removida pela interface.' });
        openAIKey = '';
        return json(res, 200, { connected: false });
      }
    }

    if (req.method === 'POST' && url.pathname === '/v1/openai/responses') {
      return handleOpenAI(await readBody(req), res);
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const payload = normalizeLocalChat(await readBody(req));
      if (!payload.messages.length) return json(res, 400, { error: 'Envie ao menos uma mensagem.' });
      const upstream = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(() => ({}));
        return json(res, upstream.status, data?.error ? data : { error: `O runtime local respondeu ${upstream.status}.` });
      }
      return proxyStream(upstream, res, 'application/json; charset=utf-8');
    }

    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    if (error?.message === 'BODY_TOO_LARGE') return json(res, 413, { error: 'Solicitação muito grande.' });
    return json(res, 502, { error: error?.message || 'Falha no bridge local.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Primeira Faísca AI bridge: http://127.0.0.1:${PORT}`);
  console.log(`Ollama: ${OLLAMA_BASE} | modelo padrão: ${DEFAULT_MODEL}`);
  console.log('A chave da OpenAI, quando conectada pela interface, fica somente na memória deste processo.');
});