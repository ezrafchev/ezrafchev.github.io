'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadStyles() {
    if (document.querySelector('link[href*="design-v11.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'design-v11.css?v=11.0';
    document.head.appendChild(link);
  }

  function icon(name) {
    const paths = {
      heart: '<path d="M12 21s-7.4-4.7-9.4-9.1C.9 8.2 3.1 5 6.6 5c2 0 3.5 1 4.4 2.3C11.9 6 13.4 5 15.4 5c3.5 0 5.7 3.2 4 6.9C17.4 16.3 12 21 12 21Z"/>',
      spark: '<path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      chat: '<path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v6.4a2.8 2.8 0 0 1-2.8 2.8H10l-4.7 4v-4.1A2.8 2.8 0 0 1 4 12.2V5.8Z"/><path d="M8 8h8M8 11h5"/>',
      dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
      cards: '<rect x="5" y="3.5" width="12" height="17" rx="2.5" transform="rotate(-7 11 12)"/><rect x="8" y="3.5" width="12" height="17" rx="2.5" transform="rotate(7 14 12)"/><path d="m14 8 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1L14 8Z"/>',
      restart: '<path d="M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6"/>',
      music: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</svg>`;
  }

  function upgradeBrand() {
    const mark = document.querySelector('.brand-mark');
    if (mark) mark.innerHTML = icon('heart');
    const brandSmall = document.querySelector('.brand small');
    if (brandSmall) brandSmall.textContent = 'experience by Esdra Felipe';
  }

  function addHeroProof() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.pf-hero-proof')) return;
    const proof = document.createElement('div');
    proof.className = 'pf-hero-proof';
    proof.innerHTML = '<span>96 cartas únicas</span><span>Leitura narrativa local</span><span>Privacidade no dispositivo</span><span>OpenAI via backend seguro</span>';
    const buttons = hero.querySelector('.button-row');
    if (buttons) hero.insertBefore(proof, buttons);
    else hero.appendChild(proof);
  }

  function addQualityStrip() {
    const home = $('view-home');
    const soundtrack = home?.querySelector('.soundtrack');
    if (!home || !soundtrack || home.querySelector('.pf-quality-strip')) return;
    const strip = document.createElement('section');
    strip.className = 'pf-quality-strip';
    strip.innerHTML = [
      ['Direção adaptativa','A experiência entende a etapa e mantém o ritmo.'],
      ['Tarô autoral','Cada combinação é interpretada antes de ser diagramada.'],
      ['Agente contínuo','Uma conversa flutuante acompanha todo o percurso.'],
      ['Arquitetura segura','Segredos ficam no backend; o modo local segue gratuito.']
    ].map(([title, text]) => `<article><b>${title}</b><span>${text}</span></article>`).join('');
    home.insertBefore(strip, soundtrack);
  }

  function addButtonIcons() {
    const map = {
      'go-home':'home','go-setup':'arrow','start':'spark','answer':'arrow','roll':'dice','continue-tarot':'cards',
      'draw-tarot':'cards','retry-tarot':'cards','build-closing':'spark','restart':'restart','open-host':'chat',
      'ask-host':'chat','refine-synthesis':'spark','refine-closing':'spark','toggle-music':'music'
    };
    document.querySelectorAll('[data-action]').forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.pfIcon === '1') return;
      const name = map[button.dataset.action];
      if (!name || button.classList.contains('brand') || button.classList.contains('close')) return;
      button.dataset.pfIcon = '1';
      const wrapper = document.createElement('span');
      wrapper.className = 'pf-btn-icon';
      wrapper.innerHTML = icon(name);
      button.prepend(wrapper);
    });
    const style = document.createElement('style');
    style.textContent = '.pf-btn-icon{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:8px;vertical-align:-4px}.pf-btn-icon svg{width:100%;height:100%}.icon-btn .pf-btn-icon{margin:0}.icon-btn{display:grid;place-items:center}.icon-btn>.pf-btn-icon{width:19px;height:19px}';
    document.head.appendChild(style);
  }

  function addReveals() {
    const items = document.querySelectorAll('.surface,.route-grid article,.question-card,.dice-grid article,.lenormand,.metric-grid article,.final-moment');
    items.forEach((item) => item.classList.add('pf-reveal'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('pf-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -35px' });
    items.forEach((item) => observer.observe(item));
  }

  function enablePointerGlow() {
    if (reducedMotion) return;
    let frame = 0;
    window.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--pf-pointer-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--pf-pointer-y', `${event.clientY}px`);
        frame = 0;
      });
    }, { passive: true });
  }

  function enableTilt() {
    if (reducedMotion || !window.matchMedia('(pointer:fine)').matches) return;
    const selector = '.question-card,.lenormand,.dice-grid article';
    document.addEventListener('pointermove', (event) => {
      const card = event.target.closest(selector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      const scale = card.classList.contains('question-card') ? 1.002 : 1.01;
      card.style.transform = `perspective(1100px) rotateX(${-y * 3.8}deg) rotateY(${x * 4.8}deg) translateY(-3px) scale(${scale})`;
    }, { passive: true });
    document.addEventListener('pointerout', (event) => {
      const card = event.target.closest(selector);
      if (card && !card.contains(event.relatedTarget)) card.style.transform = '';
    });
  }

  function enableRipples() {
    document.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('.btn');
      if (!button || reducedMotion) return;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'pf-ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  function observeDynamicContent() {
    const observer = new MutationObserver(() => {
      addButtonIcons();
      document.querySelectorAll('.surface,.route-grid article,.question-card,.dice-grid article,.lenormand,.metric-grid article,.final-moment').forEach((item) => {
        if (!item.classList.contains('pf-reveal')) { item.classList.add('pf-reveal','pf-visible'); }
      });
      updateViewAccent();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function updateViewAccent() {
    const visible = document.querySelector('.view:not(.hidden)')?.id || 'view-home';
    const accents = {
      'view-home':['#a78bfa','#fb7185'], 'view-setup':['#67e8f9','#a78bfa'], 'view-session':['#fb7185','#a78bfa'],
      'view-map':['#86efac','#67e8f9'], 'view-chemistry':['#fb7185','#f5d08a'], 'view-tarot':['#a78bfa','#67e8f9'],
      'view-closing':['#f5d08a','#fb7185']
    };
    const [a,b] = accents[visible] || accents['view-home'];
    document.documentElement.style.setProperty('--pf-stage-a', a);
    document.documentElement.style.setProperty('--pf-stage-b', b);
    document.body.dataset.pfView = visible.replace('view-','');
  }

  function keyboardShortcuts() {
    const hint = document.createElement('div');
    hint.className = 'pf-command-hint';
    hint.textContent = 'Pressione / para conversar com a anfitriã';
    document.body.appendChild(hint);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        document.dispatchEvent(new CustomEvent('pf:open-agent'));
      }
      if (event.key === 'Escape') document.dispatchEvent(new CustomEvent('pf:close-agent'));
    });
  }

  function init() {
    loadStyles();
    document.body.dataset.design = 'v11';
    document.documentElement.dataset.design = 'v11';
    upgradeBrand();
    addHeroProof();
    addQualityStrip();
    addButtonIcons();
    addReveals();
    enablePointerGlow();
    enableTilt();
    enableRipples();
    keyboardShortcuts();
    observeDynamicContent();
    updateViewAccent();
    document.querySelectorAll('.hero .eyebrow').forEach((node) => { node.textContent = 'Primeira Faísca · Global Experience v11'; });
    const heroText = document.querySelector('.hero > p');
    if (heroText) heroText.textContent = 'Uma experiência editorial para casais: 96 cartas, leitura narrativa, inteligência privada e uma anfitriã que acompanha cada etapa.';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
