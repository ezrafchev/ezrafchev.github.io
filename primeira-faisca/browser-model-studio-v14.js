import { CreateMLCEngine, prebuiltAppConfig } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

const $ = (id) => document.getElementById(id);
const MARKER = 'LOCAL_WEBGPU_MODEL_STUDIO_V14';
const STORAGE_MODEL = 'pf14_browser_model';
const originalFetch = window.fetch.bind(window);

let engine = null;
let activeModel = '';
let loading = false;

function bytes(value) {
  const n = Number(value || 0);
  if (!n) return 'memória variável';
  const gb = n / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB de VRAM estimada`;
}

function modelScore(id) {
  const rules = [
    [/Qwen3.*8B.*Instruct.*q4f16/i, 100],
    [/Llama-3\.1-8B-Instruct-q4f16/i, 95],
    [/Qwen3.*4B.*Instruct.*q4f16/i, 90],
    [/Qwen2\.5-3B-Instruct-q4f16/i, 85],
    [/Phi-3\.5-mini-instruct-q4f16/i, 80],
    [/Llama-3\.2-3B-Instruct-q4f16/i, 75],
    [/Qwen2\.5-1\.5B-Instruct-q4f16/i, 65],
    [/SmolLM2-1\.7B-Instruct-q4f16/i, 60]
  ];
  return rules.find(([re]) => re.test(id))?.[1] || 10;
}

const models = (prebuiltAppConfig?.model_list || [])
  .filter((item) => item?.model_id && /Instruct|Chat/i.test(item.model_id))
  .filter((item) => /q4f16|q4f32|q0f16/i.test(item.model_id))
  .map((item) => ({ id:item.model_id, vram:Number(item.estimated_vram_bytes || 0), score:modelScore(item.model_id) }))
  .filter((item) => !item.vram || item.vram <= 10 * 1024 ** 3)
  .sort((a, b) => b.score - a.score || a.vram - b.vram);

function selectedModel() {
  const stored = localStorage.getItem(STORAGE_MODEL);
  if (stored && models.some((item) => item.id === stored)) return stored;
  return models.find((item) => /Qwen3.*4B/i.test(item.id))?.id
    || models.find((item) => /3B|mini/i.test(item.id))?.id
    || models[0]?.id || '';
}

function setStatus(text, state = 'idle') {
  const status = $('pf14BrowserStatus');
  if (status) { status.textContent = text; status.dataset.state = state; }
  const line = $('pf13SettingsNote');
  if (line && state === 'error') { line.textContent = text; line.dataset.state = 'error'; }
}

function setProgress(value, text) {
  const numeric = Math.max(0, Math.min(1, Number(value || 0)));
  const bar = $('pf14BrowserBar');
  if (bar) bar.style.width = `${numeric * 100}%`;
  if (text) setStatus(text, 'loading');
}

function geminiMessages(body) {
  const messages = [];
  const system = (body?.systemInstruction?.parts || []).map((part) => part?.text || '').join('\n').trim();
  if (system) messages.push({ role:'system', content:system });
  for (const item of body?.contents || []) {
    const content = (item?.parts || []).map((part) => part?.text || '').join('\n').trim();
    if (!content) continue;
    messages.push({ role:item?.role === 'model' ? 'assistant' : 'user', content });
  }
  return messages;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers:{ 'Content-Type':'application/json' } });
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isLocalGemini = url.includes('generativelanguage.googleapis.com') && (url.includes('/local-webllm') || url.includes(':generateContent'));
  if (!engine || !activeModel || !isLocalGemini) return originalFetch(input, init);

  if (url.includes('/v1beta/models') && !url.includes(':generateContent')) {
    return jsonResponse({ models:[{ name:'models/local-webllm', displayName:`WebGPU · ${activeModel}`, supportedGenerationMethods:['generateContent'] }] });
  }

  try {
    const body = JSON.parse(init.body || '{}');
    const result = await engine.chat.completions.create({
      messages:geminiMessages(body),
      temperature:Number(body?.generationConfig?.temperature ?? 0.62),
      top_p:Number(body?.generationConfig?.topP ?? 0.92),
      max_tokens:Math.min(Number(body?.generationConfig?.maxOutputTokens || 2400), 4096),
      response_format:body?.generationConfig?.responseMimeType === 'application/json' ? { type:'json_object' } : undefined
    });
    const text = String(result?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('O modelo local retornou uma resposta vazia.');
    return jsonResponse({ candidates:[{ content:{ parts:[{ text }] }, finishReason:'STOP' }], modelVersion:activeModel });
  } catch (error) {
    return jsonResponse({ error:{ message:error?.message || 'Falha no modelo local WebGPU.' } }, 503);
  }
};

async function activate() {
  if (loading) return;
  if (!('gpu' in navigator)) {
    setStatus('WebGPU não está disponível. Use Chrome ou Edge atualizado em um computador compatível.', 'error');
    return;
  }
  const id = $('pf14BrowserModel')?.value || selectedModel();
  if (!id) { setStatus('Nenhum modelo WebLLM compatível foi encontrado.', 'error'); return; }

  loading = true;
  const button = $('pf14BrowserActivate');
  if (button) { button.disabled = true; button.textContent = 'Baixando…'; }
  try {
    if (engine?.unload && activeModel && activeModel !== id) await engine.unload().catch(() => {});
    engine = await CreateMLCEngine(id, {
      appConfig:{ ...prebuiltAppConfig, cacheBackend:'indexeddb' },
      initProgressCallback:(report) => setProgress(report?.progress, report?.text || 'Baixando o modelo…')
    });
    activeModel = id;
    localStorage.setItem(STORAGE_MODEL, id);
    localStorage.setItem('pf13_engine', 'browser');

    const geminiKey = $('geminiKey');
    if (geminiKey) geminiKey.value = MARKER;
    const top = $('aiTopStatus');
    if (top) top.textContent = `IA local · ${id}`;
    const state = $('aiState');
    if (state) state.textContent = `IA local · ${id}`;

    setProgress(1, `Modelo ativo: ${id}`);
    setStatus(`Pronto · ${id}`, 'ready');
    if (button) button.textContent = 'Modelo ativo';
  } catch (error) {
    console.error(error);
    setProgress(0, 'Falha no download.');
    setStatus(`Não foi possível carregar o modelo: ${error?.message || error}`, 'error');
    if (button) button.textContent = 'Baixar e ativar';
  } finally {
    loading = false;
    if (button) button.disabled = false;
  }
}

async function unload() {
  if (engine?.unload) await engine.unload().catch(() => {});
  engine = null;
  activeModel = '';
  const geminiKey = $('geminiKey');
  if (geminiKey?.value === MARKER) geminiKey.value = '';
  setProgress(0, 'Modelo descarregado da memória. O arquivo em cache permanece no navegador.');
  setStatus('Modelo descarregado da memória.', 'idle');
  const button = $('pf14BrowserActivate');
  if (button) button.textContent = 'Baixar e ativar';
}

function renderModelInfo() {
  const item = models.find((model) => model.id === $('pf14BrowserModel')?.value);
  const info = $('pf14BrowserInfo');
  if (!item || !info) return;
  const quality = item.score >= 95 ? 'máxima qualidade local' : item.score >= 85 ? 'melhor equilíbrio' : item.score >= 70 ? 'leve e competente' : 'econômico';
  info.innerHTML = `<b>${quality}</b><span>${item.id}</span><small>${bytes(item.vram)}. O download fica armazenado no navegador.</small>`;
}

function inject() {
  const panel = $('pf13SettingsPanel');
  if (!panel || $('pf14BrowserStudio')) return false;
  const block = document.createElement('div');
  block.id = 'pf14BrowserStudio';
  block.className = 'pf13-settings-block pf14-browser-studio';
  block.innerHTML = `
    <span>LOCAL NO NAVEGADOR · FUNCIONA SEM OLLAMA</span>
    <p>Escolha um modelo compatível, baixe diretamente no navegador e use sem token ou servidor local.</p>
    <label>Modelo WebGPU<select id="pf14BrowserModel"></select></label>
    <div id="pf14BrowserInfo" class="pf14-model-info"></div>
    <div class="pf14-progress"><i id="pf14BrowserBar"></i></div>
    <p id="pf14BrowserStatus" data-state="idle">Pronto para baixar. O primeiro carregamento pode transferir alguns gigabytes.</p>
    <div class="pf13-inline-actions"><button type="button" id="pf14BrowserActivate">Baixar e ativar</button><button type="button" id="pf14BrowserUnload">Descarregar memória</button></div>`;
  const actions = panel.querySelector('.pf13-settings-actions');
  panel.insertBefore(block, actions || null);

  const select = $('pf14BrowserModel');
  select.innerHTML = models.map((item) => `<option value="${item.id}">${item.id} · ${bytes(item.vram)}</option>`).join('');
  select.value = selectedModel();
  select.addEventListener('change', renderModelInfo);
  $('pf14BrowserActivate')?.addEventListener('click', activate);
  $('pf14BrowserUnload')?.addEventListener('click', unload);
  renderModelInfo();
  if (!('gpu' in navigator)) setStatus('WebGPU indisponível neste navegador.', 'error');
  return true;
}

function ensureUI() {
  if (inject()) return;
  const observer = new MutationObserver(() => { if (inject()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setTimeout(() => observer.disconnect(), 20_000);
}

window.PF14BrowserAI = {
  activate,
  unload,
  get activeModel() { return activeModel; },
  get ready() { return Boolean(engine && activeModel); },
  models:models.map((item) => ({ ...item }))
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI, { once:true });
else ensureUI();