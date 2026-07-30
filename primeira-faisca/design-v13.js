'use strict';

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  function loadCss() {
    if (document.querySelector('link[href*="design-v13.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'design-v13.css?v=13.0';
    document.head.appendChild(link);
  }
  function updateAccent() {
    const id = document.querySelector('.view:not(.hidden)')?.id || 'view-home';
    const map = {
      'view-home':['#9b87f5','#ff718b'],'view-setup':['#6ee7f2','#9b87f5'],'view-session':['#ff718b','#9b87f5'],
      'view-map':['#86efac','#6ee7f2'],'view-chemistry':['#ff718b','#f1d18a'],'view-tarot':['#9b87f5','#6ee7f2'],'view-closing':['#f1d18a','#ff718b']
    };
    const [a,b] = map[id] || map['view-home'];
    document.documentElement.style.setProperty('--pf13-stage-a', a);
    document.documentElement.style.setProperty('--pf13-stage-b', b);
  }
  function heroSystem() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.pf13-hero-system')) return;
    const rail = document.createElement('div');
    rail.className = 'pf13-hero-system';
    rail.innerHTML = '<span>GPT‑5.6 Sol</span><span>OpenAI gpt‑oss local</span><span>IA WebGPU privada</span><span>96 cartas autorais</span>';
    const buttons = hero.querySelector('.button-row');
    if (buttons) hero.insertBefore(rail, buttons); else hero.appendChild(rail);
    document.querySelectorAll('.hero .eyebrow').forEach((node) => { node.textContent = 'Primeira Faísca · Intelligence Experience v13'; });
    const text = hero.querySelector(':scope > p');
    if (text) text.textContent = 'Uma experiência digital para casais com direção editorial, três camadas de inteligência e uma interface espacial construída para conversa, descoberta e presença.';
  }
  function engineRail() {
    const setup = $('view-setup');
    const panel = $('aiPanel');
    if (!setup || !panel || setup.querySelector('.pf13-engine-rail')) return;
    const rail = document.createElement('section');
    rail.className = 'pf13-engine-rail';
    rail.innerHTML = [
      ['OPENAI CLOUD','GPT‑5.6 Sol','Máxima capacidade por API segura.'],
      ['OPENAI LOCAL','gpt‑oss‑20b','Sem cobrança por token; processamento no computador.'],
      ['PRIVATE BROWSER','WebGPU','Fallback local direto no navegador.']
    ].map(([small,big,text])=>`<article><small>${small}</small><b>${big}</b><span>${text}</span></article>`).join('');
    panel.parentElement.insertBefore(rail, panel);
  }
  function pointer() {
    if (reduced) return;
    let frame = 0;
    addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--pf13-mx', `${event.clientX}px`);
        document.documentElement.style.setProperty('--pf13-my', `${event.clientY}px`);
        frame = 0;
      });
    }, { passive:true });
  }
  function refineBrand() {
    const small = document.querySelector('.brand small');
    if (small) small.textContent = 'Intelligence Experience';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#050508';
  }
  function dynamic() {
    new MutationObserver(() => { updateAccent(); engineRail(); }).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
  }
  function init() {
    loadCss();
    document.documentElement.dataset.pf13 = '1';
    document.body.dataset.pf13 = '1';
    refineBrand(); heroSystem(); engineRail(); updateAccent(); pointer(); dynamic();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();