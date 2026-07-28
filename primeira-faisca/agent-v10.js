import { CreateMLCEngine, prebuiltAppConfig } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

const MARKER = 'LOCAL_WEBLLM_NARRATIVE_READER_V10';
const $ = (id) => document.getElementById(id);
const nativeFetch = window.fetch.bind(window);
const appConfig = { ...prebuiltAppConfig, cacheBackend: 'indexeddb' };

let engine = null;
let activeModel = '';
let busy = false;
let loading = false;
let quality = 'deep';
let generationToken = 0;

const cardNames = [
  'Cavaleiro','Trevo','Navio','Casa','Árvore','Nuvens','Serpente','Caixão','Buquê','Foice','Chicote','Pássaros',
  'Criança','Raposa','Urso','Estrelas','Cegonha','Cão','Torre','Jardim','Montanha','Caminhos','Ratos','Coração',
  'Aliança','Livro','Carta','Homem','Mulher','Lírios','Sol','Lua','Chave','Peixes','Âncora','Cruz'
];

const preferredModels = [
  [/Qwen3.*8B.*Instruct.*q4f16/i, 'Qwen3 8B · máxima profundidade'],
  [/Llama-3\.1-8B-Instruct-q4f16/i, 'Llama 3.1 8B · narrativa natural'],
  [/Qwen3.*4B.*Instruct.*q4f16/i, 'Qwen3 4B · recomendado'],
  [/Phi-3\.5-mini-instruct-q4f16/i, 'Phi 3.5 Mini · equilibrado'],
  [/Llama-3\.2-3B-Instruct-q4f16/i, 'Llama 3.2 3B · leve'],
  [/Qwen2\.5-1\.5B-Instruct-q4f16/i, 'Qwen2.5 1.5B · econômico']
];

