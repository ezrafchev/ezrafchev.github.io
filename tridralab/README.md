# TridraLab — preparação da infraestrutura

Este diretório contém a página inicial estática da TridraLab, preparada em uma **ramificação isolada**, sem alterar a produção do repositório pessoal.

## Objetivo

- Domínio: tridralab.com.br — aguarda compra pelo titular no Registro.br.
- Hospedagem desejada: Cloudflare Pages, integrada a um novo repositório dedicado.
- Caixa postal desejada: esdra@tridralab.com.br (Zoho Mail; requer verificação do domínio).

## Implantação

1. Criar o repositório dedicado tridralab-site quando a autenticação do GitHub no navegador estiver disponível.
2. Migrar os arquivos desta pasta para a raiz do novo repositório.
3. Conectar o GitHub ao Cloudflare Pages (produção: main; build command vazio; output directory /).
4. Registrar o domínio no Registro.br, criar a zona Cloudflare e trocar nameservers para os valores exatos fornecidos.
5. Adicionar o domínio personalizado em Cloudflare Pages e configurar HTTPS.
6. Verificar o domínio no Zoho, criar a caixa postal e adicionar MX, SPF, DKIM e DMARC.
7. Testar o recebimento, envio e autenticação do e-mail.
8. Remover o noindex e atualizar robots.txt somente quando o domínio oficial estiver operacional.

Não foram incluídos números de DNS inventados, senhas ou informações privadas.
