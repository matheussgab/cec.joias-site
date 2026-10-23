# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vanilla HTML/CSS/JS sem build (`app/`), API Node com `node:http` (`src/`), PostgreSQL em servidor separado. Publicado sob o domínio da MA24 (subdomínio provisório `cecjoias.ma24.com`) atrás de nginx com HTTPS.

## Users

Clientes locais das lojas da C&C Joias: gente da cidade que conhece a loja pelo Instagram ou pela vitrine física, olha o catálogo no celular e fecha a compra conversando no WhatsApp (ou retira na loja). Secundário: a equipe da loja, que cadastra produtos, fotos e estoque pelo painel `/admin`.

## Product Purpose

Vitrine online do catálogo. Não há checkout: o cliente monta uma sacola e envia o pedido pronto para o WhatsApp da loja escolhida; disponibilidade, entrega e pagamento são confirmados no atendimento. Sucesso = o cliente encontra a peça, sente confiança e chega ao WhatsApp com o pedido claro.

## Positioning

Loja física de bairro com curadoria (joias, bolsas, relógios, acessórios) e atendimento de pessoa para pessoa; o site estende a vitrine, não substitui a conversa.

## Operating Context

- Navegação majoritariamente no celular, vinda do Instagram ou de um link de produto mandado no WhatsApp (prévia com foto, nome e preço).
- Duas lojas com estoque próprio; a segunda ainda não tem identidade definida e pode ficar desativada.
- Pedido sai como mensagem de WhatsApp com itens, SKU, quantidade, subtotal e links.

## Capabilities and Constraints

- Catálogo carregado numa única chamada (`/api/catalog`), paginado no cliente com páginas numeradas; fotos da próxima página pré-carregadas quando o cliente se aproxima do botão.
- Estoque exibido apenas como disponível / esgotado (sem quantidades).
- Preço exibido sem condições (sem Pix, sem parcelamento): condições são combinadas no WhatsApp.
- Sem cadastro de cliente, sem pagamento online, sem frete calculado.

## Brand Commitments

- Nome "C&C Joias", Instagram @cec.joias.
- Identidade aprovada pelo cliente no mockup (`mockup/`): azul-marinho #1B2348, magenta #A51C68, creme #F7F4EE; Bodoni Moda (títulos) + Manrope (texto).
- Referência de layout escolhida pelo cliente: flaviavasconcelos.com.br (grid limpo, seções com título e subtítulo, segunda foto no hover, paginação numerada).
- Voz: calorosa e direta, "atendimento de pessoa para pessoa". Textos aprovados no mockup podem ser reaproveitados.

## Evidence on Hand

- 29 fotos reais (editoriais com modelo e fotos de produto) em `mockup/assets/cc/`.
- Produtos, preços e estoques atuais são DEMONSTRATIVOS.
- Ausentes (não inventar): endereço, horários, WhatsApp, fotos das fachadas, dados da Loja 2, depoimentos, políticas de troca/envio.

## Product Principles

1. O WhatsApp é o caixa: todo caminho termina numa mensagem clara para a loja.
2. Rápido no celular antes de tudo; foto é o produto.
3. Nunca afirmar o que a loja não confirmou (material, banho, prazos, condições).
4. A equipe da loja precisa conseguir manter o catálogo sozinha.
