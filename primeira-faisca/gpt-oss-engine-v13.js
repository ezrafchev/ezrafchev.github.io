'use strict';

(() => {
  const originalFetch = window.fetch.bind(window);
  const ENDPOINT_KEY = 'pf13_oss_endpoint';
  const MODEL_KEY = 'pf13_oss_model';
  const GLOBAL_KEY = 'pf13_oss_global';
  const DEFAULT_ENDPOINT = 'http://127.0.0.1:8787/v1/chat/completions';

  function enabled() { return localStorage.getItem(GLOBAL_KEY) === '1'; }
  function endpoint() { return (localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT).trim(); }
  function model() { return (localStorage.getItem(MODEL_KEY) || 'gpt-oss:20b').trim(); }
  function headersObject(headers) {
    const out = {};
    if (headers instanceof Headers) headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
    else Object.entries(headers || {}).forEach(([key, value]) => { out[String(key).toLowerCase()] = value; });
    return out;
  }
  function responseJson(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers:{ 'Content-Type':'application/json' } });
  }
  function geminiMessages(body) {
    const system = (body?.systemInstruction?.parts || []).map((part) => part.text || '').join('\n');
    const messages = [];
    if (system) messages.push({ role:'system', content:system });
    for (const item of body?.contents || []) {
      const role = item?.role === 'model' ? 'assistant' : 'user';
      const content = (item?.parts || []).map((part) => part.text || '').join('\n');
      if (content) messages.push({ role, content });
    }
    return messages;
  }
  async function callLocal(body) {
    const response = await originalFetch(endpoint(), {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        model:model(),
        messages:geminiMessages(body),
        temperature:Number(body?.generationConfig?.temperature ?? .55),
        top_p:Number(body?.generationConfig?.topP ?? .92),
        max_tokens:Math.min(Number(body?.generationConfig?.maxOutputTokens || 3200), 6000),
        stream:false,
        response_format:body?.generationConfig?.responseMimeType === 'application/json' ? { type:'json_object' } : undefined
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || data?.error || `Modelo local respondeu ${response.status}.`);
    const text = String(data?.choices?.[0]?.message?.content || data?.text || '').trim();
    if (!text) throw new Error('O modelo local não retornou texto.');
    return responseJson({ candidates:[{ content:{ parts:[{ text }] }, finishReason:'STOP' }], modelVersion:model() });
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const headers = headersObject(init.headers || input?.headers);
    const localRequest = url.includes('generativelanguage.googleapis.com') && (url.includes('/local-webllm') || /LOCAL_/i.test(headers['x-goog-api-key'] || ''));
    if (!enabled() || !localRequest) return originalFetch(input, init);

    if (url.includes('/v1beta/models') && !url.includes(':generateContent')) {
      return responseJson({ models:[{ name:'models/local-webllm', displayName:`Modelo local · ${model()}`, supportedGenerationMethods:['generateContent'] }] });
    }
    if (url.includes(':generateContent')) {
      try { return await callLocal(JSON.parse(init.body || '{}')); }
      catch (error) {
        console.warn('Modelo local indisponível; retornando ao motor WebGPU.', error);
        return originalFetch(input, init);
      }
    }
    return originalFetch(input, init);
  };
})();