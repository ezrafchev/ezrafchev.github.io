import { CreateMLCEngine, prebuiltAppConfig } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

const $ = (id) => document.getElementById(id);
const STORAGE = {
  endpoint: 'pf12_openai_endpoint',
  engine: 'pf12_engine',
  model: 'pf12_model',
  open: 'pf12_open',
  history: 'pf12_history'
};
const MAX_HISTORY = 18;
const SYSTEM = `Você é Faísca, uma assistente de IA completa, inteligente e generalista dentro do site Primeira Faísca. Responda em português do Brasil. Você pode responder perguntas gerais, explicar conceitos, ajudar a escrever, raciocinar, organizar ideias, analisar o contexto do jogo e apoiar conversas. Use o contexto do site somente quando ele for relevante; não force o tema de relacionamento em perguntas gerais. Seja específica, natural e útil. Não invente fatos atuais: quando uma resposta depender de informação recente ou da internet, diga que não possui navegação nesta execução. Para temas de relacionamento, preserve consentimento e mantenha o conteúdo romântico não explícito. Para Tarô e Lenormand, trate a leitura como interpretação simbólica, não como prova de sentimentos ocultos ou previsão certa. Evite bordões, Markdown pesado e respostas genéricas.`;

let localEngine = null;
let activeModel = '';
let loadingModel = false;
let busy = false;
let generationId = 0;
let history = loadHistory();

const modelRecords = prebuiltAppConfig?.model_list || [];
const preferences = [
  [/Qwen3.*8B.*Instruct.*q4f16/i, 'Qwen3 8B · máxima inteligência'],
  [/Llama-3\.1-8B-Instruct-q4f16/i, 'Llama 3.1 8B · narrativa forte'],
  [/Qwen3.*4B.*Instruct.*q4f16/i, 'Qwen3 4B · recomendado'],
  [/Qwen2\.5-3B-Instruct-q4f16/i, 'Qwen2.5 3B · equilibrado'],
  [/Phi-3\.5-mini-instruct-q4f16/i, 'Phi 3.5 Mini · equilibrado'],
  [/Llama-3\.2-3B-Instruct-q4f16/i, 'Llama 3.2 3B · leve'],
  [/Qwen2\.5-1\.5B-Instruct-q4f16/i, 'Qwen2.5 1.5B · econômico'],
  [/SmolLM2-1\.7B-Instruct-q4f16/i, 'SmolLM2 1.7B · econômico']
];
const models = [];
for (const [pattern, label] of preferences) {
  const record = modelRecords.find((item) => pattern.test(item.model_id));
  if (record && !models.some((item) => item.id === record.model_id)) {
    models.push({ id: record.model_id, label, vram: Number(record.estimated_vram_bytes || 0) });
  }
}
if (!models.length) {
  const record = modelRecords.find((item) => /Instruct.*q4f16/i.test(item.model_id));
  if (record) models.push({ id: record.model_id, label: record.model_id, vram: Number(record.estimated_vram_bytes || 0) });
}

