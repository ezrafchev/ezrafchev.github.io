# TridraLab Studio 3.0 — plataforma de fabricação digital

**Ambiente publicado:** [tridralab-site.pages.dev](https://tridralab-site.pages.dev/) · Hospedagem Cloudflare Pages gratuita, com GitHub conectado na branch `tridralab-bootstrap` e saída em `tridralab/`.

## Escopo real implementado

| Módulo | Estado |
|---|---|
| Vitrine editorial premium, responsiva e com modo claro/escuro | Funcional |
| Catálogo de nove **projetos conceituais** para orçamento, filtros e personalização | Funcional; **sem estoque ou preço de venda** |
| Lista local de solicitações com exportação TXT | Funcional; **não envia pedidos** |
| **Brief Builder**: ficha imprimível HTML, JSON e cópia de resumo | Funcional, cliente preenche localmente; **não envia nem armazena dados em servidor** |
| **Material Intelligence**: orientação PETG, PLA, TPU, ASA | Funcional; regras heurísticas, não certificação de material |
| **PrintFit Lab**: custos, energia, risco, impostos, taxas, margem, lotes e preparação fixa | Funcional; estimativas a partir de parâmetros editáveis |
| **Batch Intelligence**: gráfico comparativo de custos por quantidade | Funcional; **não é proposta comercial** |
| STL/OBJ: leitura local de dimensões básicas, triângulos e volume condicional | Funcional; **não certifica malha** |
| **Model Viewer**: prévia 3D STL/OBJ, zoom, giro, arestas | Funcional; decimação de triângulos, representação aproximada |
| 3MF | Apenas identificação; **não há reconstrução de geometria 3MF** |
| PWA/Service Worker | Disponível, sujeito à compatibilidade do navegador |
| API pública `/api/status` | Funcional, com indicação de serviços indisponíveis |
| Endpoint de checkout | **Permanentemente bloqueado por chave de segurança no código até implementação e aprovação do backend** |

## Limitações e compromissos

1. **Não há checkout real, emissão de pedidos, pagamentos Pix/cartão ou conta de cliente nesta versão**. Qualquer pedido, valor ou prazo exige proposta comercial com validação técnica.
2. **Nenhum dado pessoal do Brief Builder ou modelo 3D é enviado ao servidor**. Lista de projetos fica em `localStorage` no dispositivo do usuário. Nome, e-mail, cidade e observações do Brief Builder não são persistidos e entram no arquivo apenas se o usuário mandar exportar.
3. A tabela de materiais é uma **heurística orientativa**, não ensaio de resistência ou garantia de aplicação. PETG/PLA/TPU/ASA são simulações, não inventário confirmado.
4. O visualizador 3D decima a geometria para desempenho; pode não representar todos os detalhes. A inspeção técnica requer ferramentas próprias para geometria, tolerâncias, fatiamento e fabricação.
5. O site contém `noindex,nofollow` intencionalmente até o registro e a confirmação do domínio próprio. Não remover antes de homologar o lançamento.

## Estrutura

- `tridralab/index.html`: landing page, catálogo, materiais, laboratório, preview, brief e FAQ.
- `tridralab/styles.css` e `tridralab/studio.css`: sistema visual responsivo e refinamento premium.
- `tridralab/catalog.js`: lista de modelos conceituais (dados sintéticos ilustrativos).
- `tridralab/lab.js`: motor determinístico de custos, inspecionador local de arquivos.
- `tridralab/model-viewer.js`: pré-visualizador 3D local STL/OBJ sem CDN.
- `tridralab/app.js`: catálogo, favoritos, cálculos, exportações e navegação.
- `tridralab/studio.js`: recomendador de materiais, cenários de lotes, ficha de projeto.
- `tridralab/service-worker.js`: cache da aplicação; recursos dinâmicos `/api/` excluídos.
- `functions/api/status.js`: verificação de recursos, sem expor segredos.
- `functions/api/checkout.js`: integração futura **fechada por padrão**.
- `tests/test_browser.py`: testes funcionais com Playwright sem dependências de frontend.
- `tests/validate_logic.mjs`, `tests/validate_checkout.mjs`, `tests/validate_release.py`: auditoria da lógica e dos arquivos.

## Testes

```bash
node tests/validate_logic.mjs
node tests/validate_checkout.mjs
python tests/validate_release.py
python tests/test_browser.py
```

Para o último teste, instale o Playwright e um Chromium compatível; o script define caminho do Chromium neste ambiente e injeta assets em `about:blank`, sem solicitar rede. Os testes automatizados verificam funcionalidades específicas, não substituem auditoria completa de acessibilidade, performance e segurança.

## Publicação

A Cloudflare Pages está conectada ao repositório `ezrafchev/ezrafchev.github.io`, branch `tridralab-bootstrap`, framework `None`, build command vazio, output `tridralab`. A publicação deve ocorrer após o commit. **Não alterar `main` nem projetos relacionados à RendaForge**.

O registro `tridralab.com.br` e a caixa postal `esdra@tridralab.com.br` dependem de domínio adquirido e validação de DNS; até sua ativação, usar `tridralab-site.pages.dev`.

## Próxima etapa empresarial

Separar projeto para repositório próprio, criar plataforma de pedidos com Cloudflare D1/objetos sob autenticação, política LGPD, painel interno com controle de papéis, catálogo e preços aprovados, emissão de ordens de produção, armazenamento seguro, limites de upload, geração real de orçamentos, pagamento com webhook verificado e idempotência. **Não habilitar comercialização nem cobrar clientes enquanto não estiver implementado e homologado.**
