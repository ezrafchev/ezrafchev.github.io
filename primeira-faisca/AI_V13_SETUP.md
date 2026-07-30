# Primeira Faísca v13 — configuração dos motores

## 1. OpenAI GPT-5.6 pela API

O frontend nunca deve receber uma chave. Implante `api/openai-chat.js` em um backend serverless e configure:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-sol
OPENAI_ENABLE_WEB=false
ALLOWED_ORIGINS=https://ezrafchev.github.io
```

Modelos disponíveis no seletor:

- `gpt-5.6-sol`: máxima capacidade.
- `gpt-5.6-terra`: equilíbrio entre custo e qualidade.
- `gpt-5.6-luna`: menor custo e menor latência.

A eventual oferta de tokens diários gratuitos da API depende da elegibilidade exibida nas configurações de compartilhamento de dados da conta, exige saldo positivo e não deve ser tratada como garantida.

## 2. OpenAI gpt-oss local

O motor local recomendado é `gpt-oss:20b`. Os pesos são gratuitos e não há cobrança por token da API, mas o computador arca com memória, energia e processamento.

Dentro de `local-gpt-oss/`, siga o README para iniciar o runtime e o bridge local. O site usa por padrão:

```text
http://127.0.0.1:8787/v1/chat/completions
```

Marque **Usar gpt-oss também no Tarô, síntese e encerramento** para o roteador global interceptar as chamadas locais do aplicativo.

## 3. IA WebGPU no navegador

Permanece como fallback privado. Ela não exige backend, mas depende de navegador e GPU compatíveis. Modelos menores são menos capazes do que gpt-oss-20b e GPT-5.6.

## Ordem automática

1. OpenAI GPT-5.6, quando o endpoint seguro estiver configurado.
2. OpenAI gpt-oss local, quando o bridge estiver ativo.
3. IA WebGPU no navegador.
4. Erro técnico transparente — o sistema não finge que uma resposta fixa veio de uma IA avançada.