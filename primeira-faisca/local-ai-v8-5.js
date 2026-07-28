import { CreateMLCEngine, prebuiltAppConfig } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

const MARKER = 'LOCAL_WEBLLM_STREAMING_V86';
const $ = (id) => document.getElementById(id);
const nativeFetch = window.fetch.bind(window);

let engine = null;
let activeModel = '';
let loading = false;
let generationActive = false;

const allIds = (prebuiltAppConfig?.model_list || [])
  .map((item) => item.model_id)
  .filter(Boolean);

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
  if (id && !localModels.some((item) => item.id === id)) {
    localModels.push({ id, label: pref.label });
  }
}

if (!localModels.length) {
  const fallback = allIds.find((id) => /Instruct.*q4f16/i.test(id));
  if (fallback) localModels.push({ id: fallback, label: fallback });
}

function headersObject(headers) {
  const out = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
  } else {
    Object.entries(headers || {}).forEach(([key, value]) => {
      out[String(key).toLowerCase()] = value;
    });
  }
  return out;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setStatus(message, state = 'idle') {
  const status = $('localAiStatus');
  if (status) {
    status.textContent = message;
    status.dataset.state = state;
  }

  const top = $('aiTopStatus');
  if (top) {
    top.textContent =
      state === 'ready' ? 'IA local ativa' :
      state === 'loading' ? 'IA local trabalhando' :
      'Motor local';
  }

  const dot = $('aiDot');
  if (dot) dot.classList.toggle('on', state === 'ready' || state === 'loading');
}

function setProgress(report) {
  const value = Number(report?.progress || 0);
  const bar = $('localAiProgressBar');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  setStatus(report?.text || 'Preparando modelo local…', 'loading');
}

function geminiPrompt(body) {
  const system = (body?.systemInstruction?.parts || [])
    .map((part) => part.text || '')
    .join('\n');
  const user = (body?.contents || [])
    .flatMap((content) => content.parts || [])
    .map((part) => part.text || '')
    .join('\n\n');
  return { system, user };
}

function isTarotPrompt(system, user) {
  return /baralho cigano|lenormand|tar[oô]/i.test(`${system}\n${user}`);
}

function ensureLivePanel() {
  const reading = $('reading');
  const loadingEl = $('readingLoading');

  reading?.classList.remove('hidden');
  loadingEl?.classList.remove('hidden');

  let panel = $('localAiLivePanel');
  if (!panel && reading) {
    panel = document.createElement('section');
    panel.id = 'localAiLivePanel';
    panel.className = 'local-ai-live-panel';
    panel.innerHTML = `
      <div class="local-ai-live-head">
        <span class="live-dot"></span>
        <b>Leitura local em tempo real</b>
        <small id="localAiLiveCounter">0 caracteres</small>
      </div>
      <div id="localAiLiveText" class="local-ai-live-text" aria-live="polite"></div>`;
    const sections = $('readingSections');
    reading.insertBefore(panel, sections || null);
  }

  panel?.classList.remove('hidden');
  const text = $('localAiLiveText');
  if (text) text.textContent = 'Preparando a primeira parte da interpretação…';
  return panel;
}

