'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const KEYS = {
    cloudEndpoint: 'pf13_cloud_endpoint',
    cloudModel: 'pf13_cloud_model',
    engine: 'pf13_engine',
    open: 'pf13_open',
    minimized: 'pf14_agent_minimized',
    localEndpoint: 'pf13_oss_endpoint',
    localModel: 'pf13_oss_model'
  };
  const DEFAULT_HELPER = 'http://127.0.0.1:8787';
  let tokenConnected = false;

  function storage(key, fallback = '') {
    try { return String(localStorage.getItem(key) || fallback).trim(); }
    catch { return fallback; }
  }

  function helperBase() {
    const endpoint = storage(KEYS.localEndpoint, `${DEFAULT_HELPER}/v1/chat/completions`);
    return endpoint.replace(/\/v1\/chat\/completions\/?$/i, '').replace(/\/$/, '');
  }

  function helperUrl(path) {
    return `${helperBase()}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async function fetchTimeout(url, init = {}, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(url, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  function setOpenAIStatus(text, state = 'idle') {
    const node = $('pf14OpenAIStatus');
    if (node) { node.textContent = text; node.dataset.state = state; }
    const note = $('pf14OpenAINote');
    if (note) note.textContent = text;
  }

  function updateTokenState() {
    const button = $('pf14OpenAIConnect');
    if (button) button.textContent = tokenConnected ? 'Token conectado' : 'Conectar token';
    const status = $('pf14OpenAIStatus');
    if (status && tokenConnected) {
      status.textContent = 'OpenAI conectada';
      status.dataset.state = 'ready';
    }
  }

  async function checkHelper() {
    try {
      const response = await fetchTimeout(helperUrl('/session/openai-key'), { method: 'GET' }, 5000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      tokenConnected = Boolean(data?.connected);
      updateTokenState();
      return true;
    } catch {
      tokenConnected = false;
      updateTokenState();
      return false;
    }
  }

  async function connectToken() {
    const input = $('pf14OpenAIToken');
    const token = String(input?.value || '').trim();
    if (!token) {
      setOpenAIStatus('Cole a API key antes de conectar.', 'error');
      return;
    }
    setOpenAIStatus('Conectando ao cofre temporário local…');
    try {
      const response = await fetchTimeout(helperUrl('/session/openai-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      }, 12000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      tokenConnected = true;
      input.value = '';
      updateTokenState();
      setOpenAIStatus('Token conectado somente na memória do helper local.', 'ready');
    } catch (error) {
      setOpenAIStatus(`Helper não disponível: ${error?.message || error}. Inicie o helper local para usar a API key com segurança.`, 'error');
    }
  }

  async function removeToken() {
    try {
      const response = await fetchTimeout(helperUrl('/session/openai-key'), { method: 'DELETE' }, 9000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      tokenConnected = false;
      updateTokenState();
      setOpenAIStatus('Token removido da memória.', 'ready');
    } catch (error) {
      setOpenAIStatus(`Não foi possível remover o token: ${error?.message || error}`, 'error');
    }
  }

  function selectedOpenAIModel() {
    return $('pf14OpenAIModel')?.value || storage(KEYS.cloudModel, 'gpt-5.6-sol');
  }

  function applyOpenAIToAgent() {
    const endpointField = String($('pf14OpenAIEndpoint')?.value || '').trim();
    const endpoint = endpointField || helperUrl('/v1/openai/responses');
    const model = selectedOpenAIModel();
    localStorage.setItem(KEYS.cloudEndpoint, endpoint);
    localStorage.setItem(KEYS.cloudModel, model);
    localStorage.setItem(KEYS.engine, 'cloud');

    const agentEndpoint = $('pf13CloudEndpoint');
    const agentModel = $('pf13CloudModel');
    const agentEngine = $('pf13EngineSelect');
    if (agentEndpoint) agentEndpoint.value = endpoint;
    if (agentModel && [...agentModel.options].some((option) => option.value === model)) agentModel.value = model;
    if (agentEngine) agentEngine.value = 'cloud';

    window.dispatchEvent(new CustomEvent('pf14:openai-configured', { detail: { endpoint, model } }));
    setOpenAIStatus(`OpenAI ${model} selecionada como motor da Faísca.`, 'ready');
  }

  async function testOpenAI() {
    applyOpenAIToAgent();
    const endpoint = storage(KEYS.cloudEndpoint, helperUrl('/v1/openai/responses'));
    const model = selectedOpenAIModel();
    setOpenAIStatus(`Testando ${model}…`);
    try {
      const response = await fetchTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Responda apenas: OpenAI conectada.' }],
          context: '',
          reasoning_effort: model === 'gpt-5.6-sol' ? 'high' : 'medium',
          use_web: false
        })
      }, 90000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
      setOpenAIStatus(`Conectado · ${data?.model || model}`, 'ready');
    } catch (error) {
      setOpenAIStatus(`Falha no teste: ${error?.message || error}`, 'error');
    }
  }

  function openAgentSettings() {
    const launcher = $('pf13Launcher');
    const shell = $('pf13Shell');
    if (shell) {
      shell.style.display = 'grid';
      shell.classList.remove('hidden', 'pf14-agent-minimized');
      localStorage.setItem(KEYS.open, '1');
      localStorage.setItem(KEYS.minimized, '0');
    }
    launcher?.setAttribute('aria-expanded', 'true');
    setTimeout(() => $('pf13Settings')?.click(), 60);
  }

  function injectOpenAISetup() {
    const panel = $('aiPanel');
    if (!panel || $('pf14OpenAISetup')) return false;

    const openAI = document.createElement('section');
    openAI.id = 'pf14OpenAISetup';
    openAI.innerHTML = `
      <div class="pf14-engine-head">
        <div><span>OPENAI GPT</span><h4>ChatGPT e modelos GPT pela API</h4><p>Conecte uma API key pelo helper seguro ou informe o endpoint HTTPS do seu backend.</p></div>
        <b class="pf14-engine-status" id="pf14OpenAIStatus" data-state="idle">Não conectado</b>
      </div>
      <div class="pf14-engine-grid">
        <label>Modelo GPT
          <select id="pf14OpenAIModel">
            <option value="gpt-5.6-sol">GPT‑5.6 Sol · máxima capacidade</option>
            <option value="gpt-5.6-terra">GPT‑5.6 Terra · equilíbrio</option>
            <option value="gpt-5.6-luna">GPT‑5.6 Luna · rapidez</option>
            <option value="chat-latest">ChatGPT Latest</option>
          </select>
        </label>
        <label>Endpoint seguro
          <input id="pf14OpenAIEndpoint" type="url" autocomplete="off" placeholder="Helper local ou backend HTTPS">
        </label>
        <label class="wide">API key temporária
          <div class="pf14-secret"><input id="pf14OpenAIToken" type="password" autocomplete="off" spellcheck="false" placeholder="sk-proj-…"><button id="pf14ToggleOpenAIToken" type="button" aria-label="Mostrar ou ocultar chave">◉</button></div>
        </label>
      </div>
      <div class="pf14-engine-actions">
        <button class="primary" id="pf14OpenAIConnect" type="button">Conectar token</button>
        <button id="pf14OpenAITest" type="button">Testar GPT</button>
        <button id="pf14OpenAIUse" type="button">Usar na Faísca</button>
        <button id="pf14OpenAIRemove" type="button">Remover token</button>
      </div>
      <p class="pf14-engine-note" id="pf14OpenAINote">A chave não é salva no navegador. No GitHub Pages, a conexão segura exige helper local ou backend HTTPS.</p>`;

    const gptOss = document.createElement('section');
    gptOss.id = 'pf14GptOssSetup';
    gptOss.innerHTML = `
      <div class="pf14-engine-head">
        <div><span>GPT LOCAL DA OPENAI</span><h4>gpt‑oss</h4><p>O gpt‑oss não aparece no seletor “Modelo local” acima porque aquele seletor contém somente modelos WebGPU/WebLLM.</p></div>
        <b class="pf14-engine-status">Runtime separado</b>
      </div>
      <div class="pf14-engine-grid">
        <label>Modelo gpt‑oss
          <select id="pf14GptOssModel"><option value="gpt-oss:20b">gpt‑oss 20B · recomendado</option><option value="gpt-oss:120b">gpt‑oss 120B · hardware de datacenter</option></select>
        </label>
        <label>Endpoint local
          <input id="pf14GptOssEndpoint" type="url" value="http://127.0.0.1:8787/v1/chat/completions">
        </label>
      </div>
      <div class="pf14-engine-actions"><button class="primary" id="pf14GptOssUse" type="button">Selecionar gpt‑oss</button><button id="pf14OpenEngineStudio" type="button">Abrir gerenciador completo</button></div>
      <p class="pf14-model-warning">WebGPU baixa modelos direto no navegador. gpt‑oss 20B/120B exige runtime local porque não cabe no motor WebLLM atual.</p>`;

    const legacyGemini = panel.querySelector('.external-ai-details');
    panel.insertBefore(openAI, legacyGemini || null);
    panel.insertBefore(gptOss, legacyGemini || null);
    if (legacyGemini?.querySelector('summary')) legacyGemini.querySelector('summary').textContent = 'Gemini opcional · legado';

    $('pf14OpenAIModel').value = storage(KEYS.cloudModel, 'gpt-5.6-sol');
    $('pf14OpenAIEndpoint').value = storage(KEYS.cloudEndpoint, helperUrl('/v1/openai/responses'));
    $('pf14GptOssModel').value = storage(KEYS.localModel, 'gpt-oss:20b');
    $('pf14GptOssEndpoint').value = storage(KEYS.localEndpoint, `${DEFAULT_HELPER}/v1/chat/completions`);

    $('pf14ToggleOpenAIToken').addEventListener('click', () => {
      const input = $('pf14OpenAIToken');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    $('pf14OpenAIConnect').addEventListener('click', connectToken);
    $('pf14OpenAIRemove').addEventListener('click', removeToken);
    $('pf14OpenAITest').addEventListener('click', testOpenAI);
    $('pf14OpenAIUse').addEventListener('click', applyOpenAIToAgent);
    $('pf14GptOssUse').addEventListener('click', () => {
      const model = $('pf14GptOssModel').value;
      const endpoint = $('pf14GptOssEndpoint').value.trim();
      localStorage.setItem(KEYS.localModel, model);
      localStorage.setItem(KEYS.localEndpoint, endpoint);
      localStorage.setItem(KEYS.engine, 'gptoss');
      setOpenAIStatus(`Motor local selecionado: ${model}`, 'ready');
    });
    $('pf14OpenEngineStudio').addEventListener('click', openAgentSettings);
    checkHelper();
    return true;
  }

  function closeAgent(shell, launcher) {
    shell.classList.add('hidden');
    shell.classList.remove('pf14-agent-minimized');
    shell.style.display = 'none';
    localStorage.setItem(KEYS.open, '0');
    localStorage.setItem(KEYS.minimized, '0');
    launcher.style.display = 'grid';
    launcher.setAttribute('aria-expanded', 'false');
  }

  function openAgent(shell, launcher) {
    shell.style.display = 'grid';
    shell.classList.remove('hidden');
    localStorage.setItem(KEYS.open, '1');
    launcher.style.display = 'grid';
    launcher.setAttribute('aria-expanded', 'true');
  }

  function toggleMinimize(shell, button) {
    const minimized = shell.classList.toggle('pf14-agent-minimized');
    localStorage.setItem(KEYS.minimized, minimized ? '1' : '0');
    button.textContent = minimized ? '□' : '—';
    button.setAttribute('aria-label', minimized ? 'Restaurar Faísca' : 'Minimizar Faísca');
  }

  function fixAgent() {
    const shell = $('pf13Shell');
    const launcher = $('pf13Launcher');
    if (!shell || !launcher) return false;

    const actions = shell.querySelector('.pf13-head-actions');
    let minimize = $('pf14AgentMinimize');
    if (actions && !minimize) {
      minimize = document.createElement('button');
      minimize.id = 'pf14AgentMinimize';
      minimize.type = 'button';
      minimize.textContent = '—';
      minimize.setAttribute('aria-label', 'Minimizar Faísca');
      actions.insertBefore(minimize, actions.firstChild);
    }

    const close = $('pf13Close');
    if (shell.dataset.pf14Controls !== '1') {
      shell.dataset.pf14Controls = '1';
      minimize?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleMinimize(shell, minimize);
      }, true);
      close?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeAgent(shell, launcher);
      }, true);
      launcher.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!shell.classList.contains('hidden') && shell.style.display !== 'none') closeAgent(shell, launcher);
        else openAgent(shell, launcher);
      }, true);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !shell.classList.contains('hidden')) closeAgent(shell, launcher);
      });
    }

    if (storage(KEYS.open, '0') !== '1') closeAgent(shell, launcher);
    else {
      openAgent(shell, launcher);
      if (storage(KEYS.minimized, '0') === '1') {
        shell.classList.add('pf14-agent-minimized');
        if (minimize) { minimize.textContent = '□'; minimize.setAttribute('aria-label', 'Restaurar Faísca'); }
      }
    }
    return true;
  }

  function boot() {
    injectOpenAISetup();
    fixAgent();
    const observer = new MutationObserver(() => {
      injectOpenAISetup();
      fixAgent();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
