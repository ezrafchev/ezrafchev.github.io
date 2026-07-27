'use strict';

(() => {
  const get = id => document.getElementById(id);
  const originalAIRequest = typeof aiRequest === 'function' ? aiRequest : null;
  const quotaState = new Map();
  let aiSessionCalls = 0;

  function quotaMessage() {
    return 'A cota gratuita da IA está temporariamente esgotada. A experiência continua com o motor local e a IA será tentada novamente quando houver disponibilidade.';
  }

  function isQuotaError(error) {
    const message = String(error?.message || error || '');
    return /quota|resource_exhausted|rate.?limit|429|free_tier_requests/i.test(message);
  }

  function retrySeconds(error) {
    const message = String(error?.message || error || '');
    const match = message.match(/retry\s+(?:in|after)\s+([\d.]+)\s*s/i) || message.match(/retryDelay[^\d]*([\d.]+)/i);
    return match ? Math.max(5, Math.ceil(Number(match[1]))) : 60;
  }

  function currentModelId() {
    return get('geminiModel')?.value || '';
  }

  function coolModel(model, seconds) {
    if (!model) return;
    quotaState.set(model, Date.now() + seconds * 1000);
  }

  function nextAvailableModel(excluded = new Set()) {
    const select = get('geminiModel');
    if (!select) return '';
    const now = Date.now();
    const options = [...select.options].map(option => option.value).filter(Boolean);
    return options.find(model => !excluded.has(model) && (quotaState.get(model) || 0) <= now) || '';
  }

  function shouldSpendExternalCall(role = '') {
    const important = /cigana|tar[oô]|editora|encerramento|diretora|s[ií]ntese|mediadora|verificador|guia de regras/i.test(role);
    if (important) return true;
    return aiSessionCalls < 3;
  }

  if (originalAIRequest) {
    aiRequest = async function managedAIRequest(prompt, options = {}) {
      if (!shouldSpendExternalCall(options.role || '')) {
        throw new Error('Intervenção local usada para preservar a cota da sessão.');
      }

      const attempted = new Set();
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const model = currentModelId();
        if (!model) throw new Error('Nenhum modelo de IA está selecionado.');
        attempted.add(model);
        try {
          aiSessionCalls += 1;
          return await originalAIRequest(prompt, options);
        } catch (error) {
          lastError = error;
          if (!isQuotaError(error)) throw error;
          const wait = retrySeconds(error);
          coolModel(model, wait);
          const next = nextAvailableModel(attempted);
          if (!next) {
            if (typeof setAIStatus === 'function') setAIStatus(`Cota gratuita em pausa · tente novamente em cerca de ${wait}s`);
            if (typeof host === 'function') host('IA da experiência', quotaMessage(), 'motor local ativo');
            throw new Error(quotaMessage());
          }
          get('geminiModel').value = next;
          if (typeof setAIStatus === 'function') setAIStatus(`Alternando automaticamente para ${next}`, true);
        }
      }
      throw lastError || new Error(quotaMessage());
    };
  }

  function localTarotSafe(selected, question) {
    if (typeof localTarot === 'function') return localTarot(selected, question);
    const roles = ['Clima atual', 'Ponte de conexão', 'Próximo passo'];
    return {
      visaoGeral: `As cartas ${selected.map(card => card[1]).join(', ')} formam uma sequência de reflexão. A primeira descreve o clima percebido, a segunda mostra como criar ligação e a terceira propõe um próximo passo.\n\nA leitura deve ser comparada com o que realmente aconteceu durante a jornada, sem tratar símbolos como prova sobre sentimentos ou futuro.`,
      respostaPergunta: question ? `A pergunta “${question}” pode ser explorada observando a relação entre as três cartas e confirmando qualquer interpretação por meio de conversa direta.` : 'A tiragem convida o casal a transformar curiosidade em comunicação clara.',
      posicoes: selected.map((card, index) => ({
        posicao: roles[index], carta: card[1], interpretacao: card[4], potencial: `O potencial está em ${card[3]}.`, sombra: card[5], convite: card[6]
      })),
      combinacao: 'Em conjunto, as cartas conectam atmosfera, ponte e ação. O valor da tiragem está em gerar uma conversa verificável e um próximo passo escolhido pelos dois.',
      dimensoes: {
        atracao: 'A tiragem pode representar curiosidade e presença, mas não comprova intensidade de atração.',
        carinho: 'Carinho deve ser reconhecido em cuidado, atenção e disponibilidade observáveis.',
        confianca: 'Confiança cresce por constância, clareza e respeito aos limites.',
        comunicacao: 'A comunicação transforma impressões em entendimento real.',
        expectativas: 'Expectativas precisam ser nomeadas para não virarem suposições.',
        intencao: 'Intenção só pode ser confirmada por escolhas e conversas diretas.'
      },
      pontoAtencao: 'Não usem as cartas para afirmar o que outra pessoa pensa ou sente.',
      planoPratico: selected.map(card => card[6]).slice(0, 3),
      perguntaFinal: 'Qual parte desta leitura corresponde a algo observável e qual parte ainda precisa ser conversada?'
    };
  }

  function renderLocalTarot(selected, question, meta = 'Motor local inteligente') {
    const data = localTarotSafe(selected, question);
    state.tarotCards = selected;
    state.tarotData = data;
    if (typeof renderReading === 'function') renderReading(data, meta);
    get('reading')?.classList.remove('hidden');
    get('readingLoading')?.classList.add('hidden');
    get('toClosing')?.classList.remove('hidden');
    if (get('readingEngine')) get('readingEngine').textContent = meta;
    if (typeof saveState === 'function') saveState();
  }

  async function robustDrawTarot() {
    const button = get('drawTarot');
    const originalLabel = button?.textContent || 'Tirar três cartas e interpretar';
    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Preparando a tiragem…';
      }
      if (typeof toast === 'function') toast('Embaralhando o Baralho Cigano…');

      const deck = typeof LENORMAND !== 'undefined' && Array.isArray(LENORMAND)
        ? LENORMAND
        : (typeof lenormand !== 'undefined' && Array.isArray(lenormand) ? lenormand : []);
      if (deck.length < 3) throw new Error('O Baralho Cigano não foi carregado corretamente.');

      const selected = typeof shuffle === 'function'
        ? shuffle(deck).slice(0, 3)
        : [...deck].sort(() => Math.random() - 0.5).slice(0, 3);
      const roles = ['Clima atual', 'Ponte de conexão', 'Próximo passo'];
      const spread = get('spread');
      if (!spread) throw new Error('A área das cartas não foi encontrada.');
      spread.innerHTML = selected.map((card, index) => `<article class="lenormand"><span class="number">${String(card[0]).padStart(2, '0')}</span><div class="symbol">${card[2]}</div><h3>${typeof escapeHtml === 'function' ? escapeHtml(card[1]) : card[1]}</h3><small>${roles[index]}</small></article>`).join('');
      spread.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const question = get('tarotQuestion')?.value.trim() || '';
      const extra = get('tarotContext')?.value.trim() || '';
      lastTarotRequest = { selected, q: question, extra };
      get('reading')?.classList.remove('hidden');
      get('readingLoading')?.classList.remove('hidden');
      if (get('readingSections')) get('readingSections').innerHTML = '';

      if (!geminiKey || !currentModelId()) {
        renderLocalTarot(selected, question);
        if (typeof host === 'function') host('Cigana simbólica', 'A leitura local foi concluída e o encerramento já está disponível.', 'motor local');
        return;
      }

      try {
        if (typeof hostThinking === 'function') hostThinking(true);
        if (typeof host === 'function') host('Cigana simbólica', 'Relacionando cartas, pergunta e percurso…', 'Gemini pensando');
        if (typeof aiRequest !== 'function' || typeof tarotPrompt !== 'function' || typeof TAROT_SCHEMA === 'undefined') throw new Error('O módulo de interpretação externa não está disponível.');
        const prompt = tarotPrompt(selected, question, extra);
        let response = await aiRequest(prompt, { schema: TAROT_SCHEMA, role: 'cigana simbólica e intérprete técnica do Lenormand', thinking: 'high', max: 12000 });
        let parsed;
        try {
          parsed = typeof validateTarot === 'function'
            ? validateTarot(validateRequired(parseJSON(response.result), TAROT_SCHEMA))
            : validateRequired(parseJSON(response.result), TAROT_SCHEMA);
        } catch (validationError) {
          response = await aiRequest(`A resposta anterior ficou incompleta: ${validationError.message}. Gere novamente todas as seções sem resumir.\n\n${prompt}`, { schema: TAROT_SCHEMA, role: 'cigana simbólica e intérprete técnica do Lenormand', thinking: 'high', max: 15000 });
          parsed = typeof validateTarot === 'function'
            ? validateTarot(validateRequired(parseJSON(response.result), TAROT_SCHEMA))
            : validateRequired(parseJSON(response.result), TAROT_SCHEMA);
        }
        state.tarotData = parsed;
        if (typeof renderReading === 'function') renderReading(parsed, response.meta || 'Gemini');
        if (get('readingEngine')) get('readingEngine').textContent = currentModelId() || 'Gemini';
        get('toClosing')?.classList.remove('hidden');
        if (typeof host === 'function') host('Cigana simbólica', 'A leitura completa foi concluída. O encerramento está pronto para ser construído.', 'Gemini conectado');
        if (typeof saveState === 'function') saveState();
      } catch (error) {
        renderLocalTarot(selected, question, isQuotaError(error) ? 'Motor local · cota gratuita em pausa' : 'Motor local · recuperação automática');
        if (typeof host === 'function') host('Cigana simbólica', isQuotaError(error) ? quotaMessage() : 'A tiragem foi recuperada pelo motor local.', 'motor local');
      } finally {
        if (typeof hostThinking === 'function') hostThinking(false);
      }
    } catch (error) {
      if (typeof toast === 'function') toast(error.message || 'Não foi possível iniciar a tiragem.');
      const reading = get('reading');
      if (reading) reading.classList.remove('hidden');
      if (get('readingSections')) get('readingSections').innerHTML = `<section class="readingSection"><h4>Não foi possível iniciar</h4><p>${typeof escapeHtml === 'function' ? escapeHtml(error.message) : error.message}</p><p>Atualize a página; o sistema tentará recarregar o baralho automaticamente.</p></section>`;
    } finally {
      get('readingLoading')?.classList.add('hidden');
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  function continueToTarot() {
    const combo = get('diceCombo')?.textContent.trim();
    if (!combo) {
      if (typeof toast === 'function') toast('Role os dados para criar o Momento da Química.');
      return;
    }
    state.lastDice = combo;
    if (get('diceSaved')) get('diceSaved').textContent = '✓ Momento guardado. Abrindo o Tarô…';
    if (typeof saveState === 'function') saveState();
    if (typeof host === 'function') host('Diretora da experiência', `O Momento da Química foi guardado: ${combo}`, 'sequência concluída');
    if (typeof show === 'function') show('tarot', { force: true });
  }

  function updateCopy() {
    document.querySelectorAll('h2, h3, p, span, b, small, button').forEach(node => {
      if (node.children.length) return;
      node.textContent = node.textContent
        .replace(/Ritual da Faísca/g, 'Momento da Química')
        .replace(/ritual da Faísca/gi, 'Momento da Química')
        .replace(/para o ritual/gi, 'para o Momento da Química')
        .replace(/Dealer do ritual/g, 'Anfitriã da Química');
    });
    const ritualTitle = document.querySelector('#ritual .pageHead h2');
    if (ritualTitle) ritualTitle.textContent = 'Momento da Química';
    const ritualIntro = document.querySelector('#ritual .pageHead p');
    if (ritualIntro) ritualIntro.textContent = 'Os dados transformam a atmosfera construída em uma proposta romântica, leve e escolhida pelos dois antes da leitura final.';

    const continueButton = document.querySelector('#ritual [data-view="tarot"], #continueToTarot');
    if (continueButton) {
      continueButton.removeAttribute('data-view');
      continueButton.id = 'continueToTarot';
      continueButton.textContent = 'Guardar momento e continuar para o Tarô';
    }

    const aiCopy = document.querySelector('#aiConfig .microcopy');
    if (aiCopy) aiCopy.textContent = 'O Gemini possui uma camada gratuita limitada por projeto e modelo; ela não é ilimitada. Quando a cota pausa, o site troca de modelo quando possível e continua com o motor local.';
  }

  function installHandlers() {
    document.addEventListener('click', event => {
      const tarotButton = event.target.closest?.('#drawTarot');
      if (tarotButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        robustDrawTarot();
        return;
      }
      const continueButton = event.target.closest?.('#continueToTarot');
      if (continueButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        continueToTarot();
      }
    }, true);

    get('saveDice')?.addEventListener('click', () => {
      setTimeout(() => {
        const continueButton = get('continueToTarot');
        if (continueButton) continueButton.classList.add('ready');
      }, 30);
    });

    window.addEventListener('error', event => {
      if (/drawTarot|LENORMAND|reading|spread/i.test(String(event.message || ''))) {
        if (typeof toast === 'function') toast('O Tarô encontrou um erro e ativou a recuperação local.');
      }
    });
  }

  const style = document.createElement('style');
  style.textContent = '#continueToTarot.ready{box-shadow:0 0 0 1px rgba(255,255,255,.16),0 0 34px rgba(232,92,184,.28)}';
  document.head.appendChild(style);
  updateCopy();
  installHandlers();
})();
