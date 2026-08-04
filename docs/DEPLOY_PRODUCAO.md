# Deploy de produção — TRIDRA

## Hospedagem atual

O site está publicado em GitHub Pages no endereço:

https://ezrafchev.github.io/

Essa versão é a vitrine estática hospedada pelo arquivo `index.html`.

## Aplicação completa

O repositório também contém uma aplicação Next.js preparada para Netlify.

## Variáveis obrigatórias na Netlify

Configure em Site configuration > Environment variables:

- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- MERCADO_PAGO_ACCESS_TOKEN
- MERCADO_PAGO_WEBHOOK_SECRET
- MELHOR_ENVIO_API_URL
- MELHOR_ENVIO_ACCESS_TOKEN
- TRIDRA_ORIGIN_POSTAL_CODE
- NEXT_PUBLIC_TRIDRA_WHATSAPP
- NEXT_PUBLIC_TRIDRA_EMAIL

## Supabase

1. Crie projeto no Supabase.
2. Ative confirmação de e-mail em Authentication.
3. Configure Site URL: `https://SEU-SITE.netlify.app`.
4. Configure Redirect URL: `https://SEU-SITE.netlify.app/auth/callback`.
5. Rode `docs/supabase_schema.sql` no SQL Editor.

## Mercado Pago

1. Crie aplicação Mercado Pago.
2. Pegue o Access Token de produção.
3. Configure webhook: `https://SEU-SITE.netlify.app/api/webhooks/mercadopago`.
4. Habilite Pix/cartões conforme sua conta.

## Melhor Envio

1. Gere token de API.
2. Configure CEP de origem da TRIDRA.
3. Insira `MELHOR_ENVIO_ACCESS_TOKEN` e `TRIDRA_ORIGIN_POSTAL_CODE` na Netlify.

## Segurança

Nunca coloque tokens reais no GitHub. Use somente variáveis protegidas da Netlify.
