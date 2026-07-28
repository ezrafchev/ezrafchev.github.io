import { CreateMLCEngine, prebuiltAppConfig } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

const MARKER = 'LOCAL_WEBLLM_UNLIMITED_V85';
const $ = (id) => document.getElementById(id);
const nativeFetch = window.fetch.bind(window);
let engine = null;
let activeModel = '';
let loading = false;

const allIds = (prebuiltAppConfig?.model_list || []).map((item) => item.model_id).filter(Boolean);
const preferredPatterns = [
  { re: /Qwen3.*4B.*Instruct.*q4f16/i, label: 'Qwen3 4B · melhor equilíbrio' },
  { re: /Qwen2\.5-3B-Instruct-q4f16/i, label: 'Qwen2.5 3B · equilibrado' },
  { re: /Phi-3\.5-mini-instruct-q4f16/i, label: 'Phi 3.5 Mini · leitura robusta' },
  { re: /Llama-3\.2-3B-Instruct-q4f16/i, label: 'Llama 3.2 3B · alternativa' },
  { re: /Qwen2\.5-1\.5B-Instruct-q4f16/i, label: 'Qwen2.5 1.5B · mais leve' },
  { re: /SmolLM2-1\.7B-Instruct-q4f16/i, label: 'SmolLM2 1.7B · econômico' },
];

const localModels = [];
for (const pref of preferredPatterns) {
  const id = allIds.find((candidate) => pref.re.test(candidate));
  if (id && !localModels.some((item) => item.id === id)) localModels.push({ id, label: pref.label });
}
if (!localModels.length) {
  const fallback = allIds.find((id) => /Instruct.*q4f16/i.test(id));
  if (fallback) localModels.push({ id: fallback, label: fallback });
}

function headersObject(headers) {
  const out = {};
  if (headers instanceof Headers) headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  else if (Array.isArray(headers)) headers.forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
  else Object.entries(headers || {}).forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
  return out;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function setStatus(message, state = 'idle') {
  const status = $('localAiStatus');
  if (status) {
    status.textContent = message;
    status.dataset.state = state;
  }
  const top = $('aiTopStatus');
  if (top) top.textContent = state === 'ready' ? 'IA local ativa' : state === 'loading' ? 'Baixando IA' : 'Motor local';
  const dot = $('aiDot');
  if (dot) dot.classList.toggle('on', state === 'ready' || state === 'loading');
}

function setProgress(report) {
  const value = Number(report?.progress || 0);
  const bar = $('localAiProgressBar');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  const text = report?.text || 'Preparando modelo local…';
  setStatus(text, 'loading');
}

function geminiPrompt(body) {
  const system = (body?.systemInstruction?.parts || []).map((part) => part.text || '').join('\n');
  const user = (body?.contents || []).flatMap((content) => content.parts || []).map((part) => part.text || '').join('\n\n');
  return { system, user };
}

async function localCompletion(body) {
  if (!engine || !activeModel) throw new Error('A IA local ainda não foi ativada.');
  const { system, user } = geminiPrompt(body);
  const schema = body?.generationConfig?.responseJsonSchema;
  const request = {
    messages: [
      {
        role: 'system',
        content: `${system}\nResponda em português do Brasil. Preserve consentimento, não pressione contato físico e não trate símbolos como prova de sentimentos ocultos. ${schema ? 'Retorne somente JSON válido, sem Markdown ou texto externo.' : 'Não use Markdown desnecessário.'}`,
      },
      { role: 'user', content: user },
    ],
    temperature: 0.45,
    top_p: 0.9,
    max_tokens: Math.min(Number(body?.generationConfig?.maxOutputTokens) || 2500, 4096),
  };
  if (schema) request.response_format = { type: 'json_object' };

  setStatus('A IA local está elaborando a resposta…', 'loading');
  const result = await engine.chat.completions.create(request);
  const text = result?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('A IA local retornou uma resposta vazia.');
  setStatus(`IA local ativa · ${activeModel}`, 'ready');
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const headers = headersObject(init.headers || input?.headers);
  const key = headers['x-goog-api-key'] || '';

  if (url.includes('generativelanguage.googleapis.com/v1beta/models') && key === MARKER) {
    return jsonResponse({
      models: [{ name: 'models/local-webllm', displayName: `IA local · ${activeModel || 'WebLLM'}`, supportedGenerationMethods: ['generateContent'] }],
    });
  }

  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent') && (key === MARKER || url.includes('/local-webllm:generateContent'))) {
    try {
      return await localCompletion(JSON.parse(init.body || '{}'));
    } catch (error) {
      return jsonResponse({ error: { message: error?.message || 'Falha na IA local.' } }, 503);
    }
  }

  return nativeFetch(input, init);
};

