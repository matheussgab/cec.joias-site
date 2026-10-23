# C&C Joias

Vitrine online da C&C Joias. O cliente navega pelo catálogo, monta a sacola e envia o pedido pronto para o WhatsApp da loja. A equipe cadastra produtos, fotos e estoque em `/admin`.

## Estrutura

```
app/                 site (HTML, CSS e JS puros, sem build)
  index.html  style.css  script.js
  admin/             painel da loja
  assets/            imagens fixas (hero, editorial, ícone)
src/                 API em Node (node:http) + PostgreSQL
  server.js          rotas, arquivos estáticos, cabeçalhos de segurança
  catalog.js         GET /api/catalog: catálogo inteiro numa chamada, em cache até o painel mudar algo
  products.js        regras de cadastro (produtos, variações, estoque, fotos, lojas)
  auth.js            login do painel (scrypt, sessão em cookie httpOnly, limite de tentativas)
  images.js          fotos reconvertidas para WebP em 480/960/1600 px, sem EXIF
  migrations/        esquema do banco
scripts/             banco local, importação do mockup, criação de admin
deploy/              nginx, systemd e passo a passo de produção
mockup/              protótipo original aprovado pelo cliente (referência)
```

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run db:local            # terminal 1: Postgres local na porta 5433 (dados em .localdb/)
npm run migrate             # terminal 2
npm run seed                # importa os 21 produtos DEMONSTRATIVOS do mockup
npm run admin:create -- voce@ma24.com
npm run dev                 # http://localhost:3000  ·  painel em /admin
```

## Como o catálogo carrega

- A página faz **uma** chamada (`/api/catalog`, ~10 KB para 21 produtos, com ETag) e pagina no navegador, 12 peças por página.
- Só as fotos da página atual são baixadas. As da próxima página são pré-carregadas quando o cliente passa o mouse ou toca no número da página, ou quando chega ao fim do grid.
- A segunda foto do card só é baixada no hover.
- Links de produto (`/p/slug`) saem do servidor com as tags de prévia, para o WhatsApp mostrar foto, nome e preço.

## Segurança

- O navegador só fala com a API. O banco fica em outro servidor e só aceita conexão do IP do site ([deploy/README.md](deploy/README.md)).
- **Painel:**
  - senha com hash scrypt;
  - sessão em cookie `httpOnly` + `SameSite=Strict` (`Secure` em produção);
  - limite de 10 tentativas de login a cada 15 minutos por IP;
  - checagem de origem em toda alteração (CSRF).
- Preço e estoque sempre vêm do banco. O texto do pedido é montado no navegador, então **a loja confere os valores na conversa do WhatsApp**.
- **Fotos:** validadas e reconvertidas no servidor, com nome aleatório e sem metadados.
- **Cabeçalhos:** CSP restrita (só Google Fonts como origem externa), `nosniff`, sem iframe e HSTS no nginx.
- O banco tem que ser **UTF-8**. A migração se recusa a rodar em outra codificação.

## Decisões tomadas

- **Domínio:** subdomínio provisório `cecjoias.ma24.com`. Trocar em `.env` (`PUBLIC_URL`) e em `deploy/nginx.conf`.
- **Duas lojas, cada uma com estoque e sacola próprios.** Se uma loja for desativada no painel (aba Lojas), o seletor de loja some do site. Pelo menos uma loja sempre fica ativa.
- **Estoque:** o site mostra só "Disponível" ou "Esgotado", nunca a quantidade. A sacola não deixa passar do estoque da loja.
- **Preço:** o site mostra só o preço, sem Pix nem parcelamento. As condições são combinadas no WhatsApp.
- **Sem WhatsApp cadastrado,** a sacola oferece "Copiar mensagem do pedido" no lugar do botão de envio.
- **Layout:** o design segue a identidade do mockup aprovado pelo cliente e o grid de referência (flaviavasconcelos.com.br). Contexto de produto em [PRODUCT.md](PRODUCT.md).
- **Novidades:** não há seção separada, porque a coleção já abre ordenada por destaques e novidades.
- **Hero e editorial:** são imagens fixas em `app/assets/` e no `index.html`, fora do painel. As legendas do hero apontam para produtos pelo slug.

## Antes de ir ao ar

- [ ] **Dados reais no painel:** produtos, preços, estoque e descrições. Os 21 atuais são **demonstrativos** e vêm do mockup. Para começar do zero, não rode `npm run seed`.
- [ ] **Lojas:** WhatsApp, endereço, horário e Instagram de cada loja.
- [ ] **Loja 2:** nome e identidade, ou desativar.
- [ ] **Infraestrutura:** IPs dos dois servidores e o registro DNS em `ma24.com`.
- [ ] Seguir [deploy/README.md](deploy/README.md) e criar o administrador da loja com `npm run admin:create`.
- [ ] Confirmar com a loja as fotos do hero e do editorial (hoje são as do mockup).

## Verificado no desenvolvimento

- **Navegador** (Chrome, 1440 px e 390 px, sem erros de JS):
  - busca e filtros;
  - paginação e botão voltar;
  - pré-carregamento da próxima página;
  - troca de loja e limite de estoque na sacola;
  - link do WhatsApp com a mensagem do pedido;
  - página de produto inexistente.
- **API:**
  - recusa arquivo que não é imagem, preço inválido e SKU duplicado;
  - não deixa desativar todas as lojas;
  - bloqueia requisição sem origem ou de outro site;
  - não deixa escapar de pasta pelas URLs;
  - apaga os arquivos das fotos ao excluir um produto;
  - gera as tags de prévia em `/p/slug`.

Produção: veja [deploy/README.md](deploy/README.md).