function loadHistory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE.history) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch { return []; }
}
function saveHistory() {
  try { sessionStorage.setItem(STORAGE.history, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
}
function cleanText(value) {
  return String(value ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:\w+)?/g, '')
    .replace(/```/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim();
}
function currentViewName() {
  const id = document.querySelector('.view:not(.hidden)')?.id || 'view-home';
  return ({
    'view-home':'Início','view-setup':'Preparação','view-session':'Jornada de perguntas','view-map':'Mapa da jornada',
    'view-chemistry':'Momento da Química','view-tarot':'Tarô Cigano','view-closing':'Encerramento','view-kit':'Kit 3D','view-credits':'Créditos'
  })[id] || 'Experiência';
}
function collectContext() {
  const read = (id, limit = 1200) => String($(id)?.value || $(id)?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, limit);
  const cards = [...document.querySelectorAll('.lenormand')]
    .map((card) => card.innerText.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 3);
  return [
    `Etapa atual: ${currentViewName()}`,
    `Participantes: ${read('p1',60) || 'Pessoa 1'} e ${read('p2',60) || 'Pessoa 2'}`,
    read('questionText',700) ? `Pergunta atual do jogo: ${read('questionText',700)}` : '',
    read('cardGuidance',500) ? `Dinâmica: ${read('cardGuidance',500)}` : '',
    read('journeySynthesis',1600) ? `Síntese: ${read('journeySynthesis',1600)}` : '',
    read('diceCombo',600) ? `Momento da Química: ${read('diceCombo',600)}` : '',
    read('tarotQuestion',700) ? `Pergunta do Tarô: ${read('tarotQuestion',700)}` : '',
    cards.length ? `Cartas visíveis: ${cards.join(' | ')}` : '',
    read('readingSections',2600) ? `Leitura atual: ${read('readingSections',2600)}` : ''
  ].filter(Boolean).join('\n');
}
function defaultModelId() {
  const stored = localStorage.getItem(STORAGE.model);
  if (stored && models.some((item) => item.id === stored)) return stored;
  return models.find((item) => /Qwen3.*4B/i.test(item.id))?.id
    || models.find((item) => /3B|mini/i.test(item.id))?.id
    || models[0]?.id || '';
}
function endpoint() { return (localStorage.getItem(STORAGE.endpoint) || '').trim(); }
function enginePreference() { return localStorage.getItem(STORAGE.engine) || 'auto'; }
function setStatus(label, state = 'idle') {
  if ($('pf12Status')) $('pf12Status').textContent = label;
  if ($('pf12Engine')) $('pf12Engine').textContent = label;
  if ($('pf12Dot')) $('pf12Dot').dataset.state = state;
}
function setProgress(value, label) {
  const numeric = Math.max(0, Math.min(1, Number(value || 0)));
  if ($('pf12ProgressBar')) $('pf12ProgressBar').style.width = `${numeric * 100}%`;
  if (label) setStatus(label, 'loading');
}
function renderMessage(role, text, engine = '', streaming = false) {
  const list = $('pf12Messages');
  if (!list) return null;
  const article = document.createElement('article');
  article.className = `pf12-message ${role}${streaming ? ' streaming' : ''}`;
  article.innerHTML = `<div class="pf12-bubble"></div><small>${role === 'user' ? 'Vocês' : `Faísca${engine ? ` · ${escapeHtml(engine)}` : ''}`}</small>`;
  article.querySelector('.pf12-bubble').textContent = text;
  list.appendChild(article);
  list.scrollTop = list.scrollHeight;
  return article;
}
function updateMessage(article, text) {
  const bubble = article?.querySelector('.pf12-bubble');
  if (bubble) bubble.textContent = cleanText(text);
  const list = $('pf12Messages');
  if (list) list.scrollTop = list.scrollHeight;
}
function addHistory(role, content) {
  history.push({ role, content: String(content).trim() });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  saveHistory();
}
function renderHistory() {
  const list = $('pf12Messages');
  if (!list) return;
  list.innerHTML = '';
  if (!history.length) {
    renderMessage('assistant', 'Sou a Faísca completa. Posso responder perguntas gerais, ajudar a escrever, explicar conceitos, analisar a etapa atual ou conversar sobre o Tarô. Na primeira pergunta, posso carregar automaticamente a IA local gratuita.', 'assistente');
    return;
  }
  history.forEach((item) => renderMessage(item.role, item.content, item.role === 'assistant' ? 'histórico' : ''));
}

async function ensureLocalEngine() {
  if (localEngine && activeModel) return;
  if (loadingModel) {
    while (loadingModel) await new Promise((resolve) => setTimeout(resolve, 120));
    if (localEngine && activeModel) return;
    throw new Error('O modelo local não foi carregado.');
  }
  if (!('gpu' in navigator)) throw new Error('Este navegador não oferece WebGPU. Use Chrome ou Edge atualizados, ou configure o backend da OpenAI.');
  const selected = $('pf12Model')?.value || defaultModelId();
  if (!selected) throw new Error('Nenhum modelo local compatível foi encontrado.');
  loadingModel = true;
  setStatus('Preparando IA local…', 'loading');
  try {
    localEngine = await CreateMLCEngine(selected, {
      appConfig: { ...prebuiltAppConfig, cacheBackend: 'indexeddb' },
      initProgressCallback: (report) => setProgress(report?.progress, report?.text || 'Baixando e preparando o modelo…')
    });
    activeModel = selected;
    localStorage.setItem(STORAGE.model, selected);
    setProgress(1, `IA local pronta · ${selected}`);
    setStatus(`IA local · ${selected}`, 'ready');
  } finally { loadingModel = false; }
}

async function askLocal(question, article, requestId) {
  await ensureLocalEngine();
  const context = collectContext();
  const messages = [
    { role:'system', content:SYSTEM },
    ...history.slice(0, -1).slice(-11).map((item) => ({ role:item.role, content:item.content })),
    { role:'user', content:`CONTEXTO OPCIONAL DO SITE:\n${context}\n\nPERGUNTA ATUAL:\n${question}` }
  ];
  const stream = await localEngine.chat.completions.create({
    messages,
    temperature: 0.68,
    top_p: 0.92,
    repetition_penalty: 1.08,
    presence_penalty: 0.18,
    max_tokens: 1600,
    stream: true,
    stream_options: { include_usage: true }
  });
  let output = '';
  for await (const chunk of stream) {
    if (requestId !== generationId) throw new Error('Resposta cancelada.');
    output += chunk?.choices?.[0]?.delta?.content || '';
    updateMessage(article, output);
  }
  if (!output.trim() && typeof localEngine.getMessage === 'function') output = String(await localEngine.getMessage() || '');
  output = cleanText(output);
  if (!output) throw new Error('A IA local não produziu resposta.');
  return { text: output, engine: `local · ${activeModel}` };
}

async function askOpenAI(question, article) {
  const url = endpoint();
  if (!url) throw new Error('O endpoint seguro da OpenAI não foi configurado.');
  const response = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      messages:history.slice(-12),
      context:collectContext()
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `Backend respondeu ${response.status}.`);
  const text = cleanText(data?.text || data?.output_text || '');
  if (!text) throw new Error('O backend não retornou texto.');
  updateMessage(article, text);
  return { text, engine:`OpenAI${data.model ? ` · ${data.model}` : ''}` };
}

function expertFallback(question) {
  const q = question.toLowerCase();
  const context = currentViewName();
  if (/c[oó]digo|javascript|html|css|programa|site/.test(q)) return 'Posso ajudar com desenvolvimento, mas o motor avançado não foi carregado neste navegador. Ative a IA local nas configurações ou conecte o endpoint seguro da OpenAI. Enquanto isso, descreva o erro, o comportamento esperado e o trecho de código relevante para eu organizar um diagnóstico objetivo.';
  if (/tar[oô]|lenormand|carta|tiragem/.test(q)) return 'Para uma leitura útil, diga a pergunta, as cartas e a posição de cada uma. A interpretação deve observar a sequência, as tensões entre os símbolos e o que pode ser verificado em conversa, sem tratar a tiragem como prova sobre sentimentos ocultos.';
  if (/relacion|namor|aproxim|conex|conversa/.test(q)) return 'Transforme a dúvida em três partes: o que você observou, como isso afetou você e qual pedido concreto gostaria de fazer. Essa estrutura reduz suposições e torna a conversa mais clara.';
  if (/escrev|texto|mensagem|corrig/.test(q)) return 'Cole o texto completo e indique o objetivo, o destinatário e o tom desejado. Assim consigo reorganizar clareza, gramática e impacto mesmo sem o modelo avançado.';
  return `Estou na etapa “${context}”, mas sua pergunta pode ser sobre qualquer tema. Para uma resposta realmente completa, a IA local precisa terminar de carregar ou o backend da OpenAI precisa estar conectado. O modo básico não deve fingir ter a mesma capacidade de um modelo de linguagem.`;
}

async function routeQuestion(question, article, requestId) {
  const preference = enginePreference();
  if (preference === 'openai') return askOpenAI(question, article);
  if (preference === 'local') return askLocal(question, article, requestId);
  if (endpoint()) {
    try { return await askOpenAI(question, article); }
    catch (error) { console.warn('OpenAI indisponível; tentando IA local.', error); }
  }
  try { return await askLocal(question, article, requestId); }
  catch (error) {
    console.warn('IA local indisponível.', error);
    const text = expertFallback(question);
    updateMessage(article, text);
    return { text, engine:'orientação sem modelo' };
  }
}

async function sendQuestion(value) {
  const question = String(value || '').trim();
  if (!question || busy) return;
  busy = true;
  const requestId = ++generationId;
  const input = $('pf12Input');
  if (input) { input.value = ''; input.style.height = ''; }
  $('pf12Send')?.setAttribute('disabled', '');
  renderMessage('user', question);
  addHistory('user', question);
  const article = renderMessage('assistant', 'Preparando uma resposta completa…', 'processando', true);
  setStatus('Analisando sua pergunta…', 'loading');
  try {
    const answer = await routeQuestion(question, article, requestId);
    article?.classList.remove('streaming');
    const meta = article?.querySelector('small');
    if (meta) meta.textContent = `Faísca · ${answer.engine}`;
    if (history.at(-1)?.role !== 'assistant' || history.at(-1)?.content !== answer.text) addHistory('assistant', answer.text);
    setStatus(answer.engine, 'ready');
  } catch (error) {
    const text = expertFallback(question);
    updateMessage(article, `${text}\n\nDetalhe técnico: ${error?.message || error}`);
    article?.classList.remove('streaming');
    addHistory('assistant', text);
    setStatus('Falha no motor avançado', 'error');
  } finally {
    busy = false;
    $('pf12Send')?.removeAttribute('disabled');
    input?.focus();
  }
}

function saveSettings() {
  const endpointValue = String($('pf12Endpoint')?.value || '').trim();
  if (endpointValue && !/^https:\/\//i.test(endpointValue) && !endpointValue.startsWith('/')) {
    $('pf12SettingsNote').textContent = 'Use HTTPS ou um caminho relativo iniciado por /.';
    return;
  }
  localStorage.setItem(STORAGE.endpoint, endpointValue);
  localStorage.setItem(STORAGE.engine, $('pf12EngineSelect')?.value || 'auto');
  const model = $('pf12Model')?.value || '';
  if (model) localStorage.setItem(STORAGE.model, model);
  $('pf12SettingsNote').textContent = 'Configuração salva neste navegador.';
  $('pf12Settings')?.classList.remove('open');
}
function clearConversation() {
  generationId += 1;
  history = [];
  saveHistory();
  renderHistory();
  setStatus(activeModel ? `IA local · ${activeModel}` : 'Pronta para conversar', activeModel ? 'ready' : 'idle');
}
function openAgent() {
  $('pf12Shell')?.classList.remove('hidden');
  localStorage.setItem(STORAGE.open, '1');
  setTimeout(() => $('pf12Input')?.focus(), 120);
}
function closeAgent() {
  $('pf12Shell')?.classList.add('hidden');
  $('pf12Settings')?.classList.remove('open');
  localStorage.setItem(STORAGE.open, '0');
}

function createUI() {
  $('pfAgentLauncher')?.remove();
  $('pfAgentShell')?.remove();
  if ($('pf12Launcher')) return;
  if (!document.querySelector('link[href*="design-v12.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'design-v12.css?v=12.0';
    document.head.appendChild(link);
  }
  const launcher = document.createElement('button');
  launcher.id = 'pf12Launcher';
  launcher.className = 'pf12-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Abrir assistente Faísca');
  launcher.innerHTML = '<span>✦</span><i></i>';

  const shell = document.createElement('aside');
  shell.id = 'pf12Shell';
  shell.className = `pf12-shell${localStorage.getItem(STORAGE.open) === '1' ? '' : ' hidden'}`;
  shell.innerHTML = `
    <header class="pf12-head">
      <span class="pf12-orb">✦</span>
      <div><b>Faísca</b><small id="pf12Status">Assistente completa</small></div>
      <button id="pf12Clear" type="button" aria-label="Limpar conversa">↻</button>
      <button id="pf12SettingsButton" type="button" aria-label="Configurações">⚙</button>
      <button id="pf12Close" type="button" aria-label="Fechar">×</button>
    </header>
    <div class="pf12-messages" id="pf12Messages"></div>
    <div class="pf12-suggestions">
      <button type="button">Explique a pergunta atual</button>
      <button type="button">Ajude a escrever uma mensagem</button>
      <button type="button">Analise as cartas abertas</button>
      <button type="button">Posso perguntar qualquer assunto?</button>
    </div>
    <footer class="pf12-compose">
      <div><textarea id="pf12Input" rows="1" maxlength="1800" placeholder="Pergunte qualquer coisa…"></textarea><button id="pf12Send" type="button" aria-label="Enviar">➤</button></div>
      <small><span id="pf12Dot" data-state="idle"></span><span id="pf12Engine">Automático · OpenAI ou IA local</span></small>
    </footer>
    <section class="pf12-settings" id="pf12Settings">
      <h3>Inteligência da Faísca</h3>
      <p>Em modo automático, a Faísca usa o backend da OpenAI quando configurado e, caso contrário, carrega uma IA local gratuita no primeiro uso.</p>
      <label>Motor preferencial<select id="pf12EngineSelect"><option value="auto">Automático</option><option value="local">IA local gratuita</option><option value="openai">OpenAI por backend</option></select></label>
      <label>Modelo local<select id="pf12Model">${models.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}${item.vram ? ` · ~${(item.vram/1073741824).toFixed(1)} GB` : ''}</option>`).join('')}</select></label>
      <div class="pf12-progress"><i id="pf12ProgressBar"></i></div>
      <label>Endpoint seguro da OpenAI<input id="pf12Endpoint" type="url" placeholder="https://seu-backend/api/openai-chat"></label>
      <p id="pf12SettingsNote">Nunca cole uma chave da OpenAI no navegador. A chave deve existir apenas no backend.</p>
      <div class="pf12-settings-actions"><button class="btn secondary" id="pf12Save" type="button">Salvar</button><button class="btn ghost" id="pf12Back" type="button">Voltar</button></div>
    </section>`;
  document.body.append(launcher, shell);
  $('pf12EngineSelect').value = enginePreference();
  $('pf12Endpoint').value = endpoint();
  if (defaultModelId()) $('pf12Model').value = defaultModelId();
  renderHistory();
  launcher.addEventListener('click', openAgent);
  $('pf12Close').addEventListener('click', closeAgent);
  $('pf12SettingsButton').addEventListener('click', () => $('pf12Settings').classList.toggle('open'));
  $('pf12Back').addEventListener('click', () => $('pf12Settings').classList.remove('open'));
  $('pf12Save').addEventListener('click', saveSettings);
  $('pf12Clear').addEventListener('click', clearConversation);
  $('pf12Send').addEventListener('click', () => sendQuestion($('pf12Input').value));
  $('pf12Input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendQuestion(event.target.value); }
  });
  $('pf12Input').addEventListener('input', (event) => {
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
  });
  document.querySelectorAll('.pf12-suggestions button').forEach((button) => button.addEventListener('click', () => sendQuestion(button.textContent)));
  document.addEventListener('pf:open-agent', openAgent);
  document.addEventListener('pf:close-agent', closeAgent);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createUI, { once:true });
else createUI();