function humanizePartialJson(raw) {
  const labels = {
    visaoGeral: 'VISÃO GERAL',
    respostaPergunta: 'RESPOSTA À PERGUNTA',
    posicoes: 'AS TRÊS POSIÇÕES',
    posicao: 'Posição',
    carta: 'Carta',
    interpretacao: 'Interpretação',
    potencial: 'Potencial',
    sombra: 'Sombra',
    convite: 'Convite',
    combinacao: 'COMBINAÇÃO DAS CARTAS',
    dimensoes: 'DIMENSÕES DA RELAÇÃO',
    atracao: 'Atração',
    carinho: 'Carinho',
    confianca: 'Confiança',
    comunicacao: 'Comunicação',
    expectativas: 'Expectativas',
    intencao: 'Intenção',
    pontoAtencao: 'PONTO DE ATENÇÃO',
    planoPratico: 'PLANO PRÁTICO',
    perguntaFinal: 'PERGUNTA FINAL',
  };

  let text = String(raw || '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
  for (const [key, label] of Object.entries(labels)) {
    text = text.replace(new RegExp(`"${key}"\\s*:\\s*`, 'g'), `\n\n${label}\n`);
  }

  return text
    .replace(/[{}\[\]]/g, ' ')
    .replace(/"\s*,\s*"/g, '\n')
    .replace(/^\s*"/gm, '')
    .replace(/"\s*,?\s*$/gm, '')
    .replace(/,\s*(?=\n|$)/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(-9000);
}

function updateLivePreview(raw) {
  const text = $('localAiLiveText');
  const counter = $('localAiLiveCounter');
  if (text) {
    text.textContent = humanizePartialJson(raw) || 'A interpretação está sendo construída…';
    text.scrollTop = text.scrollHeight;
  }
  if (counter) counter.textContent = `${raw.length.toLocaleString('pt-BR')} caracteres`;
}

function finishLivePreview() {
  const counter = $('localAiLiveCounter');
  if (counter) counter.textContent = 'Estruturando leitura…';

  setTimeout(() => {
    $('localAiLivePanel')?.classList.add('hidden');
  }, 900);
}

async function runStreamingCompletion(request, schema) {
  let chunks;
  try {
    chunks = await engine.chat.completions.create({
      ...request,
      stream: true,
      stream_options: { include_usage: true },
    });
  } catch (error) {
    if (!schema) throw error;
    const fallbackRequest = { ...request };
    delete fallbackRequest.response_format;
    fallbackRequest.messages = [
      ...fallbackRequest.messages.slice(0, -1),
      {
        role: 'user',
        content: `${fallbackRequest.messages.at(-1)?.content || ''}\n\nRetorne somente JSON válido e completo. Não use Markdown.`,
      },
    ];
    chunks = await engine.chat.completions.create({
      ...fallbackRequest,
      stream: true,
      stream_options: { include_usage: true },
    });
  }

  let reply = '';
  for await (const chunk of chunks) {
    reply += chunk?.choices?.[0]?.delta?.content || '';
    updateLivePreview(reply);
  }

  if (!reply.trim() && typeof engine.getMessage === 'function') {
    reply = String(await engine.getMessage() || '');
  }
  return reply.trim();
}

async function localCompletion(body) {
  if (!engine || !activeModel) {
    throw new Error('A IA local ainda não foi ativada.');
  }
  if (generationActive) {
    throw new Error('A IA local já está elaborando outra resposta. Aguarde alguns instantes.');
  }

  generationActive = true;
  const { system, user } = geminiPrompt(body);
  const schema = body?.generationConfig?.responseJsonSchema;
  const tarot = isTarotPrompt(system, user);

  const request = {
    messages: [
      {
        role: 'system',
        content:
          `${system}\nResponda em português do Brasil. Preserve consentimento, não pressione contato físico e não trate símbolos como prova de sentimentos ocultos. ` +
          (schema
            ? 'Retorne somente JSON válido, completo e sem Markdown ou texto externo.'
            : 'Evite Markdown desnecessário e responda com clareza.'),
      },
      { role: 'user', content: user },
    ],
    temperature: 0.42,
    top_p: 0.9,
    max_tokens: Math.min(
      Number(body?.generationConfig?.maxOutputTokens) || 3000,
      4096,
    ),
  };

  if (schema) request.response_format = { type: 'json_object' };
  if (tarot) ensureLivePanel();

  setStatus(
    tarot
      ? 'Interpretando o Tarô em tempo real…'
      : 'A IA local está elaborando a resposta…',
    'loading',
  );

  try {
    const text = await runStreamingCompletion(request, schema);
    if (!text) throw new Error('A IA local retornou uma resposta vazia.');

    setStatus(`IA local ativa · ${activeModel}`, 'ready');
    if (tarot) finishLivePreview();

    return jsonResponse({
      candidates: [{
        content: { parts: [{ text }] },
        finishReason: 'STOP',
      }],
    });
  } finally {
    generationActive = false;
  }
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const headers = headersObject(init.headers || input?.headers);
  const key = headers['x-goog-api-key'] || '';

  if (
    url.includes('generativelanguage.googleapis.com/v1beta/models') &&
    key === MARKER
  ) {
    return jsonResponse({
      models: [{
        name: 'models/local-webllm',
        displayName: `IA local em tempo real · ${activeModel || 'WebLLM'}`,
        supportedGenerationMethods: ['generateContent'],
      }],
    });
  }

  if (
    url.includes('generativelanguage.googleapis.com') &&
    url.includes(':generateContent') &&
    (key === MARKER || url.includes('/local-webllm:generateContent'))
  ) {
    try {
      return await localCompletion(JSON.parse(init.body || '{}'));
    } catch (error) {
      return jsonResponse({
        error: { message: error?.message || 'Falha na IA local.' },
      }, 503);
    }
  }

  return nativeFetch(input, init);
};

async function activateLocalAI() {
  if (loading) return;

  if (!('gpu' in navigator)) {
    setStatus(
      'Este navegador não oferece WebGPU. Use Chrome ou Edge atualizados em um computador compatível.',
      'error',
    );
    return;
  }

  const selected = $('localModel')?.value || localModels[0]?.id;
  if (!selected) {
    setStatus('Nenhum modelo local compatível foi encontrado.', 'error');
    return;
  }

  loading = true;
  const button = $('activateLocalAi');
  if (button) {
    button.disabled = true;
    button.textContent = 'Baixando modelo…';
  }

  try {
    if (!engine || activeModel !== selected) {
      if (engine?.unload) await engine.unload().catch(() => {});
      engine = await CreateMLCEngine(selected, {
        initProgressCallback: setProgress,
      });
      activeModel = selected;
    }

    const keyInput = $('geminiKey');
    if (keyInput) keyInput.value = MARKER;

    document.querySelector('[data-action="connect-ai"]')?.click();

    setTimeout(() => {
      const modelSelect = $('geminiModel');
      if (modelSelect) modelSelect.value = 'local-webllm';

      const aiState = $('aiState');
      if (aiState) aiState.textContent = `IA local ativa · ${activeModel}`;

      setStatus(`IA local ativa · ${activeModel}`, 'ready');

      if ($('hostRole')) $('hostRole').textContent = 'Anfitriã local';
      if ($('hostMessage')) {
        $('hostMessage').textContent =
          'O modelo está rodando neste dispositivo e exibirá a leitura do Tarô enquanto escreve.';
      }
      if ($('hostMode')) $('hostMode').textContent = 'WebLLM streaming';
    }, 300);
  } catch (error) {
    console.error(error);
    setStatus(
      `Não foi possível carregar o modelo local: ${error?.message || error}`,
      'error',
    );
  } finally {
    loading = false;
    if (button) {
      button.disabled = false;
      button.textContent = engine ? 'IA local ativada' : 'Baixar e ativar IA local';
    }
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
        <h3>IA local gratuita com leitura em tempo real</h3>
        <p>O modelo roda no dispositivo e mostra a interpretação do Tarô enquanto escreve. Não exige token, assinatura ou créditos de API.</p>
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
    .local-ai-live-panel{margin:18px 0;padding:18px;border:1px solid rgba(216,180,254,.26);border-radius:20px;background:rgba(124,58,237,.06)}
    .local-ai-live-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .local-ai-live-head small{margin-left:auto;color:var(--muted)}
    .live-dot{width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 16px rgba(134,239,172,.65);animation:livePulse 1.1s infinite}
    .local-ai-live-text{max-height:320px;overflow:auto;white-space:pre-wrap;line-height:1.65;color:#e4e4e7;font-size:14px}
    @keyframes livePulse{50%{opacity:.35;transform:scale(.8)}}
  `;
  document.head.appendChild(style);

  $('activateLocalAi')?.addEventListener('click', activateLocalAI);
  $('deactivateLocalAi')?.addEventListener('click', deactivateLocalAI);

  document.querySelectorAll('.hero .eyebrow').forEach((element) => {
    element.textContent = 'Couple Experience · v8.6 Streaming AI';
  });

  const hero = document.querySelector('.hero > p');
  if (hero) {
    hero.textContent =
      'Uma jornada com 96 cartas e IA local que escreve a leitura do Tarô em tempo real, sem token e sem cota de API.';
  }

  document.querySelectorAll(
    '[data-action="refine-synthesis"],[data-action="refine-closing"]',
  ).forEach((button) => {
    button.textContent = 'Aprofundar com IA local';
  });

  if ($('retryTarot')) {
    $('retryTarot').textContent = 'Tentar novamente com IA local';
  }

  const credits = document.querySelector('#view-credits .credits p');
  if (credits) {
    credits.textContent =
      'Conceito, direção criativa e autoria de Primeira Faísca. Edição v8.6 com 96 cartas, IA local em tempo real e encerramento completo.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectUI, { once: true });
} else {
  injectUI();
}

'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  const POOLS = {
    romantico: {
      label: 'Romântico',
      actions: [
        'Dar as mãos e aproximar os rostos',
        'Trocar um abraço demorado',
        'Escolher juntos um beijo carinhoso',
        'Fazer uma carícia leve nos cabelos',
        'Dançar devagar e próximos',
        'Trocar elogios em voz baixa',
      ],
      moods: ['delicado', 'carinhoso', 'calmo', 'romântico', 'terno', 'como uma cena de filme'],
    },
    flertante: {
      label: 'Flertante',
      actions: [
        'Sustentar contato visual e sorrir sem falar',
        'Sussurrar o que mais admira no outro',
        'Trocar um beijo demorado, se ambos quiserem',
        'Fazer carinho nas mãos e nos braços',
        'Recriar o começo de um encontro ideal',
        'Aproximar-se devagar e deixar o outro escolher o gesto',
      ],
      moods: ['flertante', 'brincalhão', 'misterioso', 'lento', 'provocante sem pressão', 'romântico e confiante'],
    },
    intenso: {
      label: 'Intenso, não explícito',
      actions: [
        'Trocar um beijo demorado com uma pausa para confirmar o conforto',
        'Ficar em um abraço firme e prolongado',
        'Fazer uma carícia suave no rosto, cabelo ou braços',
        'Dançar próximos durante um trecho de música',
        'Trocar três beijos carinhosos em lugares escolhidos do rosto ou das mãos',
        'Sussurrar uma frase de desejo romântico e ouvir a resposta',
      ],
      moods: ['intenso e carinhoso', 'lento e romântico', 'flertante', 'misterioso', 'confiante', 'com muita presença'],
    },
  };

  const TIMES = ['10 segundos', '15 segundos', '20 segundos', '30 segundos', '45 segundos', '60 segundos'];
  let mode = 'flertante';

  function selectedLevel() {
    return Number(document.querySelector('#levels .active')?.dataset.level || 2);
  }

  function setDie(id, number, label) {
    const die = $(id);
    if (!die) return;
    const numberEl = die.querySelector('span');
    const labelEl = die.querySelector('b');
    if (numberEl) numberEl.textContent = String(number);
    if (labelEl) labelEl.textContent = label;
    die.classList.remove('rolling');
    void die.offsetWidth;
    die.classList.add('rolling');
  }

  function effectiveMode() {
    if (mode === 'intenso' && selectedLevel() < 3) return 'flertante';
    return mode;
  }

  function rollChemistry() {
    const selected = POOLS[effectiveMode()];
    const actionIndex = Math.floor(Math.random() * selected.actions.length);
    const timeIndex = Math.floor(Math.random() * TIMES.length);
    const moodIndex = Math.floor(Math.random() * selected.moods.length);

    const action = selected.actions[actionIndex];
    const duration = TIMES[timeIndex];
    const mood = selected.moods[moodIndex];

    setDie('dieAction', actionIndex + 1, action);
    setDie('dieTime', timeIndex + 1, duration);
    setDie('dieMood', moodIndex + 1, mood);

    const combo = `${action} por ${duration}, em um clima ${mood}.`;
    if ($('diceCombo')) $('diceCombo').textContent = combo;
    if ($('diceMeaning')) {
      $('diceMeaning').textContent =
        'Antes de começar, cada pessoa escolhe: manter, adaptar, trocar ou parar. Um “sim” pode mudar a qualquer momento.';
    }
    if ($('diceSaved')) {
      $('diceSaved').textContent =
        `Modo ${selected.label}. Momento pronto para ser guardado no contexto do Tarô.`;
    }
    if ($('continueTarot')) $('continueTarot').disabled = false;

    if ($('hostRole')) $('hostRole').textContent = 'Anfitriã da Química';
    if ($('hostMessage')) {
      $('hostMessage').textContent =
        `${combo} Confirmem juntos a versão confortável antes de começar.`;
    }
    if ($('hostMode')) $('hostMode').textContent = `modo ${selected.label.toLowerCase()}`;
  }

  function inject() {
    const view = $('view-chemistry');
    const grid = view?.querySelector('.dice-grid');
    if (!view || !grid || $('chemistryMode')) return;

    const controls = document.createElement('section');
    controls.className = 'surface chemistry-mode';
    controls.innerHTML = `
      <div>
        <span class="eyebrow">Clima do casal</span>
        <h3>Escolham o nível de proximidade</h3>
        <p>O modo intenso permanece romântico e não explícito. Qualquer resultado pode ser adaptado ou trocado.</p>
      </div>
      <label>Estilo do momento
        <select id="chemistryMode">
          <option value="romantico">Romântico</option>
          <option value="flertante" selected>Flertante</option>
          <option value="intenso">Intenso · não explícito</option>
        </select>
      </label>
      <small id="chemistryModeNote">O modo intenso exige a intensidade Faísca na preparação.</small>`;
    grid.parentElement.insertBefore(controls, grid);

    const style = document.createElement('style');
    style.textContent = `
      .chemistry-mode{display:grid;grid-template-columns:1.3fr .7fr;gap:24px;align-items:end;margin-bottom:18px}
      .chemistry-mode h3{margin:8px 0;font-size:clamp(24px,3vw,38px)}
      .chemistry-mode p,.chemistry-mode small{color:var(--muted);line-height:1.55}
      .chemistry-mode small{grid-column:1/-1}
      @media(max-width:760px){.chemistry-mode{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    $('chemistryMode')?.addEventListener('change', (event) => {
      mode = event.target.value;
      const note = $('chemistryModeNote');
      if (mode === 'intenso' && selectedLevel() < 3) {
        if (note) {
          note.textContent =
            'A intensidade atual não libera o modo intenso; o jogo usará o modo Flertante até selecionar Faísca.';
        }
      } else if (note) {
        note.textContent =
          'Confirmem juntos o gesto, o ritmo e o momento antes de começar.';
      }
    });

    const pageHead = view.querySelector('.page-head p');
    if (pageHead) {
      pageHead.textContent =
        'Os dados criam um momento romântico e flertante, com proximidade escolhida pelos dois.';
    }
  }

  document.addEventListener('click', (event) => {
    const roll = event.target.closest('[data-action="roll"]');
    if (!roll) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    rollChemistry();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();