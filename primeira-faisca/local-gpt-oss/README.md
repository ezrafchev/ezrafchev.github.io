# Engine Studio local — Primeira Faísca

Este bridge conecta o site público ao Ollama executado no próprio computador. Ele oferece:

- conversa com modelos locais sem cobrança por token de API;
- catálogo de modelos com download, atualização e remoção pela interface;
- streaming das respostas;
- cofre temporário para uma chave da OpenAI;
- acesso aos modelos GPT-5.6 e Chat Latest sem colocar a chave no GitHub ou no armazenamento do navegador.

## Requisitos

- Node.js 20 ou superior;
- Ollama instalado e em execução;
- espaço em disco e memória compatíveis com o modelo escolhido.

## Inicialização

Primeiro, inicie o Ollama. Não é mais obrigatório baixar um modelo pelo terminal: o site pode fazer isso pelo catálogo.

Em outro terminal, dentro desta pasta:

```bash
npm start
```

O bridge ficará em:

```text
http://127.0.0.1:8787
```

A rota de conversa local é:

```text
http://127.0.0.1:8787/v1/chat/completions
```

## Baixar modelos pelo site

1. Abra a Faísca AI.
2. Entre em **Configurações**.
3. Vá a **Modelos locais gratuitos · Download**.
4. Escolha o modelo.
5. Pressione **Baixar modelo**.
6. Aguarde a barra chegar a 100%.
7. Escolha o modelo em **Modelo ativo** e salve.

O catálogo inclui gpt-oss 20B e 120B, Qwen3 4B e 8B, Phi-4 Mini, Gemma 3 4B e Llama 3.2 3B.

## Conectar um token da OpenAI

1. Mantenha este bridge em execução.
2. Abra **OpenAI API · Token temporário** nas configurações da Faísca.
3. Cole a chave iniciada por `sk-`.
4. Pressione **Conectar token**.
5. Escolha GPT-5.6 Sol, Terra, Luna ou Chat Latest.

A chave:

- não é gravada no GitHub;
- não é salva em `localStorage` ou `sessionStorage`;
- fica somente na memória do processo Node.js;
- é apagada ao encerrar o bridge;
- pode ser removida pelo botão **Remover token**.

Para uso público ou multiusuário, prefira um backend remoto com a chave em variável de ambiente. O cofre local foi projetado para uso pessoal no próprio computador.

## Modelos e hardware

- `gpt-oss:20b`: download aproximado de 14 GB; cerca de 16 GB de memória é o ponto de partida prático.
- `gpt-oss:120b`: cerca de 65 GB; exige hardware de classe datacenter.
- `qwen3:8b`: cerca de 5,2 GB; boa qualidade com exigência intermediária.
- `qwen3:4b`: cerca de 2,5 GB; melhor opção para computadores médios.
- `phi4-mini`: cerca de 2,5 GB; alternativa compacta de raciocínio.
- `gemma3:4b`: cerca de 3,3 GB; modelo multilíngue.
- `llama3.2:3b`: cerca de 2 GB; opção mais leve.

## Variáveis opcionais

```text
PORT=8787
OLLAMA_BASE_URL=http://127.0.0.1:11434
LOCAL_MODEL=gpt-oss:20b
ALLOWED_ORIGIN=https://ezrafchev.github.io
OPENAI_API_KEY=opcional
```

Quando `OPENAI_API_KEY` é definida no ambiente, ela substitui o cofre temporário da interface e não pode ser removida pelo navegador.