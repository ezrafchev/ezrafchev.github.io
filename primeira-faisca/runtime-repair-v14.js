'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const HELPER_HEALTH = 'http://127.0.0.1:8787/health';

  function withTimeout(url, timeout = 2500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { cache:'no-store', signal:controller.signal }).finally(() => clearTimeout(timer));
  }

  function state(id, ok, text) {
    const node = $(id);
    if (!node) return;
    node.dataset.state = ok ? 'ready' : 'error';
    const label = node.querySelector('span:last-child');
    if (label) label.textContent = text;
  }

  async function diagnose() {
    state('pf14CheckWebGPU', 'gpu' in navigator, 'gpu' in navigator ? 'WebGPU disponível' : 'WebGPU indisponível');
    try {
      const response = await withTimeout(HELPER_HEALTH);
      const data = await response.json().catch(() => ({}));
      state('pf14CheckHelper', response.ok, response.ok ? `Helper local ativo${data?.runtime ? ` · ${data.runtime}` : ''}` : `Helper respondeu ${response.status}`);
    } catch {
      state('pf14CheckHelper', false, 'Helper local não iniciado');
    }
    const endpoint = (localStorage.getItem('pf13_cloud_endpoint') || '').trim();
    state('pf14CheckBackend', Boolean(endpoint), endpoint ? 'Backend seguro configurado' : 'Backend seguro não configurado');
  }

  function inject() {
    const panel = $('pf13SettingsPanel');
    if (!panel || $('pf14Diagnostics')) return false;
    const diagnostics = document.createElement('div');
    diagnostics.id = 'pf14Diagnostics';
    diagnostics.className = 'pf14-diagnostics';
    diagnostics.innerHTML = `
      <div class="pf14-diagnostics-head"><span>DIAGNÓSTICO REAL</span><button type="button" id="pf14Retest">Testar novamente</button></div>
      <div class="pf14-checks">
        <div id="pf14CheckWebGPU"><i></i><span>Verificando WebGPU…</span></div>
        <div id="pf14CheckHelper"><i></i><span>Verificando helper local…</span></div>
        <div id="pf14CheckBackend"><i></i><span>Verificando backend seguro…</span></div>
      </div>
      <p>Modelos WebGPU podem ser baixados direto no navegador. API key e modelos Ollama exigem o helper local ou um backend seguro.</p>
      <a class="pf14-helper-link" href="local-gpt-oss/start-faisca-ai.bat" download>Baixar inicializador do helper para Windows</a>`;
    const title = panel.querySelector('.pf13-settings-title');
    if (title?.nextSibling) panel.insertBefore(diagnostics, title.nextSibling);
    else panel.prepend(diagnostics);

    const tokenBlock = panel.querySelector('.pf13-token-vault');
    if (tokenBlock) {
      const firstParagraph = tokenBlock.querySelector('p');
      if (firstParagraph && firstParagraph.id !== 'pf13TokenStatus') firstParagraph.textContent = 'A chave nunca é enviada diretamente pelo GitHub Pages. Ela funciona pelo helper local ou por um backend seguro.';
    }

    $('pf14Retest')?.addEventListener('click', diagnose);
    $('pf13ConnectToken')?.addEventListener('click', async (event) => {
      try {
        const response = await withTimeout(HELPER_HEALTH, 1800);
        if (response.ok) return;
      } catch {}
      event.preventDefault();
      event.stopImmediatePropagation();
      const note = $('pf13SettingsNote');
      if (note) {
        note.textContent = 'O token não foi enviado: o helper local não está ativo. Use o modelo WebGPU abaixo ou inicie o helper para proteger a chave.';
        note.dataset.state = 'error';
      }
      diagnose();
    }, true);

    diagnose();
    return true;
  }

  function start() {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'design-v14.css?v=14.0';
    document.head.appendChild(style);
    if (inject()) return;
    const observer = new MutationObserver(() => { if (inject()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 20_000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();