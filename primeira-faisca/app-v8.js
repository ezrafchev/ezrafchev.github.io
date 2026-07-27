'use strict';

(async () => {
  const PARTS = ['00','01','02','03','04'];
  const GZIP_SHA256 = 'd1f11ed6ab0efd6d044e2e417d2e7b44b63e76f19b41311f9b6a038fb59450ac';
  const SOURCE_SHA256 = '143e04be38bf44535c78b6951ca5e80728615cb2f570a939c2bae2393d1f7776';

  function hex(buffer) {
    return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function fatal(message) {
    console.error('Primeira Faísca v8:', message);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;z-index:99999;background:#050506;color:#fff;display:grid;place-items:center;padding:28px;font-family:system-ui"><div style="max-width:620px;padding:28px;border:1px solid rgba(255,255,255,.15);border-radius:24px;background:#111114"><h2 style="margin-top:0">Não foi possível carregar a experiência</h2><p style="line-height:1.6;color:#c4c4cc">${String(message).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</p><button onclick="location.reload()" style="border:0;border-radius:14px;padding:13px 18px;font-weight:700;cursor:pointer">Atualizar página</button></div></div>`);
  }

  try {
    if (!window.crypto?.subtle) throw new Error('Este navegador não oferece verificação criptográfica.');
    if (typeof DecompressionStream === 'undefined') throw new Error('Atualize o navegador para carregar o motor v8.');

    const responses = await Promise.all(PARTS.map(part => fetch(`./v8/gzs-${part}.b64?v=8.0.1`, {cache:'no-store'})));
    const failed = responses.find(response => !response.ok);
    if (failed) throw new Error(`Um módulo não foi encontrado: HTTP ${failed.status}.`);

    const encoded = (await Promise.all(responses.map(response => response.text()))).join('').replace(/\s+/g, '');
    const binary = atob(encoded);
    const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
    const compressedHash = hex(await crypto.subtle.digest('SHA-256', compressed));
    if (compressedHash !== GZIP_SHA256) throw new Error('A integridade do pacote não corresponde à versão auditada.');

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const sourceBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const sourceHash = hex(await crypto.subtle.digest('SHA-256', sourceBytes));
    if (sourceHash !== SOURCE_SHA256) throw new Error('A integridade do motor descompactado não corresponde à versão auditada.');

    let source = new TextDecoder().decode(sourceBytes);
    source = source.replace("document.addEventListener('DOMContentLoaded',boot,{once:true});", "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();");

    const script = document.createElement('script');
    script.textContent = `${source}\n//# sourceURL=primeira-faisca-v8.js`;
    document.head.appendChild(script);
  } catch (error) {
    fatal(error?.message || 'Falha desconhecida durante o carregamento.');
  }
})();
