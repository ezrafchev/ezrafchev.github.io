'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const STORE = {
    engine: 'pf13_engine',
    cloudEndpoint: 'pf13_cloud_endpoint',
    cloudModel: 'pf13_cloud_model',
    ossEndpoint: 'pf13_oss_endpoint',
    ossModel: 'pf13_oss_model',
    ossGlobal: 'pf13_oss_global',
    history: 'pf13_history',
    open: 'pf13_open'
  };
  const MAX_HISTORY = 20;
  const DEFAULT_OSS_ENDPOINT = 'http://127.0.0.1:8787/v1/chat/completions';
  const SYSTEM = `Você é Faísca, uma assistente de IA completa e generalista integrada ao Primeira Faísca. Responda em português do Brasil com precisão, naturalidade e profundidade proporcional à pergunta. Você pode explicar assuntos gerais, escrever, revisar, raciocinar, programar, planejar, analisar o contexto da experiência e interpretar simbolicamente Lenormand. Use o contexto do site apenas quando ele for relevante; nunca force relacionamento em perguntas gerais. Não invente fatos atuais. Em temas românticos, preserve consentimento e conteúdo não explícito. Em Tarô e Lenormand, diferencie interpretação simbólica, hipótese e comportamento observável. Evite bordões, respostas genéricas e Markdown excessivo.`;

  const FALLBACK_CATALOG = [
    { id:'gpt-oss:20b', family:'OpenAI', name:'gpt-oss 20B', size:'14 GB', memory:'aprox. 16 GB', tier:'Mais capaz da OpenAI para PC', description:'Raciocínio local avançado e uso sem cobrança por token de API.' },
    { id:'gpt-oss:120b', family:'OpenAI', name:'gpt-oss 120B', size:'65 GB', memory:'GPU com cerca de 80 GB', tier:'Máxima capacidade local', description:'Versão para hardware de classe datacenter.' },
    { id:'qwen3:8b', family:'Qwen', name:'Qwen3 8B', size:'5,2 GB', memory:'aprox. 8 GB', tier:'Melhor equilíbrio', description:'Boa qualidade multilíngue e raciocínio.' },
    { id:'qwen3:4b', family:'Qwen', name:'Qwen3 4B', size:'2,5 GB', memory:'aprox. 5 GB', tier:'PCs intermediários', description:'Rápido e competente em português.' },
    { id:'phi4-mini', family:'Microsoft', name:'Phi-4 Mini', size:'2,5 GB', memory:'aprox. 5 GB', tier:'Raciocínio leve', description:'Compacto para instruções, matemática e análise.' },
    { id:'gemma3:4b', family:'Google', name:'Gemma 3 4B', size:'3,3 GB', memory:'aprox. 6 GB', tier:'Multilíngue', description:'Modelo compacto com contexto amplo.' },
    { id:'llama3.2:3b', family:'Meta', name:'Llama 3.2 3B', size:'2,0 GB', memory:'aprox. 4 GB', tier:'Mais leve', description:'Alternativa pequena com suporte ao português.' }
  ];

  let history = loadHistory();
  let busy = false;
  let generation = 0;
  let catalog = FALLBACK_CATALOG.map((item) => ({ ...item, installed:false }));
  let tokenConnected = false;

  function loadHistory() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORE.history) || '[]');
      return Array.isArray(value) ? value.slice(-MAX_HISTORY) : [];
    } catch { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORE.history, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
  }
  function remember(role, content) {
    const text = String(content || '').trim();
    if (!text) return;
    const previous = history.at(-1);
    if (!previous || previous.role !== role || previous.content !== text) history.push({ role, content:text });
    history = history.slice(-MAX_HISTORY);
    saveHistory();
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
  function currentView() {
    const id = document.querySelector('.view:not(.hidden)')?.id || 'view-home';
    return ({
      'view-home':'Início','view-setup':'Preparação','view-session':'Jornada','view-map':'Mapa',
      'view-chemistry':'Momento da Química','view-tarot':'Tarô Cigano','view-closing':'Encerramento',
      'view-kit':'Kit 3D','view-credits':'Créditos'
    })[id] || 'Experiência';
  }
  function read(id, limit = 1200) {
    return String($(id)?.value || $(id)?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, limit);
  }
  function context() {
    const cards = [...document.querySelectorAll('.lenormand')]
      .map((card) => card.innerText.trim().replace(/\s+/g, ' '))
      .filter(Boolean).slice(0, 3);
    return [
      `Etapa atual: ${currentView()}`,
      `Participantes: ${read('p1',60) || 'Pessoa 1'} e ${read('p2',60) || 'Pessoa 2'}`,
      read('questionText',700) ? `Pergunta do jogo: ${read('questionText',700)}` : '',
      read('cardGuidance',500) ? `Dinâmica: ${read('cardGuidance',500)}` : '',
      read('journeySynthesis',1800) ? `Síntese: ${read('journeySynthesis',1800)}` : '',
      read('diceCombo',650) ? `Momento da Química: ${read('diceCombo',650)}` : '',
      read('tarotQuestion',700) ? `Pergunta do Tarô: ${read('tarotQuestion',700)}` : '',
      cards.length ? `Cartas abertas: ${cards.join(' | ')}` : '',
      read('readingSections',3000) ? `Leitura atual: ${read('readingSections',3000)}` : ''
    ].filter(Boolean).join('\n');
  }
  function setting(name, fallback = '') { return (localStorage.getItem(name) || fallback).trim(); }
  function bridgeBase() {
    const endpoint = setting(STORE.ossEndpoint, DEFAULT_OSS_ENDPOINT);
    return endpoint.replace(/\/v1\/chat\/completions\/?$/i, '').replace(/\/$/, '');
  }
  function bridgeUrl(path) { return `${bridgeBase()}${path.startsWith('/') ? path : `/${path}`}`; }
  function setStatus(text, state = 'idle') {
    if ($('pf13Status')) $('pf13Status').textContent = text;
    if ($('pf13EngineLine')) $('pf13EngineLine').textContent = text;
    if ($('pf13Dot')) $('pf13Dot').dataset.state = state;
  }
  function setSettingsNote(text, state = '') {
    const note = $('pf13SettingsNote');
    if (note) { note.textContent = text; note.dataset.state = state; }
  }
  function render(role, text, engine = '', streaming = false) {
    const list = $('pf13Messages');
    if (!list) return null;
    const article = document.createElement('article');
    article.className = `pf13-message ${role}${streaming ? ' streaming' : ''}`;
    article.innerHTML = `<div class="pf13-bubble"></div><small>${role === 'user' ? 'Vocês' : `Faísca${engine ? ` · ${escapeHtml(engine)}` : ''}`}</small>`;
    article.querySelector('.pf13-bubble').textContent = text;
    list.appendChild(article);
    list.scrollTop = list.scrollHeight;
    return article;
  }
  function update(article, text) {
    const bubble = article?.querySelector('.pf13-bubble');
    if (bubble) bubble.textContent = cleanText(text);
    const list = $('pf13Messages');
    if (list) list.scrollTop = list.scrollHeight;
  }
  function renderHistory() {
    const list = $('pf13Messages');
    if (!list) return;
    list.innerHTML = '';
    if (!history.length) {
      render('assistant', 'Sou a Faísca. Posso responder perguntas gerais, escrever, analisar, programar, conversar sobre a experiência ou interpretar a tiragem. O modo automático escolhe entre GPT‑5.6, modelos locais baixados e IA do navegador.', 'orquestrador v13.1');
      return;
    }
    history.forEach((item) => render(item.role, item.content, item.role === 'assistant' ? 'histórico' : ''));
  }
  function messagesFor(question) {
    return [
      { role:'system', content:SYSTEM },
      ...history.slice(0, -1).slice(-13),
      { role:'user', content:`CONTEXTO OPCIONAL DO SITE:\n${context()}\n\nPERGUNTA ATUAL:\n${question}` }
    ];
  }
  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal:controller.signal }); }
    finally { clearTimeout(timer); }
  }
  async function parseOpenAIStream(response, article, requestId) {
    const reader = response.body?.getReader();
    if (!reader) {
      const data = await response.json();
      return cleanText(data?.choices?.[0]?.message?.content || data?.text || '');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (requestId !== generation) throw new Error('Resposta cancelada.');
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          output += data?.choices?.[0]?.delta?.content || '';
          update(article, output);
        } catch {}
      }
    }
    return cleanText(output);
  }
  async function askGptOss(question, article, requestId) {
    const endpoint = setting(STORE.ossEndpoint, DEFAULT_OSS_ENDPOINT);
    const model = setting(STORE.ossModel, 'gpt-oss:20b');
    setStatus(`Conectando ao ${model} local…`, 'loading');
    const response = await fetchWithTimeout(endpoint, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ model, messages:messagesFor(question), temperature:.64, top_p:.92, max_tokens:1800, stream:true })
    }, 180_000);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error?.message || data?.error || `Motor local respondeu ${response.status}.`);
    }
    const text = await parseOpenAIStream(response, article, requestId);
    if (!text) throw new Error('O modelo local não retornou texto.');
    return { text, engine:`local · ${model}` };
  }
  function cloudModelFor(question) {
    const chosen = setting(STORE.cloudModel, 'auto');
    if (chosen !== 'auto') return chosen;
    return /c[oó]digo|arquitet|analis|tar[oô]|lenormand|estrat[eé]gia|planej|complex|profund/i.test(question) || question.length > 500
      ? 'gpt-5.6-sol'
      : 'gpt-5.6-luna';
  }
  async function askCloud(question, article) {
    const configured = setting(STORE.cloudEndpoint);
    const endpoint = configured || bridgeUrl('/v1/openai/responses');
    const model = cloudModelFor(question);
    setStatus(`OpenAI ${model}…`, 'loading');
    const response = await fetchWithTimeout(endpoint, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ messages:history.slice(-14), context:context(), model, reasoning_effort:model === 'gpt-5.6-sol' ? 'high' : 'medium', use_web:false })
    }, 100_000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || `OpenAI respondeu ${response.status}.`);
    const text = cleanText(data?.text || data?.output_text || '');
    if (!text) throw new Error('A OpenAI não retornou texto.');
    update(article, text);
    return { text, engine:`OpenAI · ${data.model || model}` };
  }
  async function ensureBrowserLocal() {
    const ready = () => {
      const key = $('geminiKey')?.value || '';
      const status = ($('aiTopStatus')?.textContent || '').toLowerCase();
      return key.length >= 20 && /local|leitora|ag[eê]ntica/.test(status);
    };
    if (ready()) return;
    const button = $('activateLocalAi');
    if (!button) throw new Error('O módulo WebGPU ainda não está disponível nesta página.');
    button.click();
    const started = Date.now();
    while (Date.now() - started < 240_000) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw new Error('A IA do navegador não terminou de carregar.');
  }
  async function askBrowser(question, article) {
    if (!('gpu' in navigator)) throw new Error('Este navegador não oferece WebGPU.');
    setStatus('Preparando IA no navegador…', 'loading');
    await ensureBrowserLocal();
    const key = $('geminiKey')?.value || '';
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/local-webllm:generateContent', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
      body:JSON.stringify({
        systemInstruction:{ parts:[{ text:SYSTEM }] },
        contents:[{ role:'user', parts:[{ text:`HISTÓRICO:\n${history.slice(0,-1).slice(-10).map((item)=>`${item.role}: ${item.content}`).join('\n')}\n\nCONTEXTO OPCIONAL:\n${context()}\n\nPERGUNTA:\n${question}` }] }],
        generationConfig:{ temperature:.66, topP:.92, maxOutputTokens:1600 }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Falha na IA do navegador.');
    const text = cleanText(data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '');
    if (!text) throw new Error('A IA do navegador não retornou texto.');
    update(article, text);
    return { text, engine:'IA WebGPU no navegador' };
  }
  async function route(question, article, requestId) {
    const preference = setting(STORE.engine, 'auto');
    if (preference === 'cloud') return askCloud(question, article);
    if (preference === 'gptoss') return askGptOss(question, article, requestId);
    if (preference === 'browser') return askBrowser(question, article);

    const errors = [];
    if (setting(STORE.cloudEndpoint) || tokenConnected) {
      try { return await askCloud(question, article); } catch (error) { errors.push(`OpenAI: ${error.message}`); }
    }
    try { return await askGptOss(question, article, requestId); } catch (error) { errors.push(`local: ${error.message}`); }
    try { return await askBrowser(question, article); } catch (error) { errors.push(`WebGPU: ${error.message}`); }
    throw new Error(errors.join(' | ') || 'Nenhum motor avançado respondeu.');
  }
  async function send(value) {
    const question = String(value || '').trim();
    if (!question || busy) return;
    busy = true;
    const requestId = ++generation;
    const input = $('pf13Input');
    if (input) { input.value = ''; input.style.height = ''; }
    $('pf13Send')?.setAttribute('disabled', '');
    render('user', question);
    remember('user', question);
    const article = render('assistant', 'Selecionando o melhor motor…', 'orquestrador', true);
    setStatus('Selecionando motor…', 'loading');
    try {
      const answer = await route(question, article, requestId);
      article?.classList.remove('streaming');
      const meta = article?.querySelector('small');
      if (meta) meta.textContent = `Faísca · ${answer.engine}`;
      remember('assistant', answer.text);
      setStatus(answer.engine, 'ready');
    } catch (error) {
      const text = `Nenhum motor avançado conseguiu responder nesta tentativa. Abra as configurações e escolha: OpenAI por token temporário, um modelo local baixado ou IA WebGPU.\n\nDetalhe técnico: ${error?.message || error}`;
      update(article, text);
      article?.classList.remove('streaming');
      remember('assistant', text);
      setStatus('Motores indisponíveis', 'error');
    } finally {
      busy = false;
      $('pf13Send')?.removeAttribute('disabled');
      input?.focus();
    }
  }

  function modelLabel(item) {
    return `${item.installed ? '✓ ' : ''}${item.name} · ${item.size} · ${item.tier}`;
  }
  function populateModelControls() {
    const run = $('pf13OssModel');
    const download = $('pf13CatalogSelect');
    if (run) {
      const current = setting(STORE.ossModel, 'gpt-oss:20b');
      run.innerHTML = catalog.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(modelLabel(item))}</option>`).join('');
      run.value = catalog.some((item) => item.id === current) ? current : catalog[0]?.id || '';
    }
    if (download) {
      download.innerHTML = catalog.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.family} · ${item.name} · ${item.size}${item.installed ? ' · instalado' : ''}`)}</option>`).join('');
      download.dispatchEvent(new Event('change'));
    }
  }
  function updateCatalogDetails() {
    const model = catalog.find((item) => item.id === $('pf13CatalogSelect')?.value) || catalog[0];
    if (!model) return;
    if ($('pf13ModelDescription')) $('pf13ModelDescription').innerHTML = `<b>${escapeHtml(model.tier)}</b><span>${escapeHtml(model.description)}</span><small>Download: ${escapeHtml(model.size)} · memória: ${escapeHtml(model.memory)}${model.installed ? ' · já instalado' : ''}</small>`;
    if ($('pf13DownloadModel')) $('pf13DownloadModel').textContent = model.installed ? 'Reinstalar / atualizar' : 'Baixar modelo';
    if ($('pf13DeleteModel')) $('pf13DeleteModel').disabled = !model.installed;
  }
  async function refreshBridge() {
    setSettingsNote('Verificando bridge local, modelos e token…');
    try {
      const [catalogResponse, keyResponse] = await Promise.all([
        fetchWithTimeout(bridgeUrl('/models/catalog'), { method:'GET' }, 12_000),
        fetchWithTimeout(bridgeUrl('/session/openai-key'), { method:'GET' }, 12_000)
      ]);
      if (!catalogResponse.ok) throw new Error(`Catálogo HTTP ${catalogResponse.status}`);
      const data = await catalogResponse.json();
      catalog = Array.isArray(data?.models) && data.models.length ? data.models : catalog;
      if (keyResponse.ok) tokenConnected = Boolean((await keyResponse.json())?.connected);
      populateModelControls();
      updateTokenStatus();
      setSettingsNote('Bridge conectado. Escolha um modelo para baixar ou usar.', 'ready');
    } catch (error) {
      populateModelControls();
      updateTokenStatus();
      setSettingsNote(`Bridge local não encontrado: ${error?.message || error}. Inicie o servidor local para baixar modelos ou conectar o token.`, 'error');
    }
  }
  function updateTokenStatus() {
    const node = $('pf13TokenStatus');
    if (node) {
      node.textContent = tokenConnected ? 'Token conectado ao bridge local e mantido somente na memória.' : 'Nenhum token conectado.';
      node.dataset.state = tokenConnected ? 'ready' : 'idle';
    }
  }
  async function connectToken() {
    const input = $('pf13ApiToken');
    const token = String(input?.value || '').trim();
    if (!token) { setSettingsNote('Cole um token da OpenAI antes de conectar.', 'error'); return; }
    setSettingsNote('Entregando o token ao cofre temporário local…');
    try {
      const response = await fetchWithTimeout(bridgeUrl('/session/openai-key'), {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ token })
      }, 15_000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      tokenConnected = true;
      if (input) input.value = '';
      updateTokenStatus();
      setSettingsNote('Token conectado. Ele não foi salvo no navegador e será apagado quando o bridge for encerrado.', 'ready');
    } catch (error) { setSettingsNote(`Não foi possível conectar o token: ${error?.message || error}`, 'error'); }
  }
  async function clearToken() {
    try {
      const response = await fetchWithTimeout(bridgeUrl('/session/openai-key'), { method:'DELETE' }, 10_000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      tokenConnected = false;
      updateTokenStatus();
      setSettingsNote('Token removido da memória do bridge.', 'ready');
    } catch (error) { setSettingsNote(`Não foi possível remover o token: ${error?.message || error}`, 'error'); }
  }
  async function downloadModel() {
    const model = $('pf13CatalogSelect')?.value;
    if (!model) return;
    const button = $('pf13DownloadModel');
    if (button) button.disabled = true;
    const bar = $('pf13DownloadBar');
    if (bar) bar.style.width = '2%';
    setSettingsNote(`Iniciando download de ${model}…`);
    try {
      const response = await fetch(bridgeUrl('/models/pull'), {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ model })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream:true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              const total = Number(event?.total || 0);
              const completed = Number(event?.completed || 0);
              const progress = total > 0 ? Math.max(0.02, Math.min(1, completed / total)) : 0.08;
              if (bar) bar.style.width = `${progress * 100}%`;
              setSettingsNote(`${event?.status || 'Baixando'}${total > 0 ? ` · ${Math.round(progress * 100)}%` : ''}`);
            } catch {}
          }
        }
      }
      if (bar) bar.style.width = '100%';
      localStorage.setItem(STORE.ossModel, model);
      setSettingsNote(`${model} foi instalado e selecionado como motor local.`, 'ready');
      await refreshBridge();
    } catch (error) {
      if (bar) bar.style.width = '0%';
      setSettingsNote(`Falha ao baixar ${model}: ${error?.message || error}`, 'error');
    } finally { if (button) button.disabled = false; }
  }
  async function deleteModel() {
    const model = $('pf13CatalogSelect')?.value;
    if (!model) return;
    setSettingsNote(`Removendo ${model}…`);
    try {
      const response = await fetchWithTimeout(bridgeUrl('/models'), {
        method:'DELETE', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ model })
      }, 60_000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setSettingsNote(`${model} foi removido do computador.`, 'ready');
      await refreshBridge();
    } catch (error) { setSettingsNote(`Não foi possível remover o modelo: ${error?.message || error}`, 'error'); }
  }
  async function testLocalModel() {
    setSettingsNote('Testando o modelo local selecionado…');
    try {
      const endpoint = setting(STORE.ossEndpoint, DEFAULT_OSS_ENDPOINT);
      const response = await fetchWithTimeout(endpoint, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ model:$('pf13OssModel')?.value || setting(STORE.ossModel,'gpt-oss:20b'), messages:[{ role:'user', content:'Responda apenas: motor local pronto.' }], max_tokens:20, stream:false })
      }, 40_000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSettingsNote('Modelo local conectado e pronto.', 'ready');
    } catch (error) { setSettingsNote(`Não foi possível conectar: ${error?.message || error}. Confirme se o bridge e o Ollama estão ativos.`, 'error'); }
  }
  function saveSettings() {
    const engine = $('pf13EngineSelect')?.value || 'auto';
    const cloudEndpoint = String($('pf13CloudEndpoint')?.value || '').trim();
    const cloudModel = $('pf13CloudModel')?.value || 'auto';
    const ossEndpoint = String($('pf13OssEndpoint')?.value || DEFAULT_OSS_ENDPOINT).trim();
    const ossModel = $('pf13OssModel')?.value || 'gpt-oss:20b';
    const global = $('pf13OssGlobal')?.checked ? '1' : '0';
    if (cloudEndpoint && !/^https:\/\//i.test(cloudEndpoint) && !cloudEndpoint.startsWith('/')) {
      setSettingsNote('O endpoint remoto da OpenAI precisa usar HTTPS ou caminho relativo.', 'error');
      return;
    }
    localStorage.setItem(STORE.engine, engine);
    localStorage.setItem(STORE.cloudEndpoint, cloudEndpoint);
    localStorage.setItem(STORE.cloudModel, cloudModel);
    localStorage.setItem(STORE.ossEndpoint, ossEndpoint);
    localStorage.setItem(STORE.ossModel, ossModel);
    localStorage.setItem(STORE.ossGlobal, global);
    window.dispatchEvent(new CustomEvent('pf13:gptoss-config'));
    setSettingsNote('Configuração salva. O token da API nunca é persistido pelo site.', 'ready');
    setStatus(engine === 'cloud' ? 'OpenAI cloud' : engine === 'gptoss' ? `Local · ${ossModel}` : engine === 'browser' ? 'IA WebGPU' : 'Automático', 'ready');
  }
  function ensureExtraStyles() {
    if (document.querySelector('link[href*="design-v13-1.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'design-v13-1.css?v=13.1';
    document.head.appendChild(link);
  }
  function createUI() {
    ensureExtraStyles();
    document.querySelectorAll('.pf-agent-launcher,.pf-agent-shell,#pf12Launcher,#pf12Shell').forEach((node) => node.remove());
    if ($('pf13Launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'pf13Launcher';
    launcher.className = 'pf13-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Abrir Faísca AI');
    launcher.innerHTML = '<span class="pf13-launcher-core">✦</span><span class="pf13-launcher-ring"></span>';

    const shell = document.createElement('aside');
    shell.id = 'pf13Shell';
    shell.className = `pf13-shell${localStorage.getItem(STORE.open) === '1' ? '' : ' hidden'}`;
    shell.innerHTML = `
      <header class="pf13-head">
        <div class="pf13-mark"><span>✦</span></div>
        <div><b>Faísca AI</b><small id="pf13Status">Orquestrador inteligente</small></div>
        <div class="pf13-head-actions"><button id="pf13Reset" aria-label="Reiniciar">↻</button><button id="pf13Settings" aria-label="Configurar">⌘</button><button id="pf13Close" aria-label="Fechar">×</button></div>
      </header>
      <div class="pf13-contextbar"><span id="pf13Dot" data-state="idle"></span><span id="pf13EngineLine">Automático · OpenAI / local / WebGPU</span><b>${escapeHtml(currentView())}</b></div>
      <div class="pf13-messages" id="pf13Messages"></div>
      <div class="pf13-compose">
        <div class="pf13-suggestions"><button>Explique o que está acontecendo nesta etapa</button><button>Faça uma análise profunda</button><button>Ajude a escrever uma resposta</button><button>Interprete as cartas abertas</button></div>
        <div class="pf13-inputbox"><textarea id="pf13Input" rows="1" maxlength="2800" placeholder="Pergunte qualquer coisa…"></textarea><button id="pf13Send" aria-label="Enviar">↑</button></div>
        <small>Enter envia · Shift+Enter quebra linha · Ctrl/⌘+K abre</small>
      </div>
      <section class="pf13-settings" id="pf13SettingsPanel">
        <div class="pf13-settings-title"><div><small>ENGINE STUDIO 13.1</small><h3>Motores de inteligência</h3></div><button id="pf13SettingsClose">×</button></div>
        <label>Orquestração<select id="pf13EngineSelect"><option value="auto">Automático · melhor motor disponível</option><option value="cloud">OpenAI pela API</option><option value="gptoss">Modelo local instalado</option><option value="browser">IA WebGPU no navegador</option></select></label>

        <div class="pf13-settings-block pf13-token-vault">
          <span>OPENAI API · TOKEN TEMPORÁRIO</span>
          <label>API token<div class="pf13-secret-row"><input id="pf13ApiToken" type="password" autocomplete="off" spellcheck="false" placeholder="sk-proj-…"><button type="button" id="pf13ToggleToken" aria-label="Mostrar ou ocultar token">◉</button></div></label>
          <div class="pf13-inline-actions"><button type="button" id="pf13ConnectToken">Conectar token</button><button type="button" id="pf13ClearToken">Remover token</button></div>
          <p id="pf13TokenStatus" data-state="idle">Nenhum token conectado.</p>
          <label>Modelo OpenAI<select id="pf13CloudModel"><option value="auto">Automático · Sol para complexas, Luna para rápidas</option><option value="gpt-5.6-sol">GPT‑5.6 Sol · máxima capacidade</option><option value="gpt-5.6-terra">GPT‑5.6 Terra · equilíbrio</option><option value="gpt-5.6-luna">GPT‑5.6 Luna · menor custo</option><option value="chat-latest">Chat Latest · modelo Instant atual do ChatGPT</option></select></label>
          <label>Backend remoto opcional<input id="pf13CloudEndpoint" type="url" placeholder="Vazio = usar o bridge local com o token acima"></label>
          <p>O token é enviado somente ao bridge em <code>127.0.0.1</code>, mantido na memória e apagado ao encerrar o bridge. Ele não entra no GitHub nem no armazenamento do navegador.</p>
        </div>

        <div class="pf13-settings-block pf13-model-studio">
          <span>MODELOS LOCAIS GRATUITOS · DOWNLOAD</span>
          <label>Catálogo<select id="pf13CatalogSelect"></select></label>
          <div id="pf13ModelDescription" class="pf13-model-description"></div>
          <div class="pf13-download-track"><i id="pf13DownloadBar"></i></div>
          <div class="pf13-inline-actions"><button type="button" id="pf13DownloadModel">Baixar modelo</button><button type="button" id="pf13DeleteModel">Remover</button><button type="button" id="pf13RefreshModels">Atualizar lista</button></div>
          <label>Modelo ativo<select id="pf13OssModel"></select></label>
          <label>Endpoint local<input id="pf13OssEndpoint" type="url" value="${DEFAULT_OSS_ENDPOINT}"></label>
          <label class="pf13-check"><input id="pf13OssGlobal" type="checkbox">Usar o modelo local também no Tarô, síntese e encerramento</label>
          <button class="pf13-test" id="pf13TestOss" type="button">Testar modelo selecionado</button>
        </div>

        <div class="pf13-settings-actions"><button id="pf13Save">Salvar configuração</button><button id="pf13Back">Voltar</button></div>
        <p id="pf13SettingsNote">Inicie o bridge local para conectar o token e gerenciar downloads.</p>
      </section>`;
    document.body.append(launcher, shell);

    $('pf13EngineSelect').value = setting(STORE.engine, 'auto');
    $('pf13CloudEndpoint').value = setting(STORE.cloudEndpoint);
    $('pf13CloudModel').value = setting(STORE.cloudModel, 'auto');
    $('pf13OssEndpoint').value = setting(STORE.ossEndpoint, DEFAULT_OSS_ENDPOINT);
    $('pf13OssGlobal').checked = setting(STORE.ossGlobal, '0') === '1';
    populateModelControls();
    renderHistory();

    const open = () => { shell.classList.remove('hidden'); localStorage.setItem(STORE.open, '1'); setTimeout(() => $('pf13Input')?.focus(), 100); };
    const close = () => { shell.classList.add('hidden'); $('pf13SettingsPanel').classList.remove('open'); localStorage.setItem(STORE.open, '0'); };
    launcher.addEventListener('click', open);
    $('pf13Close').addEventListener('click', close);
    $('pf13Settings').addEventListener('click', () => { $('pf13SettingsPanel').classList.add('open'); refreshBridge(); });
    $('pf13SettingsClose').addEventListener('click', () => $('pf13SettingsPanel').classList.remove('open'));
    $('pf13Back').addEventListener('click', () => $('pf13SettingsPanel').classList.remove('open'));
    $('pf13Save').addEventListener('click', saveSettings);
    $('pf13TestOss').addEventListener('click', testLocalModel);
    $('pf13ConnectToken').addEventListener('click', connectToken);
    $('pf13ClearToken').addEventListener('click', clearToken);
    $('pf13ToggleToken').addEventListener('click', () => { const input = $('pf13ApiToken'); input.type = input.type === 'password' ? 'text' : 'password'; });
    $('pf13CatalogSelect').addEventListener('change', updateCatalogDetails);
    $('pf13DownloadModel').addEventListener('click', downloadModel);
    $('pf13DeleteModel').addEventListener('click', deleteModel);
    $('pf13RefreshModels').addEventListener('click', refreshBridge);
    $('pf13Reset').addEventListener('click', () => { history = []; saveHistory(); renderHistory(); });
    $('pf13Send').addEventListener('click', () => send($('pf13Input').value));
    $('pf13Input').addEventListener('input', (event) => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`; });
    $('pf13Input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event.target.value); } });
    shell.querySelectorAll('.pf13-suggestions button').forEach((button) => button.addEventListener('click', () => send(button.textContent)));
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
      if (event.key === 'Escape' && !shell.classList.contains('hidden')) close();
    });
    new MutationObserver(() => {
      const stage = shell.querySelector('.pf13-contextbar b');
      if (stage) stage.textContent = currentView();
    }).observe(document.querySelector('main') || document.body, { subtree:true, attributes:true, attributeFilter:['class'] });
    refreshBridge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createUI, { once:true });
  else createUI();
})();