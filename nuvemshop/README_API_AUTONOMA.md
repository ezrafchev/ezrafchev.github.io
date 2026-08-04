# TRIDRA 3D — Automação Nuvemshop

Este diretório documenta a integração profissional com a loja oficial:

https://tridra3d.lojavirtualnuvem.com.br/

## Status

- Site institucional GitHub Pages atualizado para direcionar para a Nuvemshop oficial.
- Kit local gerado com produtos, categorias, CSV, assets e script de API.
- A API da Nuvemshop exige `store_id` e `access_token`; esses dados não devem ser publicados no GitHub.

## API

A API da Nuvemshop usa endpoints no formato:

```text
https://api.nuvemshop.com.br/v1/{store_id}
```

E cabeçalho:

```text
Authorization: Bearer ACCESS_TOKEN
```

## Segurança

Nunca publicar tokens, client_secret, dados bancários ou CPF/CNPJ em arquivos públicos.

## Próximo passo

Rodar localmente o kit `TRIDRA_Nuvemshop_API_Kit` com `.env` privado preenchido.