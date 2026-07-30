const existing = document.querySelector('link[href*="hotfix-v14-1.css"]');
if (!existing) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'hotfix-v14-1.css?v=14.1';
  document.head.appendChild(link);
}
import('./hotfix-v14-1.js?v=14.1');