const modelRecords = prebuiltAppConfig?.model_list || [];
const localModels = [];
for (const [pattern, label] of preferredModels) {
  const record = modelRecords.find((item) => pattern.test(item.model_id));
  if (record && !localModels.some((item) => item.id === record.model_id)) {
    localModels.push({ id: record.model_id, label, vram: Number(record.estimated_vram_bytes || 0) });
  }
}
if (!localModels.length) {
  const record = modelRecords.find((item) => /Instruct.*q4f16/i.test(item.model_id));
  if (record) localModels.push({ id: record.model_id, label: record.model_id, vram: Number(record.estimated_vram_bytes || 0) });
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const cleanText = (value) => String(value ?? '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/```(?:json)?/gi, '')
  .replace(/```/g, '')
  .replace(/^\s{0,3}#{1,6}\s*/gm, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/^\s*[-*_]{3,}\s*$/gm, '')
  .trim();

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function headersObject(headers) {
  const out = {};
  if (headers instanceof Headers) headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  else if (Array.isArray(headers)) headers.forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
  else Object.entries(headers || {}).forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
  return out;
}

function setStatus(message, state = 'idle') {
  const status = $('localAiStatus');
  if (status) { status.textContent = message; status.dataset.state = state; }
  if ($('aiTopStatus')) $('aiTopStatus').textContent = state === 'ready' ? 'Leitora local ativa' : state === 'loading' ? 'Leitora interpretando' : 'Motor local';
  $('aiDot')?.classList.toggle('on', state === 'ready' || state === 'loading');
}

function setLoadProgress(report) {
  const progress = Math.max(0, Math.min(1, Number(report?.progress || 0)));
  if ($('localAiProgressBar')) $('localAiProgressBar').style.width = `${progress * 100}%`;
  setStatus(report?.text || 'Preparando o modelo local…', 'loading');
}

function promptParts(body) {
  return {
    system: (body?.systemInstruction?.parts || []).map((part) => part.text || '').join('\n'),
    user: (body?.contents || []).flatMap((content) => content.parts || []).map((part) => part.text || '').join('\n\n')
  };
}

function extractQuestion(text) {
  return (text.match(/Pergunta principal:\s*([^\n]+)/i)?.[1] || text.match(/Pergunta:\s*([^\n]+)/i)?.[1] || text.match(/[“"]([^”"]+\?)[”"]/i)?.[1] || 'O que esta tiragem ajuda o casal a compreender neste momento?').trim();
}

function extractParticipants(text) {
  return (text.match(/Participantes:\s*([^\n.]+)/i)?.[1] || 'o casal').trim();
}

function extractCards(text) {
  const positions = ['Clima atual', 'Ponte de conexão', 'Próximo passo'];
  const found = [];
  for (const position of positions) {
    const match = text.match(new RegExp(`${position}\\s*[—–:-]+\\s*([^:\\n|]+)`, 'i'));
    if (match) found.push({ position, name: match[1].trim() });
  }
  if (found.length === 3) return found;
  const unique = [];
  for (const name of cardNames) {
    if (new RegExp(`(?:^|[^\\p{L}])${name}(?:$|[^\\p{L}])`, 'iu').test(text) && !unique.includes(name)) unique.push(name);
  }
  return unique.slice(0, 3).map((name, index) => ({ position: positions[index], name }));
}

function contextFromPrompt(text) {
  return { question: extractQuestion(text), participants: extractParticipants(text), cards: extractCards(text), raw: text.slice(0, 12000) };
}

function ensureReaderPanel() {
  $('reading')?.classList.remove('hidden');
  $('readingLoading')?.classList.remove('hidden');
  let panel = $('narrativeReaderPanel');
  if (!panel && $('reading')) {
    panel = document.createElement('section');
    panel.id = 'narrativeReaderPanel';
    panel.className = 'narrative-reader-panel';
    panel.innerHTML = '<div class="reader-head"><span class="reader-orb">✦</span><div><b>Leitura narrativa local</b><small id="readerStage">Preparando interpretação</small></div><strong id="readerPercent">0%</strong></div><div class="reader-track"><i id="readerTrackBar"></i></div><div id="readerLiveText" class="reader-live-text" aria-live="polite"></div><div id="readerSteps" class="reader-steps"></div>';
    $('reading').insertBefore(panel, $('readingSections') || null);
  }
  panel?.classList.remove('hidden');
  return panel;
}

function updateStage(index, total, title, text = '') {
  ensureReaderPanel();
  const percent = Math.round((index / Math.max(total, 1)) * 100);
  if ($('readerStage')) $('readerStage').textContent = title;
  if ($('readerPercent')) $('readerPercent').textContent = `${percent}%`;
  if ($('readerTrackBar')) $('readerTrackBar').style.width = `${percent}%`;
  if (text && $('readerLiveText')) { $('readerLiveText').textContent = cleanText(text).slice(-9000); $('readerLiveText').scrollTop = $('readerLiveText').scrollHeight; }
  const labels = ['Leitura livre', 'Relações entre cartas', 'Resposta direta', 'Ações', 'Edição final'];
  if ($('readerSteps')) $('readerSteps').innerHTML = labels.map((label, step) => `<span class="${step < index ? 'done' : step === index ? 'active' : ''}">${step < index ? '✓' : step + 1} ${label}</span>`).join('');
}

async function streamCompletion(messages, options = {}) {
  const request = {
    messages,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.92,
    repetition_penalty: options.repetitionPenalty ?? 1.08,
    presence_penalty: options.presencePenalty ?? 0.2,
    frequency_penalty: options.frequencyPenalty ?? 0.15,
    max_tokens: options.maxTokens ?? 1800,
    stream: true,
    stream_options: { include_usage: true }
  };
  if (options.jsonMode) request.response_format = { type: 'json_object' };
  if (options.enableThinking) request.enable_thinking = true;
  let chunks;
  try { chunks = await engine.chat.completions.create(request); }
  catch { delete request.enable_thinking; delete request.response_format; chunks = await engine.chat.completions.create(request); }
  let output = '';
  for await (const chunk of chunks) { output += chunk?.choices?.[0]?.delta?.content || ''; if (options.onChunk) options.onChunk(output); }
  if (!output.trim() && typeof engine.getMessage === 'function') output = String(await engine.getMessage() || '');
  return cleanText(output);
}

function extractJson(text) {
  const cleaned = cleanText(text);
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {} }
  return null;
}

function hasStockLanguage(reading) {
  const text = JSON.stringify(reading || {}).toLowerCase();
  const stock = ['formam uma sequência simbólica','a primeira mostra o clima percebido','abre o tema','mostra a ponte','orienta a ação','pode haver curiosidade e presença','a resposta concreta depende da conversa','intenção só pode ser confirmada por escolhas'];
  return stock.filter((phrase) => text.includes(phrase)).length >= 2;
}

function readingSchemaInstruction(cards) {
  return `Retorne SOMENTE um objeto JSON válido com esta estrutura exata:
{
"visaoGeral":"texto narrativo de 220 a 380 palavras",
"respostaPergunta":"resposta direta e específica de 150 a 260 palavras",
"posicoes":[
{"posicao":"Clima atual","carta":"${cards[0]?.name || 'Carta 1'}","interpretacao":"90 a 170 palavras","potencial":"35 a 80 palavras","sombra":"35 a 80 palavras","convite":"pergunta concreta"},
{"posicao":"Ponte de conexão","carta":"${cards[1]?.name || 'Carta 2'}","interpretacao":"90 a 170 palavras","potencial":"35 a 80 palavras","sombra":"35 a 80 palavras","convite":"pergunta concreta"},
{"posicao":"Próximo passo","carta":"${cards[2]?.name || 'Carta 3'}","interpretacao":"90 a 170 palavras","potencial":"35 a 80 palavras","sombra":"35 a 80 palavras","convite":"pergunta concreta"}
],
"combinacao":"interpretação original de 160 a 280 palavras sobre como as cartas modificam umas às outras",
"dimensoes":{"atracao":"45 a 100 palavras","carinho":"45 a 100 palavras","confianca":"45 a 100 palavras","comunicacao":"45 a 100 palavras","expectativas":"45 a 100 palavras","intencao":"45 a 100 palavras"},
"pontoAtencao":"70 a 130 palavras",
"planoPratico":["ação específica 1","ação específica 2","ação específica 3","ação opcional 4"],
"perguntaFinal":"pergunta final específica"
}`;
}

function validateReading(reading, cards) {
  if (!reading || typeof reading !== 'object') return false;
  if (String(reading.visaoGeral || '').length < 180 || String(reading.respostaPergunta || '').length < 120) return false;
  if (!Array.isArray(reading.posicoes) || reading.posicoes.length !== 3 || !Array.isArray(reading.planoPratico) || reading.planoPratico.length < 3) return false;
  const required = ['atracao','carinho','confianca','comunicacao','expectativas','intencao'];
  if (!reading.dimensoes || required.some((key) => String(reading.dimensoes[key] || '').length < 25)) return false;
  reading.posicoes.forEach((item, index) => { item.posicao = ['Clima atual','Ponte de conexão','Próximo passo'][index]; item.carta = cards[index]?.name || item.carta || `Carta ${index + 1}`; });
  return !hasStockLanguage(reading);
}

async function buildFreeNarrative(context, total) {
  updateStage(0, total, 'Lendo a tiragem como uma história', `Pergunta: ${context.question}\nCartas: ${context.cards.map((card) => card.name).join(' · ')}`);
  const prompt = `Você é uma leitora experiente de Lenormand e uma boa escritora. Faça uma leitura LIVRE, singular e contextual, como uma conversa inteligente — não como um formulário.
Participantes: ${context.participants}
Pergunta: ${context.question}
Cartas e posições: ${context.cards.map((card) => `${card.position}: ${card.name}`).join(' | ')}
Contexto completo da sessão: ${context.raw}
Regras:
- Responda diretamente à pergunta.
- Construa uma narrativa contínua em que uma carta modifica a outra.
- Mostre tensões, possibilidades e nuances reais; não repita definições de dicionário.
- Diferencie símbolo, hipótese e comportamento observável.
- Não afirme conhecer sentimentos ocultos nem prever fatos como certeza.
- Não use os bordões “sequência simbólica”, “abre o tema”, “mostra a ponte”, “orienta a ação” ou “a resposta depende da conversa”.
- Evite listas e subtítulos. Escreva de 650 a 1000 palavras, em prosa natural e específica para estas cartas e esta pergunta.`;
  return streamCompletion([{ role: 'system', content: 'Você produz leituras autorais, profundas e não repetitivas em português do Brasil.' }, { role: 'user', content: prompt }], {
    temperature: quality === 'studio' ? 0.74 : 0.68,
    topP: 0.94,
    maxTokens: quality === 'studio' ? 2600 : 2100,
    enableThinking: /Qwen3/i.test(activeModel),
    onChunk: (text) => updateStage(0, total, 'Construindo a leitura livre', text)
  });
}

async function structureNarrative(context, draft, total) {
  updateStage(1, total, 'Cruzando as relações entre as cartas', draft);
  const prompt = `Transforme a leitura autoral abaixo em uma estrutura JSON para o aplicativo, preservando sua voz, metáforas e conclusões específicas. Não empobreça o texto nem substitua por frases genéricas.
Pergunta: ${context.question}
Participantes: ${context.participants}
Cartas: ${context.cards.map((card) => `${card.position}: ${card.name}`).join(' | ')}
LEITURA AUTORAL:\n${draft}
${readingSchemaInstruction(context.cards)}
Regras editoriais:
- Cada seção precisa dizer algo diferente.
- Potencial e sombra devem nascer desta combinação, não de definições prontas.
- As dimensões precisam ser específicas para a pergunta e para as cartas.
- O plano precisa conter ações observáveis, com verbo e momento.
- Não use Markdown, asteriscos ou texto fora do JSON.`;
  const output = await streamCompletion([{ role: 'system', content: 'Você é editora de uma leitura Lenormand. Preserve profundidade e converta prosa em JSON válido.' }, { role: 'user', content: prompt }], {
    temperature: 0.35,
    topP: 0.88,
    maxTokens: 3600,
    jsonMode: true,
    onChunk: (text) => updateStage(2, total, 'Organizando a resposta direta', text)
  });
  return extractJson(output);
}

async function repairReading(context, draft, reading, total) {
  updateStage(3, total, 'Revisando profundidade e ações', JSON.stringify(reading || {}, null, 2));
  const prompt = `A resposta JSON abaixo está incompleta, genérica ou repetitiva. Reescreva-a integralmente usando a leitura autoral como fonte. Preserve as três cartas e entregue conteúdo específico.
LEITURA AUTORAL:\n${draft}
JSON A REVISAR:\n${JSON.stringify(reading || {})}
${readingSchemaInstruction(context.cards)}
Não use frases de modelo. Não use Markdown. Retorne somente JSON válido.`;
  const output = await streamCompletion([{ role: 'system', content: 'Você revisa leituras de Lenormand e elimina todo texto genérico ou repetitivo.' }, { role: 'user', content: prompt }], {
    temperature: 0.42,
    maxTokens: 3800,
    jsonMode: true,
    onChunk: (text) => updateStage(3, total, 'Reescrevendo trechos genéricos', text)
  });
  return extractJson(output);
}

async function generateNarrativeReading(body) {
  const { user } = promptParts(body);
  const context = contextFromPrompt(user);
  if (context.cards.length !== 3) throw new Error('Não foi possível identificar as três cartas da tiragem.');
  const total = quality === 'studio' ? 5 : 4;
  const draft = await buildFreeNarrative(context, total);
  let reading = await structureNarrative(context, draft, total);
  if (!validateReading(reading, context.cards)) reading = await repairReading(context, draft, reading, total);
  if (!validateReading(reading, context.cards)) throw new Error('A leitura local não atingiu a profundidade necessária. Tente novamente ou escolha um modelo maior.');
  updateStage(total, total, 'Leitura autoral concluída', 'A interpretação final foi aprovada e será exibida no layout.');
  setTimeout(() => $('narrativeReaderPanel')?.classList.add('hidden'), 1100);
  return JSON.stringify(reading);
}

async function normalCompletion(body) {
  const { system, user } = promptParts(body);
  return streamCompletion([{ role: 'system', content: `${system}\nResponda em português do Brasil com especificidade, naturalidade e sem Markdown desnecessário.` }, { role: 'user', content: user }], {
    temperature: 0.62,
    maxTokens: Math.min(Number(body?.generationConfig?.maxOutputTokens) || 2200, 4096),
    enableThinking: /Qwen3/i.test(activeModel)
  });
}

async function localCompletion(body) {
  if (!engine || !activeModel) throw new Error('A IA local ainda não foi ativada.');
  if (busy) throw new Error('A IA local já está elaborando outra resposta.');
  busy = true;
  const token = ++generationToken;
  const { system, user } = promptParts(body);
  const tarot = /baralho cigano|lenormand|tar[oô]/i.test(`${system}\n${user}`);
  setStatus(tarot ? 'Criando uma leitura autoral…' : 'A IA local está elaborando a resposta…', 'loading');
  try {
    const text = tarot ? await generateNarrativeReading(body) : await normalCompletion(body);
    if (token !== generationToken) throw new Error('A geração foi substituída por outra solicitação.');
    setStatus(`Leitora local ativa · ${activeModel}`, 'ready');
    if ($('readingEngine') && tarot) $('readingEngine').textContent = `Leitura autoral · ${activeModel}`;
    return responseJson({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
  } finally { busy = false; }
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const requestHeaders = headersObject(init.headers || input?.headers);
  const key = requestHeaders['x-goog-api-key'] || '';
  if (url.includes('generativelanguage.googleapis.com/v1beta/models') && key === MARKER) {
    return responseJson({ models: [{ name: 'models/local-webllm', displayName: `Leitora local narrativa · ${activeModel || 'WebLLM'}`, supportedGenerationMethods: ['generateContent'] }] });
  }
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent') && (key === MARKER || url.includes('/local-webllm:generateContent'))) {
    try { return await localCompletion(JSON.parse(init.body || '{}')); }
    catch (error) { $('narrativeReaderPanel')?.classList.add('hidden'); return responseJson({ error: { message: error?.message || 'Falha na leitura local.' } }, 503); }
  }
  return nativeFetch(input, init);
};

async function activateLocalAI() {
  if (loading) return;
  if (!('gpu' in navigator)) { setStatus('Este navegador não oferece WebGPU. Use Chrome ou Edge atualizados em um computador compatível.', 'error'); return; }
  const selected = $('localModel')?.value || localModels[0]?.id;
  if (!selected) { setStatus('Nenhum modelo local compatível foi encontrado.', 'error'); return; }
  loading = true;
  const button = $('activateLocalAi');
  if (button) { button.disabled = true; button.textContent = 'Preparando modelo…'; }
  try {
    if (!engine || activeModel !== selected) {
      if (engine?.unload) await engine.unload().catch(() => {});
      engine = await CreateMLCEngine(selected, { appConfig, initProgressCallback: setLoadProgress });
      activeModel = selected;
    }
    if ($('geminiKey')) $('geminiKey').value = MARKER;
    document.querySelector('[data-action="connect-ai"]')?.click();
    setTimeout(() => {
      if ($('geminiModel')) $('geminiModel').value = 'local-webllm';
      if ($('aiState')) $('aiState').textContent = `Leitora local ativa · ${activeModel}`;
      if ($('hostRole')) $('hostRole').textContent = 'Leitora local';
      if ($('hostMessage')) $('hostMessage').textContent = 'A próxima tiragem será interpretada livremente e depois editada para o layout.';
      if ($('hostMode')) $('hostMode').textContent = 'leitura narrativa em duas etapas';
      setStatus(`Leitora local ativa · ${activeModel}`, 'ready');
    }, 350);
  } catch (error) { console.error(error); setStatus(`Não foi possível carregar o modelo: ${error?.message || error}`, 'error'); }
  finally { loading = false; if (button) { button.disabled = false; button.textContent = engine ? 'IA local ativada' : 'Baixar e ativar IA local'; } }
}

function deactivateLocalAI() {
  generationToken += 1;
  if ($('geminiKey')?.value === MARKER) $('geminiKey').value = '';
  document.querySelector('[data-action="disconnect-ai"]')?.click();
  setStatus('IA local desativada. O motor básico continua disponível.', 'idle');
}

function injectVisualLayer() {
  if (!document.querySelector('link[href*="visual-v9.css"]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'visual-v9.css?v=10.0'; document.head.appendChild(link); }
  document.body.dataset.edition = 'v9';
  const style = document.createElement('style');
  style.textContent = '.narrative-reader-panel{margin:20px 0;padding:22px;border:1px solid rgba(103,232,249,.25);border-radius:24px;background:linear-gradient(145deg,rgba(8,145,178,.08),rgba(76,29,149,.12),rgba(8,8,13,.86));box-shadow:0 28px 80px rgba(0,0,0,.34)}.reader-head{display:flex;align-items:center;gap:13px}.reader-orb{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#67e8f9,#8b5cf6 55%,#fb7185);color:#fff;box-shadow:0 0 30px rgba(139,92,246,.38)}.reader-head>div{display:grid;gap:3px}.reader-head small{color:var(--muted)}.reader-head strong{margin-left:auto;color:#a78bfa}.reader-track{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:18px 0}.reader-track i{display:block;width:0;height:100%;background:linear-gradient(90deg,#67e8f9,#a78bfa,#fb7185);transition:width .35s ease}.reader-live-text{max-height:340px;overflow:auto;white-space:pre-wrap;color:#dedee8;line-height:1.7;font-size:14px}.reader-steps{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.reader-steps span{padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;color:#71717a;font-size:11px}.reader-steps span.active{color:#fff;border-color:rgba(167,139,250,.42);background:rgba(124,58,237,.14)}.reader-steps span.done{color:#86efac;border-color:rgba(134,239,172,.25)}.local-ai-card{margin-top:20px;padding:22px;border:1px solid rgba(103,232,249,.18);border-radius:22px;background:linear-gradient(145deg,rgba(8,145,178,.04),rgba(124,58,237,.05))}.ai-control-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:14px}.local-ai-progress{height:8px;margin:16px 0;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.local-ai-progress i{display:block;width:0;height:100%;background:linear-gradient(90deg,#67e8f9,#a78bfa,#fb7185);transition:width .25s ease}.external-ai-details{margin-top:18px;border-top:1px solid rgba(255,255,255,.1);padding-top:16px}.external-ai-details summary{cursor:pointer;font-weight:750;color:var(--muted)}@media(max-width:760px){.ai-control-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
}

function injectUI() {
  injectVisualLayer();
  const panel = $('aiPanel');
  if (panel) panel.innerHTML = `<div class="ai-head"><div><span class="eyebrow">Leitura privada</span><h3>Leitora local narrativa</h3><p>O modelo primeiro interpreta livremente a tiragem e depois transforma a leitura em uma estrutura clara, sem frases prontas.</p></div><span class="connection" id="aiState">Motor local básico</span></div><section id="localAiControls" class="local-ai-card"><div class="ai-control-grid"><label>Modelo local<select id="localModel">${localModels.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}${item.vram ? ` · ~${(item.vram / 1073741824).toFixed(1)} GB` : ''}</option>`).join('')}</select></label><label>Estilo<select id="localQuality"><option value="deep">Profunda · natural</option><option value="studio">Studio · mais longa</option></select></label></div><div class="local-ai-progress"><i id="localAiProgressBar"></i></div><p id="localAiStatus" data-state="idle">Escolha o modelo. Modelos de 8B entregam leituras mais livres e coerentes.</p><div class="button-row"><button class="btn secondary" id="activateLocalAi" type="button">Baixar e ativar IA local</button><button class="btn text" id="deactivateLocalAi" type="button">Desativar IA local</button></div></section><details class="external-ai-details"><summary>Gemini opcional</summary><div class="ai-fields"><label>Chave Gemini<input id="geminiKey" type="password" autocomplete="off" placeholder="Opcional"></label><label>Modelo<select id="geminiModel"><option value="">Conecte para listar modelos</option></select></label></div><div class="button-row"><button class="btn ghost" data-action="connect-ai">Conectar Gemini</button><button class="btn text" data-action="disconnect-ai">Desconectar</button></div></details><small id="aiHelp">A IA local não usa créditos. A qualidade depende do modelo, da GPU e da memória disponível.</small>`;
  $('activateLocalAi')?.addEventListener('click', activateLocalAI);
  $('deactivateLocalAi')?.addEventListener('click', deactivateLocalAI);
  $('localQuality')?.addEventListener('change', (event) => { quality = event.target.value; });
  document.querySelectorAll('.hero .eyebrow').forEach((element) => { element.textContent = 'Couple Experience · v10 Narrative Local AI'; });
  const heroText = document.querySelector('.hero > p');
  if (heroText) heroText.textContent = 'Uma experiência com 96 cartas e uma leitora local que interpreta livremente cada tiragem, sem respostas padronizadas.';
  const credit = document.querySelector('#view-credits .credits p');
  if (credit) credit.textContent = 'Conceito, direção criativa e autoria de Primeira Faísca. Edição v10 com 96 cartas e leitura local narrativa.';
}

const fallbackObserver = new MutationObserver(() => {
  if (!busy || !$('readingSections')) return;
  const text = $('readingSections').textContent || '';
  if (/formam uma sequência simbólica|a primeira mostra o clima percebido|abre o tema/i.test(text)) $('readingSections').innerHTML = '<div class="agent-placeholder"><span class="agent-orb"></span><div><b>A leitura livre está sendo criada.</b><p>O texto básico foi ocultado enquanto o modelo interpreta a combinação completa.</p></div></div>';
});

function startObservers() {
  if ($('readingSections')) fallbackObserver.observe($('readingSections'), { childList: true, subtree: true, characterData: true });
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if ((action === 'draw-tarot' || action === 'retry-tarot') && engine && activeModel) setTimeout(() => { ensureReaderPanel(); if ($('readingEngine')) $('readingEngine').textContent = 'Leitura narrativa local'; }, 0);
  }, true);
}

