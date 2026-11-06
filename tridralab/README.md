# TridraLab — plano de publicação auditável

## Estado confirmado em 06/11/2026
- O domínio `tridralab.com.br` teve disponibilidade confirmada no Registro.br, a R$ 40 no primeiro ano, mas **NÃO foi registrado**.
- Consultas NS/MX retornaram `NXDOMAIN`; ainda não há DNS nem caixa postal ativa.
- Esta ramificação **não está publicada** no domínio oficial.
- Site estático inicial isolado em `tridralab/`, incluindo 404, favicon, robots e headers.
- A sessão Registro.br de navegador não permaneceu autenticada após salvar; depende de novo login do titular.

## Publicar agora em Cloudflare Pages (sem domínio próprio inicialmente)

O plano de menor risco reutiliza o código **sem alterar a ramificação main**, pois este repositório já serve a outros projetos. Após entrar no painel Cloudflare:

1. **Workers & Pages → Create application → Pages → Connect to Git**.
2. Autorize acesso ao repositório **ezrafchev/ezrafchev.github.io** (apenas este repositório, se possível).
3. Crie um projeto novo chamado **tridralab-site**.
4. Escolha a ramificação de produção **tridralab-bootstrap**.
5. Framework preset: **None**; Build command: **vazio**; Build output directory: **tridralab**; Root directory (advanced): **deixar vazio/padrão**.
6. Confira o endereço `https://tridralab-site.pages.dev` apenas **se Cloudflare de fato atribuir esse endereço**. A URL final deve ser copiada do projeto, não presumida.
7. Depois do registro do domínio, adicione `tridralab.com.br` e `www.tridralab.com.br` em **Custom domains** do projeto.
8. No painel Cloudflare, cadastre `tridralab.com.br` como zona DNS gratuita. No Registro.br, altere os **nameservers somente para os valores exatos exibidos na sua zona Cloudflare**. Não copie nameservers genéricos.
9. Espere a validação do DNS/HTTPS. Defina a versão canônica, preferencialmente o domínio sem `www`.

**Atenção:** como se trata de um repositório com outros projetos, um repositório dedicado `tridralab-site` seria uma melhoria de isolamento no futuro. Não criar integração com o branch `main` existente e não modificar outro projeto.

## Caixa postal profissional: esdra@tridralab.com.br

1. Após comprovar a titularidade do domínio, abrir Zoho Mail e conferir se o plano gratuito com domínio próprio está disponível na sua região.
2. Configurar a organização, adicionar/verificar o domínio e criar o usuário `esdra` na organização.
3. Copiar os registros reais de verificação, **MX**, **SPF** e **DKIM** fornecidos pelo Zoho para **Cloudflare DNS**. Não inventar destinos nem selectors.
4. Publicar um único registro SPF que cubra os remetentes autorizados.
5. Configurar DMARC inicialmente com `p=none` e relatório, caso exista caixa adequada para receber o relatório; depois avaliar `quarantine` / `reject` com base em testes.
6. Enviar e receber mensagens de teste e verificar SPF/DKIM/DMARC via cabeçalhos.
7. Não misturar os MX do Zoho com o Cloudflare Email Routing.

## Checklist de lançamento
- [ ] Registro pago e domínio em titularidade correta
- [ ] Cloudflare Pages criado e publicado
- [ ] DNS e HTTPS válidos em domínio raiz e `www`
- [ ] Caixa postal criada e validada para envio/recebimento
- [ ] SPF, DKIM e DMARC confirmados
- [ ] Substituir no `index.html` a meta `noindex,nofollow` por política pública adequada
- [ ] Remover o `Disallow: /` do robots.txt depois do lançamento

**Não há API keys, senhas, CPF/CNPJ ou dados privados neste repositório.**
