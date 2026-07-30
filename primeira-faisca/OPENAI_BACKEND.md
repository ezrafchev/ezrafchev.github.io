# Primeira Faísca — backend seguro da OpenAI

O site público continua hospedado no GitHub Pages, mas uma chave da OpenAI **não pode** ser colocada no JavaScript do navegador. O endpoint incluído em `api/openai-chat.js` foi preparado para implantação serverless, com a chave armazenada somente como variável de ambiente.

## Opção recomendada: Vercel

1. Importe o repositório na Vercel.
2. Defina **Root Directory** como `primeira-faisca`.
3. Em **Environment Variables**, crie:

```text
OPENAI_API_KEY=sua_chave_secreta
OPENAI_MODEL=gpt-5-mini
ALLOWED_ORIGINS=https://ezrafchev.github.io
```

4. Faça o deploy.
5. O endpoint final normalmente será:

```text
https://SEU-PROJETO.vercel.app/api/openai-chat
```

6. Abra o Primeira Faísca, abra a conversa flutuante, entre em configurações e cole apenas o endereço do endpoint. **Não cole a chave da OpenAI no site.**

## Variáveis

- `OPENAI_API_KEY`: obrigatória e secreta.
- `OPENAI_MODEL`: opcional. O padrão do código é `gpt-5-mini`.
- `ALLOWED_ORIGINS`: lista separada por vírgulas de origens autorizadas.

Exemplo para domínio próprio e GitHub Pages:

```text
ALLOWED_ORIGINS=https://ezrafchev.github.io,https://primeirafaisca.com
```

## Proteções incluídas

- CORS limitado às origens configuradas;
- chave somente no servidor;
- `store: false` nas chamadas da Responses API;
- moderação de entrada com `omni-moderation-latest`;
- limite de mensagens e tamanho de contexto;
- timeout de 45 segundos;
- mensagens de erro sem devolver a chave;
- identificação do request para diagnóstico.

## Motores do agente flutuante

### Automático

1. tenta o endpoint seguro da OpenAI quando configurado;
2. usa a IA local quando ativada;
3. usa uma orientação básica contextual se nenhum modelo estiver disponível.

### Somente IA local

Não usa API externa, cobrança ou endpoint. Requer WebGPU e um modelo local ativado.

### Somente OpenAI

Exige o endpoint serverless. A interface nunca solicita nem armazena a chave da OpenAI.

## Segurança operacional

- Use uma chave de projeto separada para produção.
- Configure limites de gastos no projeto da OpenAI.
- Restrinja permissões da chave quando possível.
- Rotacione imediatamente qualquer chave que tenha sido publicada.
- Não envie arquivos `.env` ao GitHub.
- Mantenha `ALLOWED_ORIGINS` restrito aos domínios reais do projeto.

## Teste do endpoint

Depois do deploy, envie uma solicitação POST:

```json
{
  "messages": [
    {"role":"user","content":"Ajude o casal a conversar sobre a pergunta atual."}
  ],
  "context": "Etapa atual: Jornada de perguntas"
}
```

A resposta deve conter:

```json
{
  "text": "...",
  "response_id": "resp_...",
  "model": "gpt-5-mini"
}
```

O endpoint foi escrito para runtimes serverless compatíveis com a interface de funções da Vercel. O GitHub Pages continuará servindo apenas o frontend.