(() => {
  const modes = {
    romantico: { label: 'Romântico', actions: ['Dar as mãos e aproximar os rostos','Trocar um abraço demorado','Escolher juntos um beijo carinhoso','Fazer uma carícia leve nos cabelos','Dançar devagar e próximos','Trocar elogios em voz baixa'], moods: ['delicado','carinhoso','calmo','romântico','terno','como uma cena de filme'] },
    flertante: { label: 'Flertante', actions: ['Sustentar contato visual e sorrir sem falar','Sussurrar o que mais admira no outro','Trocar um beijo demorado, se ambos quiserem','Fazer carinho nas mãos e nos braços','Recriar o começo de um encontro ideal','Aproximar-se devagar e deixar o outro escolher o gesto'], moods: ['flertante','brincalhão','misterioso','lento','provocante sem pressão','romântico e confiante'] },
    intenso: { label: 'Intenso, não explícito', actions: ['Trocar um beijo demorado com uma pausa para confirmar o conforto','Ficar em um abraço firme e prolongado','Fazer uma carícia suave no rosto, cabelo ou braços','Dançar próximos durante um trecho de música','Trocar três beijos carinhosos no rosto ou nas mãos','Sussurrar uma frase de desejo romântico e ouvir a resposta'], moods: ['intenso e carinhoso','lento e romântico','flertante','misterioso','confiante','com muita presença'] }
  };
  const times = ['10 segundos','15 segundos','20 segundos','30 segundos','45 segundos','60 segundos'];
  let mode = 'flertante';
  const level = () => Number(document.querySelector('#levels .active')?.dataset.level || 2);
  const effectiveMode = () => mode === 'intenso' && level() < 3 ? 'flertante' : mode;
  const setDie = (id, number, label) => { const die = $(id); if (!die) return; if (die.querySelector('span')) die.querySelector('span').textContent = String(number); if (die.querySelector('b')) die.querySelector('b').textContent = label; die.classList.remove('rolling'); void die.offsetWidth; die.classList.add('rolling'); };
  const roll = () => { const selected = modes[effectiveMode()]; const ai = Math.floor(Math.random() * selected.actions.length); const ti = Math.floor(Math.random() * times.length); const mi = Math.floor(Math.random() * selected.moods.length); const combo = `${selected.actions[ai]} por ${times[ti]}, em um clima ${selected.moods[mi]}.`; setDie('dieAction', ai + 1, selected.actions[ai]); setDie('dieTime', ti + 1, times[ti]); setDie('dieMood', mi + 1, selected.moods[mi]); if ($('diceCombo')) $('diceCombo').textContent = combo; if ($('diceMeaning')) $('diceMeaning').textContent = 'Antes de começar, cada pessoa escolhe manter, adaptar, trocar ou parar. A escolha pode mudar a qualquer momento.'; if ($('diceSaved')) $('diceSaved').textContent = `Modo ${selected.label}. Momento pronto para entrar no contexto do Tarô.`; if ($('continueTarot')) $('continueTarot').disabled = false; };
  const injectChemistry = () => { const view = $('view-chemistry'); const grid = view?.querySelector('.dice-grid'); if (!view || !grid || $('chemistryMode')) return; const controls = document.createElement('section'); controls.className = 'surface chemistry-mode'; controls.innerHTML = '<div><span class="eyebrow">Clima do casal</span><h3>Escolham a proximidade</h3><p>Qualquer resultado pode ser adaptado ou trocado.</p></div><label>Estilo<select id="chemistryMode"><option value="romantico">Romântico</option><option value="flertante" selected>Flertante</option><option value="intenso">Intenso · não explícito</option></select></label><small id="chemistryModeNote">O modo intenso exige a intensidade Faísca.</small>'; grid.parentElement.insertBefore(controls, grid); $('chemistryMode')?.addEventListener('change', (event) => { mode = event.target.value; }); };
  document.addEventListener('click', (event) => { if (!event.target.closest('[data-action="roll"]')) return; event.preventDefault(); event.stopImmediatePropagation(); roll(); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectChemistry, { once: true }); else injectChemistry();
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { injectUI(); startObservers(); }, { once: true });
else { injectUI(); startObservers(); }
