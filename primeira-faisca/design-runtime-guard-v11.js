'use strict';

(() => {
  const ICON_STYLE_SIGNATURE = '.pf-btn-icon{display:inline-grid';

  function cleanDuplicateIconStyles() {
    const styles = [...document.head.querySelectorAll('style')]
      .filter((style) => String(style.textContent || '').includes(ICON_STYLE_SIGNATURE));
    styles.slice(1).forEach((style) => style.remove());
    if (styles[0]) styles[0].id = 'pfButtonIconStyle';
  }

  function capTransientElements() {
    const ripples = [...document.querySelectorAll('.pf-ripple')];
    ripples.slice(0, Math.max(0, ripples.length - 8)).forEach((node) => node.remove());
  }

  let scheduled = false;
  function scheduleCleanup() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      cleanDuplicateIconStyles();
      capTransientElements();
      scheduled = false;
    });
  }

  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleCleanup();
})();