async function activateLocalAI() {
  if (loading) return;
  if (!('gpu' in navigator)) {
    setStatus('Este navegador não oferece WebGPU. Use Chrome ou Edge atualizados em um computador compatível.', 'error');
    return;
  }
  const selected = $('localModel')?.value || localModels[0]?.id;
  if (!selected) {
    setStatus('Nenhum modelo local compatível foi encontrado.', 'error');
    return;
  }

  loading = true;
  const button = $('activateLocalAi');
  if (button) { button.disabled = true; button.textContent = 'Baixando modelo…'; }
  try {
    if (!engine || activeModel !== selected) {
      if (engine?.unload) await engine.unload().catch(() => {});
      engine = await CreateMLCEngine(selected, { initProgressCallback: setProgress });
      activeModel = selected;
    }
    const keyInput = $('geminiKey');
    if (keyInput) keyInput.value = MARKER;
    const connectButton = document.querySelector('[data-action="connect-ai"]');
    connectButton?.click();
    setTimeout(() => {
      const modelSelect = $('geminiModel');
      if (modelSelect) modelSelect.value = 'local-webllm';
      const aiState = $('aiState');
      if (aiState) aiState.textContent = `IA local ativa · ${activeModel}`;
      setStatus(`IA local ativa · ${activeModel}`, 'ready');
      const hostRole = $('hostRole');
      const hostMessage = $('hostMessage');
      const hostMode = $('hostMode');
      if (hostRole) hostRole.textContent = 'Anfitriã local';
      if (hostMessage) hostMessage.textContent = 'O modelo está rodando neste dispositivo, sem token e sem cota de chamadas.';
      if (hostMode) hostMode.textContent = 'WebLLM local';
    }, 250);
  } catch (error) {
    console.error(error);
    setStatus(`Não foi possível carregar o modelo local: ${error?.message || error}`, 'error');
  } finally {
    loading = false;
    if (button) { button.disabled = false; button.textContent = engine ? 'IA local ativada' : 'Baixar e ativar IA local'; }
  }
}

function deactivateLocalAI() {
  const keyInput = $('geminiKey');
  if (keyInput?.value === MARKER) keyInput.value = '';
  document.querySelector('[data-action="disconnect-ai"]')?.click();
  setStatus('IA local desativada. O motor básico continua funcionando.', 'idle');
}

function injectUI() {
  const panel = $('aiPanel');
  if (!panel || $('localAiControls')) return;

  panel.innerHTML = `
    <div class="ai-head">
      <div>
        <span class="eyebrow">Inteligência sem cota</span>
        <h3>IA local gratuita e sem limite de chamadas</h3>
        <p>O modelo é baixado uma vez e roda no próprio dispositivo. Não exige token, assinatura ou créditos de API.</p>
      </div>
      <span class="connection" id="aiState">Motor local básico</span>
    </div>
    <section id="localAiControls" class="local-ai-card">
      <label>Modelo local
        <select id="localModel">${localModels.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}</select>
      </label>
      <div class="local-ai-progress"><i id="localAiProgressBar"></i></div>
      <p id="localAiStatus" data-state="idle">Pronto para baixar. A primeira ativação pode transferir alguns gigabytes.</p>
      <div class="button-row">
        <button class="btn secondary" type="button" id="activateLocalAi">Baixar e ativar IA local</button>
        <button class="btn text" type="button" id="deactivateLocalAi">Desativar IA local</button>
      </div>
    </section>
    <details class="external-ai-details">
      <summary>Gemini opcional</summary>
      <div class="ai-fields">
        <label>Chave Gemini<input id="geminiKey" type="password" autocomplete="off" placeholder="Opcional"></label>
        <label>Modelo<select id="geminiModel"><option value="">Conecte para listar modelos</option></select></label>
      </div>
      <div class="button-row">
        <button class="btn ghost" data-action="connect-ai">Conectar Gemini</button>
        <button class="btn text" data-action="disconnect-ai">Desconectar</button>
      </div>
    </details>
    <small id="aiHelp">Sem cota de chamadas não significa contexto infinito: a capacidade por resposta depende da memória do dispositivo e do modelo escolhido.</small>`;

  const style = document.createElement('style');
  style.textContent = `
    .local-ai-card{margin-top:20px;padding:20px;border:1px solid rgba(134,239,172,.22);border-radius:20px;background:rgba(34,197,94,.045)}
    .local-ai-progress{height:8px;margin:14px 0;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
    .local-ai-progress i{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--accent),var(--good));transition:width .25s ease}
    #localAiStatus{margin:0;color:var(--muted);line-height:1.5}
    #localAiStatus[data-state="ready"]{color:var(--good)}
    #localAiStatus[data-state="error"]{color:var(--danger)}
    .external-ai-details{margin-top:18px;border-top:1px solid var(--line);padding-top:16px}
    .external-ai-details summary{cursor:pointer;font-weight:700;color:var(--muted)}
    .external-ai-details .ai-fields{margin-top:16px}
  `;
  document.head.appendChild(style);

  $('activateLocalAi')?.addEventListener('click', activateLocalAI);
  $('deactivateLocalAi')?.addEventListener('click', deactivateLocalAI);

  document.querySelectorAll('.hero .eyebrow').forEach((element) => { element.textContent = 'Couple Experience · v8.5 Local AI'; });
  const hero = document.querySelector('.hero > p');
  if (hero) hero.textContent = 'Uma jornada com 96 cartas e IA que pode rodar no próprio dispositivo, sem token, sem cobrança por chamada e sem cota de API.';
  document.querySelectorAll('[data-action="refine-synthesis"],[data-action="refine-closing"]').forEach((button) => { button.textContent = 'Aprofundar com IA local'; });
  if ($('retryTarot')) $('retryTarot').textContent = 'Tentar novamente com IA local';
  const credits = document.querySelector('#view-credits .credits p');
  if (credits) credits.textContent = 'Conceito, direção criativa e autoria de Primeira Faísca. Edição v8.5 com 96 cartas e IA local sem cota de chamadas.';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUI, { once: true });
else injectUI();
