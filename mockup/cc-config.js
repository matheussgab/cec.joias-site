/* C&C Joias — configuração central (2 lojas). Produtos, preços e estoques: DEMONSTRATIVOS. */
window.CC_CONFIG = {
  brand: { name: 'C&C Joias', instagram: 'cec.joias' },
  stores: [
    { id: 'cec-joias', name: 'C&C Joias', short: 'C&C Joias', accent: '#A51C68', city: '', address: '', hours: '', whatsapp: '', instagram: 'cec.joias', photo: '', photoFile: 'loja-cec-fachada.jpg (4:3)', demo: false,
      intro: 'Joias, bolsas, relógios e acessórios escolhidos para quem valoriza o detalhe.', delivery: '' },
    { id: 'loja-2', name: 'Loja 2 — nome a confirmar', short: 'Loja 2', accent: '#1F6F78', city: '', address: '', hours: '', whatsapp: '', instagram: '', photo: '', photoFile: 'loja-2-fachada.jpg (4:3)', demo: true,
      intro: 'Conteúdo demonstrativo. Nome, identidade, contatos e catálogo da segunda loja serão configurados.', delivery: '' }
  ],
  // Carrossel da abertura (troca só manual). Envie os arquivos originais em alta resolução (mín. 1600 px no lado maior) para assets/cc/.
  // pos = ponto focal no computador; posMob = ponto focal no celular. Enquanto o arquivo não existir, aparece um espaço reservado com o nome.
  // Carrossel da abertura (troca só manual). pos = ponto focal no computador; posMob = no celular. pid = produto mostrado na foto (opcional).
  hero: { img: 'assets/cc/raw-05.jpg', pos: '50% 42%' }, // usado só pela versão anterior (CeC Joias.dc.html)
  heroSlides: [
    { img: 'assets/cc/pdf-05.jpg', pos: '50% 30%', posMob: '50% 28%', cap: 'Clutch croco prata com fecho dourado', alt: 'Modelo sentada segurando clutch prata de textura croco, com colar e brincos', pid: 'f4' },
    { img: 'assets/cc/pdf-01.jpg', pos: '50% 40%', posMob: '50% 35%', cap: 'Colar gravatinha · Nádia Gimenes', alt: 'Modelo de costas usando colar gravatinha de malha prateada', pid: 'f1' },
    { img: 'assets/cc/pdf-02.jpg', pos: '50% 55%', posMob: '50% 55%', cap: 'Bolsa croco vermelha com alça de corrente', alt: 'Modelo com bolsa vermelha de textura croco e alça de corrente dourada', pid: 'f3' },
    { img: 'assets/cc/pdf-13.jpg', pos: '50% 40%', posMob: '50% 40%', cap: 'Choker de pedras vermelhas', alt: 'Modelo sorrindo usando choker de pedras vermelhas com pingente', pid: 'f6' },
    { img: 'assets/cc/pdf-12.jpg', pos: '50% 45%', posMob: '50% 45%', cap: 'Anel com pedra turquesa', alt: 'Mão com anel de pedra turquesa junto à orelha com brinco', pid: 'f8' }
  ],
  editorial: { img: 'assets/cc/pdf-11.jpg', pos: '50% 40%', items: ['f8'] },
  categories: [
    { n: 'Colares', img: 'assets/cc/pdf-15.jpg', pos: '50% 45%' },
    { n: 'Brincos', img: 'assets/cc/pdf-10.jpg', pos: '45% 35%' },
    { n: 'Anéis', img: 'assets/cc/pdf-04.jpg', pos: '50% 45%' },
    { n: 'Bolsas e clutches', img: 'assets/cc/pdf-14.jpg', pos: '50% 50%' },
    { n: 'Relógios', img: 'assets/cc/raw-10.jpg', pos: '50% 45%' },
    { n: 'Smartwatches', img: 'assets/cc/raw-15.jpg', pos: '50% 50%' },
    { n: 'Correntes e pulseiras', img: 'assets/cc/raw-14.jpg', pos: '50% 50%' },
    { n: 'Carteiras', img: 'assets/cc/raw-02.jpg', pos: '50% 50%' }
  ],
  // material/finish: só preencher com informação confirmada. stock: por loja → variante → quantidade.
  products: [
    { id: 'f1', sku: 'CC-COL-001', brand: 'Nádia Gimenes', name: 'Colar Gravatinha', cat: 'Colares', price: 489, novo: true, destaque: true, imgs: [['assets/cc/pdf-03.jpg', '50% 40%'], ['assets/cc/pdf-15.jpg', '50% 40%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Colar em gravatinha com caimento fluido, do design de Nádia Gimenes.' },
    { id: 'f2', sku: 'CC-BRI-001', brand: 'Nádia Gimenes', name: 'Brincos com Correntes Fluidas', cat: 'Brincos', price: 259, novo: true, destaque: true, imgs: [['assets/cc/pdf-16.jpg', '45% 40%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 0 } }, desc: 'Brincos de correntes finas com movimento, do design de Nádia Gimenes.' },
    { id: 'f3', sku: 'CC-BOL-001', brand: '', name: 'Bolsa Croco Vermelha com Corrente', cat: 'Bolsas e clutches', price: 690, novo: true, destaque: true, imgs: [['assets/cc/pdf-02.jpg', '50% 60%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 1 } }, desc: 'Bolsa pequena de textura croco vermelha, alça de corrente dourada e fecho frontal.' },
    { id: 'f4', sku: 'CC-CLU-001', brand: '', name: 'Clutch Croco Prata', cat: 'Bolsas e clutches', price: 720, novo: true, destaque: true, imgs: [['assets/cc/pdf-05.jpg', '50% 70%'], ['assets/cc/pdf-06.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Clutch metalizada prata de textura croco com fecho frontal dourado.' },
    { id: 'f5', sku: 'CC-BOL-002', brand: '', name: 'Bolsa Croco Bege com Corrente', cat: 'Bolsas e clutches', price: 690, novo: true, destaque: true, imgs: [['assets/cc/pdf-14.jpg', '50% 55%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Bolsa pequena de textura croco bege com alça de corrente dourada.' },
    { id: 'f6', sku: 'CC-COL-002', brand: '', name: 'Choker de Pedras Vermelhas', cat: 'Colares', price: 359, novo: true, destaque: true, imgs: [['assets/cc/pdf-13.jpg', '50% 55%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 1 } }, desc: 'Choker de pedras vermelhas com pingente central.' },
    { id: 'f7', sku: 'CC-ANE-001', brand: '', name: 'Anel Solitário Oval', cat: 'Anéis', price: 219, novo: true, destaque: true, imgs: [['assets/cc/pdf-09.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 3 }, 'loja-2': { 'Única': 0 } }, desc: 'Anel com pedra incolor oval em destaque.' },
    { id: 'f8', sku: 'CC-ANE-002', brand: '', name: 'Anel com Pedra Turquesa', cat: 'Anéis', price: 249, novo: true, destaque: true, imgs: [['assets/cc/pdf-12.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Anel com pedra azul-turquesa arredondada.' },
    { id: 'f9', sku: 'CC-ANE-003', brand: '', name: 'Anel Dourado Geométrico', cat: 'Anéis', price: 269, novo: true, destaque: true, imgs: [['assets/cc/pdf-08.jpg', '55% 45%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Anel largo dourado de formato quadrado.' },
    { id: 'c1', sku: 'CC-REL-001', brand: 'Magnum', name: 'Relógio Magnum Mostrador Fibra de Carbono', cat: 'Relógios', price: 899, novo: true, imgs: [['assets/cc/raw-01.jpg', '50% 45%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Caixa redonda com mostrador preto texturizado e pulseira escura.' },
    { id: 'c2', sku: 'CC-REL-002', brand: '', name: 'Relógio Mostrador Azul-Gelo', cat: 'Relógios', price: 749, novo: true, imgs: [['assets/cc/raw-03.jpg', '50% 45%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 1 } }, desc: 'Mostrador azul-claro com calendário, luneta preta graduada e pulseira de elos.' },
    { id: 'c3', sku: 'CC-REL-003', brand: 'Orient', name: 'Relógio Orient Cronógrafo Pulseira Caramelo', cat: 'Relógios', price: 1190, imgs: [['assets/cc/raw-10.jpg', '50% 45%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 1 } }, desc: 'Cronógrafo com mostrador escuro, subdiscos e pulseira caramelo.' },
    { id: 'c4', sku: 'CC-REL-004', brand: 'Magnum', name: 'Relógio Magnum Cronógrafo Bicolor', cat: 'Relógios', price: 1090, novo: true, imgs: [['assets/cc/raw-12.jpg', '50% 50%'], ['assets/cc/raw-13.jpg', '50% 45%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Mostrador branco com subdiscos, caixa e pulseira em duas cores.' },
    { id: 'c5', sku: 'CC-REL-005', brand: '', name: 'Kit Relógio e Canivete', cat: 'Relógios', price: 520, imgs: [['assets/cc/raw-06.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 0 } }, desc: 'Relógio de mostrador preto com canivete, apresentados em caixa.' },
    { id: 'c6', sku: 'CC-SMW-001', brand: 'Lince', name: 'Smartwatch Lince', cat: 'Smartwatches', price: 459, novo: true, imgs: [['assets/cc/raw-16.jpg', '50% 45%'], ['assets/cc/raw-15.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 3 }, 'loja-2': { 'Única': 2 } }, desc: 'Smartwatch de tela retangular com pulseira preta.' },
    { id: 'c7', sku: 'CC-PUL-001', brand: '', name: 'Trio de Pulseiras Douradas', cat: 'Correntes e pulseiras', price: 389, imgs: [['assets/cc/raw-05.jpg', '50% 42%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Três pulseiras de elos na cor dourada. Material e banho a confirmar.' },
    { id: 'c8', sku: 'CC-COR-001', brand: '', name: 'Corrente Dourada Elos Grumet', cat: 'Correntes e pulseiras', price: 329, imgs: [['assets/cc/raw-14.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 1 } }, desc: 'Corrente de elos na cor dourada. Material, banho e comprimento a confirmar.' },
    { id: 'c9', sku: 'CC-COR-002', brand: '', name: 'Corrente Prateada Elos Finos', cat: 'Correntes e pulseiras', price: 279, novo: true, imgs: [['assets/cc/raw-11.jpg', '45% 55%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Corrente de elos finos na cor prateada. Material e comprimento a confirmar.' },
    { id: 'c10', sku: 'CC-CAR-001', brand: '', name: 'Carteira Preta Dobrável', cat: 'Carteiras', price: 189, imgs: [['assets/cc/raw-02.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 2 }, 'loja-2': { 'Única': 1 } }, desc: 'Carteira preta dobrável. Material a confirmar.' },
    { id: 'c11', sku: 'CC-CAR-002', brand: '', name: 'Porta-Cartões Preto com Vincos', cat: 'Carteiras', price: 139, imgs: [['assets/cc/raw-04.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 0 }, 'loja-2': { 'Única': 2 } }, desc: 'Porta-cartões preto com vincos em linhas paralelas. Material a confirmar.' },
    { id: 'c12', sku: 'CC-CAR-003', brand: '', name: 'Carteira Preta Texturizada', cat: 'Carteiras', price: 169, imgs: [['assets/cc/raw-07.jpg', '50% 50%']], variants: ['Única'], stock: { 'cec-joias': { 'Única': 1 }, 'loja-2': { 'Única': 0 } }, desc: 'Carteira preta com textura em relevo. Material a confirmar.' }
  ]
};
