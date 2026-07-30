'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_ENDPOINT = 'pf_openai_endpoint_v11';
  const STORAGE_ENGINE = 'pf_agent_engine_v11';
  const STORAGE_OPEN = 'pf_agent_open_v11';
  const MAX_HISTORY = 14;
  const history = [];
  let responseId = '';
  let busy = false;

  const SYSTEM_PROMPT = `Você é Faísca, anfitriã de uma experiência romântica para um casal. Responda em português do Brasil, com calor humano, precisão e naturalidade. Use o contexto da etapa atual. Ajude com perguntas, reflexão, comunicação, consentimento e interpretação simbólica sem afirmar conhecer sentimentos ocultos nem prever fatos como certeza. Não pressione contato físico. Mantenha conteúdo romântico e não explícito. Evite Markdown pesado, títulos excessivos e frases genéricas. Dê uma resposta útil, específica e geralmente curta.`;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const icons = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-8.5 20-3.2-8.3L2 10.5 22 2Z"/><path d="m10.3 13.7 4.8-4.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6"/></svg>'
  };

  function installStyle() {
    if ($('pfAgentStyle')) return;
    const style = document.createElement('style');
    style.id = 'pfAgentStyle';
    style.textContent = `
      .pf-agent-launcher{position:fixed;right:22px;bottom:22px;z-index:90;width:62px;height:62px;border:1px solid rgba(255,255,255,.18);border-radius:21px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#fb7185,#7c3aed 62%,#67e8f9 140%);box-shadow:0 24px 65px rgba(76,29,149,.48),inset 0 1px 0 rgba(255,255,255,.55);transition:.25s cubic-bezier(.22,.78,.24,1)}
      .pf-agent-launcher:hover{transform:translateY(-4px) rotate(-2deg);filter:brightness(1.08)}.pf-agent-launcher svg{width:28px;height:28px}.pf-agent-launcher .pf-agent-pulse{position:absolute;inset:-5px;border:1px solid rgba(167,139,250,.38);border-radius:25px;animation:pfAgentPulse 2.4s ease-out infinite;pointer-events:none}
      .pf-agent-shell{position:fixed;right:22px;bottom:96px;z-index:89;width:min(430px,calc(100vw - 28px));height:min(690px,calc(100dvh - 125px));display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(255,255,255,.13);border-radius:30px;overflow:hidden;background:linear-gradient(160deg,rgba(22,21,34,.96),rgba(6,6,11,.98));backdrop-filter:blur(30px) saturate(135%);box-shadow:0 42px 130px rgba(0,0,0,.64),0 0 90px rgba(124,58,237,.13);transform-origin:bottom right;transition:opacity .24s ease,transform .28s cubic-bezier(.22,.78,.24,1)}
      .pf-agent-shell.pf-agent-hidden{opacity:0;transform:translateY(18px) scale(.94);pointer-events:none}.pf-agent-head{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:17px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(110deg,rgba(124,58,237,.13),rgba(251,113,133,.05))}.pf-agent-orb{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:radial-gradient(circle at 32% 25%,#fff 0 7%,#ddd6fe 25%,#8b5cf6 62%,#312e81);box-shadow:0 0 32px rgba(139,92,246,.42)}.pf-agent-orb svg{width:23px}.pf-agent-title{display:grid;gap:3px}.pf-agent-title b{font-size:15px}.pf-agent-title small{color:#9d99aa;font-size:11px}.pf-agent-head-actions{display:flex;gap:7px}.pf-agent-icon{width:38px;height:38px;border:1px solid rgba(255,255,255,.09);border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.025);color:#d7d4e2}.pf-agent-icon:hover{background:rgba(167,139,250,.09);border-color:rgba(167,139,250,.25)}.pf-agent-icon svg{width:18px;height:18px}
      .pf-agent-messages{overflow:auto;padding:19px;scroll-behavior:smooth}.pf-agent-message{display:grid;gap:6px;margin-bottom:16px}.pf-agent-message.user{justify-items:end}.pf-agent-message .bubble{max-width:88%;padding:12px 14px;border-radius:18px;white-space:pre-wrap;line-height:1.55;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.16)}.pf-agent-message.assistant .bubble{border:1px solid rgba(255,255,255,.08);background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.021));color:#e9e7ef;border-top-left-radius:7px}.pf-agent-message.user .bubble{background:linear-gradient(135deg,#7c3aed,#a21caf 62%,#be123c);color:#fff;border-top-right-radius:7px}.pf-agent-message small{color:#716d80;font-size:10px;padding-inline:4px}.pf-agent-thinking{display:flex;align-items:center;gap:5px;padding:13px 15px;width:max-content;border:1px solid rgba(255,255,255,.08);border-radius:17px 17px 17px 6px;background:rgba(255,255,255,.035)}.pf-agent-thinking i{width:6px;height:6px;border-radius:50%;background:#c4b5fd;animation:pfAgentDot 1.2s infinite}.pf-agent-thinking i:nth-child(2){animation-delay:.15s}.pf-agent-thinking i:nth-child(3){animation-delay:.3s}
      .pf-agent-suggestions{display:flex;gap:8px;overflow:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none}.pf-agent-suggestions::-webkit-scrollbar{display:none}.pf-agent-suggestions button{flex:none;padding:8px 10px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.025);color:#aaa6b5;font-size:11px;white-space:nowrap}.pf-agent-suggestions button:hover{color:#fff;border-color:rgba(167,139,250,.28);background:rgba(124,58,237,.08)}
      .pf-agent-compose{padding:14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(5,5,9,.76)}.pf-agent-input-wrap{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;border:1px solid rgba(255,255,255,.10);border-radius:19px;padding:7px 7px 7px 13px;background:rgba(255,255,255,.025);transition:.2s ease}.pf-agent-input-wrap:focus-within{border-color:rgba(167,139,250,.55);box-shadow:0 0 0 4px rgba(124,58,237,.09)}.pf-agent-input{min-height:38px;max-height:120px;border:0!important;box-shadow:none!important;background:transparent!important;padding:8px 0!important;resize:none;line-height:1.45}.pf-agent-send{width:43px;height:43px;border:0;border-radius:14px;display:grid;place-items:center;color:#08080c;background:linear-gradient(180deg,#fff,#e8e7ee);box-shadow:0 10px 25px rgba(255,255,255,.10)}.pf-agent-send:disabled{opacity:.42}.pf-agent-send svg{width:19px;height:19px}.pf-agent-foot{display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding-inline:2px;color:#716d80;font-size:10px}.pf-agent-engine-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#86efac;margin-right:5px}
      .pf-agent-settings{position:absolute;inset:77px 0 0;z-index:3;padding:19px;background:rgba(7,7,12,.985);backdrop-filter:blur(25px);transform:translateX(100%);transition:transform .28s cubic-bezier(.22,.78,.24,1);overflow:auto}.pf-agent-settings.open{transform:none}.pf-agent-settings h4{font-size:22px;margin:0 0 7px}.pf-agent-settings>p{color:#9995a6;line-height:1.5;font-size:13px;margin:0 0 20px}.pf-agent-settings label{margin-bottom:15px;font-size:12px}.pf-agent-settings input,.pf-agent-settings select{margin-top:7px;font-size:13px}.pf-agent-setting-actions{display:flex;gap:9px;margin-top:16px}.pf-agent-setting-actions button{flex:1}.pf-agent-privacy{margin-top:20px;padding:13px;border:1px solid rgba(103,232,249,.12);border-radius:15px;background:rgba(8,145,178,.035);color:#9995a6;font-size:11px;line-height:1.55}
      @keyframes pfAgentPulse{0%{transform:scale(.88);opacity:.7}100%{transform:scale(1.22);opacity:0}}@keyframes pfAgentDot{0%,70%,100%{transform:translateY(0);opacity:.35}35%{transform:translateY(-4px);opacity:1}}
      @media(max-width:760px){.pf-agent-launcher{right:15px;bottom:82px;width:56px;height:56px;border-radius:19px}.pf-agent-shell{right:7px;bottom:72px;width:calc(100vw - 14px);height:min(720px,calc(100dvh - 82px));border-radius:25px}.pf-agent-message .bubble{max-width:92%}}
      @media(prefers-reduced-motion:reduce){.pf-agent-launcher .pf-agent-pulse{display:none}.pf-agent-shell{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function currentViewName() {
    const view = document.querySelector('.view:not(.hidden)');
    const map = {
      'view-home':'Início','view-setup':'Preparação','view-session':'Jornada de perguntas','view-map':'Mapa da jornada',
      'view-chemistry':'Momento da Química','view-tarot':'Tarô Cigano','view-closing':'Encerramento','view-kit':'Kit 3D','view-credits':'Créditos'
    };
    return map[view?.id] || 'Experiência';
  }

  function collectContext() {
    const text = (id, limit = 1600) => String($(id)?.textContent || $(id)?.value || '').trim().slice(0, limit);
    const cards = [...document.querySelectorAll('.lenormand')].map((card) => card.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 3);
    const fields = [
      `Etapa atual: ${currentViewName()}`,
      `Participantes: ${text('p1',60) || 'Pessoa 1'} e ${text('p2',60) || 'Pessoa 2'}`,
      text('questionText',700) ? `Pergunta atual: ${text('questionText',700)}` : '',
      text('cardGuidance',500) ? `Dinâmica atual: ${text('cardGuidance',500)}` : '',
      text('journeySynthesis',1800) ? `Síntese da jornada: ${text('journeySynthesis',1800)}` : '',
      text('diceCombo',600) ? `Momento da Química: ${text('diceCombo',600)}` : '',
      text('tarotQuestion',700) ? `Pergunta do Tarô: ${text('tarotQuestion',700)}` : '',
      cards.length ? `Cartas visíveis: ${cards.join(' | ')}` : '',
      text('readingSections',3000) ? `Leitura atual: ${text('readingSections',3000)}` : '',
      text('finalPhrase',600) ? `Frase de encerramento: ${text('finalPhrase',600)}` : ''
    ].filter(Boolean);
    return fields.join('\n');
  }

  function basicReply(question) {
    const view = currentViewName();
    const q = question.toLowerCase();
    if (/como responder|o que falar|responder/.test(q)) return `Nesta etapa de ${view}, respondam com um exemplo concreto, um sentimento nomeado e um pedido possível. Evitem tentar acertar a resposta “ideal”; o valor está em mostrar como cada pessoa vive o tema.`;
    if (/tar[oô]|carta|tiragem/.test(q)) return 'Leiam as cartas como uma hipótese de conversa: observem a posição de cada símbolo, como eles se modificam em sequência e qual atitude concreta pode verificar a interpretação. Elas não substituem o que vocês conseguem perguntar diretamente um ao outro.';
    if (/aproxim|conex|intim/.test(q)) return 'Escolham um gesto pequeno e verificável: cada pessoa diz algo que gostaria de receber mais, algo que já valoriza e uma atitude que pode oferecer nesta semana. Proximidade costuma crescer quando intenção vira comportamento repetido.';
    if (/qu[ií]mica|beijo|carinho|gesto/.test(q)) return 'Confirmem primeiro o nível de proximidade que funciona para os dois. Mantenham, adaptem ou troquem o gesto sem pressão. O melhor resultado é aquele que cria presença e segurança, não o mais intenso.';
    return `Estou acompanhando a etapa “${view}”. Posso ajudar a transformar o que apareceu em uma pergunta mais clara, uma leitura simbólica ou um próximo passo concreto para o casal.`;
  }

  function appendMessage(role, text, engine = '') {
    const list = $('pfAgentMessages');
    if (!list) return;
    const article = document.createElement('article');
    article.className = `pf-agent-message ${role}`;
    article.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><small>${role === 'user' ? 'Vocês' : `Faísca${engine ? ` · ${escapeHtml(engine)}` : ''}`}</small>`;
    list.appendChild(article);
    list.scrollTop = list.scrollHeight;
  }

  function showThinking() {
    const list = $('pfAgentMessages');
    const element = document.createElement('div');
    element.id = 'pfAgentThinking';
    element.className = 'pf-agent-thinking';
    element.innerHTML = '<i></i><i></i><i></i>';
    list?.appendChild(element);
    if (list) list.scrollTop = list.scrollHeight;
  }

  function removeThinking() { $('pfAgentThinking')?.remove(); }

  function enginePreference() { return localStorage.getItem(STORAGE_ENGINE) || 'auto'; }
  function endpoint() { return (localStorage.getItem(STORAGE_ENDPOINT) || '').trim(); }
  function localReady() {
    const key = $('geminiKey')?.value || '';
    const status = ($('aiTopStatus')?.textContent || '').toLowerCase();
    return key.length >= 20 && /local|leitora|ag[eê]ntica/.test(status);
  }

  async function askLocal(question) {
    const key = $('geminiKey')?.value || '';
    if (!key || key.length < 20) throw new Error('A IA local ainda não foi ativada.');
    const context = collectContext();
    const recent = history.slice(-8).map((item) => `${item.role === 'user' ? 'Usuário' : 'Faísca'}: ${item.content}`).join('\n');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/local-webllm:generateContent', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role:'user', parts:[{ text: `CONTEXTO DO JOGO:\n${context}\n\nCONVERSA RECENTE:\n${recent}\n\nPERGUNTA ATUAL:\n${question}` }] }],
        generationConfig: { temperature:.65, topP:.92, maxOutputTokens:900 }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Falha na IA local.');
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) throw new Error('A IA local não produziu resposta.');
    return { text, engine:'local' };
  }

  async function askOpenAI(question) {
    const url = endpoint();
    if (!url) throw new Error('Configure o endpoint seguro da OpenAI.');
    const response = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        messages:[...history.slice(-10),{ role:'user', content:question }],
        context:collectContext(),
        previous_response_id:responseId || undefined
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || `Backend OpenAI respondeu ${response.status}.`);
    const text = String(data.text || data.output_text || '').trim();
    if (!text) throw new Error('O backend OpenAI não retornou texto.');
    responseId = data.response_id || responseId;
    return { text, engine:`OpenAI${data.model ? ` · ${data.model}` : ''}` };
  }

  async function routeQuestion(question) {
    const choice = enginePreference();
    if (choice === 'openai') return askOpenAI(question);
    if (choice === 'local') return askLocal(question);
    if (endpoint()) {
      try { return await askOpenAI(question); }
      catch (error) { console.warn('OpenAI indisponível; usando IA local.', error); }
    }
    if (localReady()) {
      try { return await askLocal(question); }
      catch (error) { console.warn('IA local indisponível; usando orientação básica.', error); }
    }
    return { text:basicReply(question), engine:'motor básico' };
  }

  async function sendQuestion(value) {
    const question = String(value || '').trim();
    if (!question || busy) return;
    busy = true;
    const input = $('pfAgentInput');
    const send = $('pfAgentSend');
    if (input) { input.value = ''; input.style.height = ''; }
    if (send) send.disabled = true;
    appendMessage('user', question);
    history.push({ role:'user', content:question });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    showThinking();
    updateStatus('Pensando no contexto desta etapa…');
    try {
      const answer = await routeQuestion(question);
      removeThinking();
      appendMessage('assistant', answer.text, answer.engine);
      history.push({ role:'assistant', content:answer.text });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
      updateStatus(answer.engine === 'local' ? 'IA local privada' : answer.engine);
    } catch (error) {
      removeThinking();
      const fallback = basicReply(question);
      appendMessage('assistant', `${fallback}\n\nO motor avançado não respondeu: ${error?.message || error}`, 'fallback');
      updateStatus('Motor básico');
    } finally {
      busy = false;
      if (send) send.disabled = false;
      input?.focus();
    }
  }

  function updateStatus(label) {
    if ($('pfAgentEngineStatus')) $('pfAgentEngineStatus').innerHTML = `<span class="pf-agent-engine-dot"></span>${escapeHtml(label || 'Automático')}`;
    const status = $('pfAgentHeaderStatus');
    if (status) status.textContent = `${currentViewName()} · ${label || 'Automático'}`;
  }

  function openAgent() {
    $('pfAgentShell')?.classList.remove('pf-agent-hidden');
    localStorage.setItem(STORAGE_OPEN, '1');
    setTimeout(() => $('pfAgentInput')?.focus(), 160);
  }
  function closeAgent() {
    $('pfAgentShell')?.classList.add('pf-agent-hidden');
    $('pfAgentSettings')?.classList.remove('open');
    localStorage.setItem(STORAGE_OPEN, '0');
  }
  function toggleSettings() { $('pfAgentSettings')?.classList.toggle('open'); }

  function saveSettings() {
    const value = String($('pfEndpointInput')?.value || '').trim();
    const engine = $('pfEngineSelect')?.value || 'auto';
    if (value && !/^https:\/\//i.test(value) && !value.startsWith('/')) {
      $('pfSettingsNote').textContent = 'Use um endereço HTTPS ou um caminho relativo iniciado por /.';
      return;
    }
    localStorage.setItem(STORAGE_ENDPOINT, value);
    localStorage.setItem(STORAGE_ENGINE, engine);
    $('pfSettingsNote').textContent = value ? 'Configuração salva somente neste navegador.' : 'Modo local salvo. Nenhuma chave é armazenada no site.';
    updateStatus(engine === 'openai' ? 'OpenAI seguro' : engine === 'local' ? 'IA local' : 'Automático');
  }

  function clearConversation() {
    history.splice(0, history.length);
    responseId = '';
    const list = $('pfAgentMessages');
    if (list) list.innerHTML = '';
    appendMessage('assistant', 'Conversa reiniciada. Estou acompanhando a etapa atual e pronta para ajudar.', 'anfitriã');
  }

  function createUI() {
    installStyle();
    if ($('pfAgentLauncher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'pfAgentLauncher';
    launcher.className = 'pf-agent-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label','Abrir anfitriã inteligente');
    launcher.innerHTML = `${icons.spark}<span class="pf-agent-pulse"></span>`;

    const shell = document.createElement('aside');
    shell.id = 'pfAgentShell';
    shell.className = `pf-agent-shell${localStorage.getItem(STORAGE_OPEN) === '1' ? '' : ' pf-agent-hidden'}`;
    shell.setAttribute('aria-label','Conversa com a anfitriã Faísca');
    shell.innerHTML = `
      <header class="pf-agent-head">
        <span class="pf-agent-orb">${icons.spark}</span>
        <div class="pf-agent-title"><b>Faísca</b><small id="pfAgentHeaderStatus">${escapeHtml(currentViewName())} · automático</small></div>
        <div class="pf-agent-head-actions">
          <button class="pf-agent-icon" id="pfAgentReset" type="button" aria-label="Reiniciar conversa">${icons.reset}</button>
          <button class="pf-agent-icon" id="pfAgentSettingsButton" type="button" aria-label="Configurar motores">${icons.settings}</button>
          <button class="pf-agent-icon" id="pfAgentClose" type="button" aria-label="Fechar conversa">${icons.close}</button>
        </div>
      </header>
      <div class="pf-agent-messages" id="pfAgentMessages">
        <div class="pf-agent-suggestions">
          <button type="button">Ajude a responder a pergunta atual</button>
          <button type="button">O que devemos observar nesta etapa?</button>
          <button type="button">Transforme isso em um próximo passo</button>
        </div>
      </div>
      <footer class="pf-agent-compose">
        <div class="pf-agent-input-wrap"><textarea class="pf-agent-input" id="pfAgentInput" rows="1" maxlength="1200" placeholder="Converse sobre a experiência…"></textarea><button class="pf-agent-send" id="pfAgentSend" type="button" aria-label="Enviar">${icons.send}</button></div>
        <div class="pf-agent-foot"><span id="pfAgentEngineStatus"><span class="pf-agent-engine-dot"></span>Automático</span><span>Enter envia · Shift+Enter quebra linha</span></div>
      </footer>
      <section class="pf-agent-settings" id="pfAgentSettings">
        <h4>Motores da anfitriã</h4>
        <p>O modo local é gratuito e privado. A OpenAI precisa de um backend seguro; nunca cole uma chave diretamente neste site.</p>
        <label>Preferência<select id="pfEngineSelect"><option value="auto">Automático · OpenAI, local e fallback</option><option value="local">Somente IA local</option><option value="openai">Somente OpenAI por backend</option></select></label>
        <label>Endpoint seguro da OpenAI<input id="pfEndpointInput" type="url" autocomplete="off" placeholder="https://seu-backend.exemplo/api/chat"></label>
        <div class="pf-agent-setting-actions"><button class="btn secondary" id="pfSaveAgentSettings" type="button">Salvar</button><button class="btn ghost" id="pfCloseAgentSettings" type="button">Voltar</button></div>
        <p id="pfSettingsNote" class="pf-agent-privacy">A chave OPENAI_API_KEY deve existir apenas como variável de ambiente no backend. O GitHub Pages não executa código de servidor.</p>
      </section>`;

    document.body.append(launcher, shell);
    $('pfEndpointInput').value = endpoint();
    $('pfEngineSelect').value = enginePreference();
    appendMessage('assistant', 'Estou aqui durante toda a experiência. Posso ajudar com a pergunta atual, organizar uma reflexão ou transformar o que surgiu em um próximo passo.', 'anfitriã');

    launcher.addEventListener('click', openAgent);
    $('pfAgentClose')?.addEventListener('click', closeAgent);
    $('pfAgentSettingsButton')?.addEventListener('click', toggleSettings);
    $('pfCloseAgentSettings')?.addEventListener('click', toggleSettings);
    $('pfSaveAgentSettings')?.addEventListener('click', saveSettings);
    $('pfAgentReset')?.addEventListener('click', clearConversation);
    $('pfAgentSend')?.addEventListener('click', () => sendQuestion($('pfAgentInput')?.value));
    $('pfAgentInput')?.addEventListener('input', (event) => {
      event.target.style.height = 'auto';
      event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
    });
    $('pfAgentInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendQuestion(event.target.value); }
    });
    document.querySelectorAll('.pf-agent-suggestions button').forEach((button) => button.addEventListener('click', () => sendQuestion(button.textContent)));
    document.addEventListener('pf:open-agent', openAgent);
    document.addEventListener('pf:close-agent', closeAgent);

    const observer = new MutationObserver(() => updateStatus(enginePreference() === 'auto' ? 'Automático' : enginePreference() === 'local' ? 'IA local' : 'OpenAI seguro'));
    observer.observe(document.querySelector('main') || document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createUI, { once:true });
  else createUI();
})();
