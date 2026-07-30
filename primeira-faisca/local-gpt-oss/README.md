# OpenAI gpt-oss local — Primeira Faísca

Este bridge conecta o site público ao modelo OpenAI gpt-oss executado no próprio computador. Nenhuma chave da API é necessária e não existe cobrança por token; o custo é o processamento local.

## Requisitos

- Node.js 20 ou superior.
- Runtime local compatível com API OpenAI, recomendado: Ollama.
- Para `gpt-oss:20b`, cerca de 16 GB de memória disponível é o ponto de partida prático.
- `gpt-oss:120b` exige hardware de classe datacenter.

## Inicialização

```bash
ollama pull gpt-oss:20b
ollama run gpt-oss:20b
```

Em outro terminal, dentro desta pasta:

```bash
npm start
```

O endpoint ficará em:

```text
http://127.0.0.1:8787/v1/chat/completions
```

No site, abra Faísca AI → Configurações → OpenAI local e pressione **Testar motor local**.

## Variáveis opcionais

```text
PORT=8787
OLLAMA_BASE_URL=http://127.0.0.1:11434
LOCAL_MODEL=gpt-oss:20b
ALLOWED_ORIGIN=https://ezrafchev.github.io
```