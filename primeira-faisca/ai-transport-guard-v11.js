'use strict';

(() => {
  const upstream = window.fetch.bind(window);

  function dedupeMessages(messages) {
    if (!Array.isArray(messages)) return messages;
    const output = [];
    for (const item of messages) {
      const normalized = {
        ...item,
        content: typeof item?.content === 'string' ? item.content.trim() : item?.content
      };
      const previous = output.at(-1);
      if (
        previous &&
        previous.role === normalized.role &&
        typeof previous.content === 'string' &&
        previous.content === normalized.content
      ) continue;
      output.push(normalized);
    }
    return output;
  }

  window.fetch = async (input, init = {}) => {
    let nextInit = init;
    const url = typeof input === 'string' ? input : input?.url || '';

    if (init?.body && typeof init.body === 'string' && /openai|chat|agent/i.test(url)) {
      try {
        const payload = JSON.parse(init.body);
        if (Array.isArray(payload.messages)) payload.messages = dedupeMessages(payload.messages);
        nextInit = { ...init, body: JSON.stringify(payload) };
      } catch {}
    }

    try {
      return await upstream(input, nextInit);
    } catch (error) {
      if (/openai|chat|agent/i.test(url)) {
        throw new Error(error?.name === 'AbortError'
          ? 'O motor de IA demorou além do limite configurado.'
          : 'Não foi possível alcançar o motor de IA.');
      }
      throw error;
    }
  };
})();
