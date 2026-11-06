# TridraLab — Plataforma digital v2

Ambiente de produção: <https://tridralab-site.pages.dev/>

**Status:** vitrine e laboratório técnico operantes. O domínio `.com.br`, o e-mail e o fluxo de cobrança ainda não estão ativos.

## Entregas

- Interface editorial premium, adaptável a dispositivos móveis, com tema claro/escuro, navegação por teclado e busca rápida (Ctrl/⌘ + K).
- Catálogo **conceitual**, 9 coleções/possibilidades, filtros, busca, favoritos persistentes e modal de configuração de material/cor/quantidade.
- Lista de solicitações local, exportação TXT e botão copiar. **Não é checkout nem pedido confirmado**.
- PrintFit Lab: custo de filamento, energia, hora-máquina, mão de obra ativa, acabamento/embalagem, provisão de falhas, custos indiretos, margem-alvo e tributos/taxas incidentes sobre a receita. Exportação CSV e resumo.
- Leitura local de STL binário, STL ASCII e OBJ; metadados básicos de 3MF. Medidas presumem milímetros. Não é auditoria de geometria nem validador de impressão.
- PWA (manifest + service-worker), páginas de privacidade/termos, favicon e OG, segurança básica e proteção contra indexação antes do domínio próprio.
- Cloudflare Pages Functions em `/functions/api/status.js` e `/functions/api/checkout.js`, este último **deliberadamente bloqueado** até implantação de comércio real auditado.

## Fórmulas do simulador

```text
Filamento = massa (g) / 1000 × preço/kg
Energia = potência média (W) / 1000 × horas × tarifa/kWh
Máquina = custo horário da máquina × horas
Mão de obra = minutos ativos / 60 × custo horário de operador
Diretos = filamento + energia + máquina + mão de obra + acabamento/embalagem
Custo ajustado = (diretos / (1 - probabilidade de falha)) × (1 + indiretos %)
Preço de referência = custo ajustado / (1 - margem % - taxas de venda %)
```

Premissa: taxa de falha atua sobre o custo total de cada tentativa e o denominador modela tentativas independentes até obter uma peça boa. Para erros com recuperação parcial, estimar custos reais. A fórmula é conservadora em diversos casos, mas não é previsão de mercado. Inserir dados contábeis reais para tomar decisões.

## Publicação

- Fonte: repo `ezrafchev/ezrafchev.github.io`, branch `tridralab-bootstrap`.
- Pages: build command vazio, framework None, output `tridralab`, root padrão.
- O código de Functions fica em `functions/` na raiz do repositório e NÃO no diretório público `tridralab/`.
- Mantenha a ramificação `main` e os demais projetos intactos.

## Pendências para comércio real

1. Registrar `tridralab.com.br` em nome do titular correto e configurar nameservers fornecidos para a zona Cloudflare (não incluir senha em repositório).
2. Vincular domínio no Pages, validar HTTPS e alterar robots/meta noindex; atualizar Schema/OG URL.
3. Ativar caixa postal `esdra@tridralab.com.br` e DNS MX, SPF, DKIM, DMARC.
4. Definir SKUs reais, especificação da peça, estoque/capacidade, preços e tributação aprovados pelo proprietário. Não vender itens ilustrativos.
5. Configurar `MP_ACCESS_TOKEN` como segredo de ambiente no Cloudflare; nunca em Git ou JS cliente. Precisa integração de preferências Checkout Pro no servidor, webhook assinado, tabelas D1 para pedidos e eventos, idempotência, antifraude, gerenciamento de envios, atualização de status e política comercial completa.
6. **Não ativar** `CHECKOUT_ENABLED=true` ou `WEBHOOK_VERIFIED=true` antes de testar webhook, D1 e atendimento reais. Variáveis são gates, não substituem controles de backend.
7. Publicar contato validado, CNPJ/CPF conforme exigências, política de entrega, devolução e suporte ao consumidor; LGPD e termos legais revisados.
8. Upload persistente de modelos requer Cloudflare R2 (ou armazenamento equivalente), autenticação, restrições de arquivo, consentimento e antivírus/validação; nesta v2 o upload NÃO sai do navegador.

## Testes de aceitação

Use `python -m http.server 8000` dentro de `tridralab` e abra `http://localhost:8000`; Functions exigem ambiente Pages/Wrangler. Testes automatizados estão em `tests/` no pacote de entrega. Execute testes e confira console, acessibilidade e responsividade antes de publicar.
