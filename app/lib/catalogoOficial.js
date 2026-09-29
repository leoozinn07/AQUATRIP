/* ==============================================================
   AquaTrip — Experiências operadas pelo próprio AquaTrip
   ==============================================================
   Fonte única do catálogo oficial: o seed (npm run db:seed:services)
   grava estas experiências no banco, e a capa estática de cada uma
   sai daqui (homeController.capa). Destinos reais do Brasil; preços,
   horários e roteiros são os do simulador (nenhum dinheiro real se
   move, ver PRODUCT.md).

   Capa: foto enviada pelo dono do projeto (database/fotos-exemplo),
   otimizada em app/public/img/experiencias/. Sem foto, o cartão usa a
   ilustração da categoria e avisa que é ilustrativa. Uma capa enviada
   pelo painel (cover_media_id) tem prioridade sobre esta.

   Horários: hora local do fuso de operação (OPERATION_TIMEZONE).
   ============================================================== */
const EXPERIENCIAS = [
  /* ---------- Já existiam ---------- */
  {
    slug: "mergulho-noronha", title: "Batismo de mergulho em Fernando de Noronha",
    location: "Fernando de Noronha, PE", category: "mergulho", price_cents: 65000, horarios: ["09:00", "14:00"],
    description: "Primeiro mergulho com cilindro, com instrutor ao lado o tempo todo, nas águas claras do arquipélago. Não precisa ter experiência: antes de entrar na água tem uma aula em terra. Cerca de 3 horas.",
  },
  {
    slug: "aquario-santos", title: "Visita ao Aquário de Santos",
    location: "Santos, SP", category: "aquario", price_cents: 6000, horarios: ["09:00", "14:00"],
    description: "Visita a um dos aquários mais antigos do país, na orla de Santos, com tanques de peixes, pinguins e lobos-marinhos. Cerca de 1h30.",
  },
  {
    slug: "caiaque-ilhabela", title: "Caiaque ao pôr do sol em Ilhabela",
    location: "Ilhabela, SP", category: "caiaque", price_cents: 9500, horarios: ["09:00", "14:00"],
    description: "Remada tranquila pelo canal de São Sebastião no fim da tarde, com parada para ver o sol se pôr atrás do continente. Caiaque, colete e instrução inclusos. Cerca de 2 horas.",
  },
  {
    slug: "pesca-rio-negro", title: "Pesca esportiva no Rio Negro",
    location: "Manaus, AM", category: "pesca", price_cents: 42000, horarios: ["09:00", "14:00"],
    description: "Pesca esportiva no sistema pesque e solte, com guia local e barco, nos igarapés do Rio Negro perto de Manaus. O tucunaré é o peixe mais procurado.",
  },

  /* ---------- Praias ---------- */
  {
    slug: "pedra-furada-jericoacoara", title: "Caminhada até a Pedra Furada, em Jericoacoara",
    location: "Jijoca de Jericoacoara, CE", category: "praia", price_cents: 9000, horarios: ["08:00", "15:30"],
    description: "Caminhada guiada pela praia e pelo Serrote até o arco de pedra mais conhecido de Jericoacoara. Leve água e protetor: o trajeto é ao sol. Cerca de 2h30.",
    capa: "pedra-furada-jericoacoara", capaAlt: "Arco de pedra da Pedra Furada sobre a areia, em Jericoacoara",
  },
  {
    slug: "barco-prainhas-arraial-do-cabo", title: "Passeio de barco pelas praias de Arraial do Cabo",
    location: "Arraial do Cabo, RJ", category: "praia", price_cents: 12000, horarios: ["09:00", "13:00"],
    description: "Barco com paradas para banho nas águas claras das Prainhas do Pontal do Atalaia e da Praia do Forno. Cerca de 3 horas.",
    capa: "barco-prainhas-arraial-do-cabo", capaAlt: "Praia de areia branca e mar azul-claro ao pé do morro, em Arraial do Cabo",
  },
  {
    slug: "jangada-piscinas-porto-de-galinhas", title: "Jangada às piscinas naturais de Porto de Galinhas",
    location: "Ipojuca, PE", category: "praia", price_cents: 6000, horarios: ["08:00", "10:00"], capacidade: 6,
    description: "Travessia curta de jangada até as piscinas naturais formadas pelos recifes, com os peixes nadando em volta. Cerca de 1 hora.",
    capa: "jangada-piscinas-porto-de-galinhas", capaAlt: "Peixes nadando na água rasa e transparente das piscinas naturais",
  },
  {
    slug: "piscinas-naturais-praia-do-forte", title: "Piscinas naturais da Praia do Forte",
    location: "Mata de São João, BA", category: "praia", price_cents: 11000, horarios: ["09:00"],
    description: "Manhã nas piscinas naturais da Praia do Forte, com máscara para ver os peixes de perto e tempo livre na vila. Cerca de 3 horas.",
    capa: "piscinas-naturais-praia-do-forte", capaAlt: "Piscinas naturais entre os recifes, com coqueiros ao fundo, na Praia do Forte",
  },
  {
    slug: "lagoa-azul-ilha-grande", title: "Lagoa Azul, na Ilha Grande",
    location: "Angra dos Reis, RJ", category: "praia", price_cents: 15000, horarios: ["10:00"],
    description: "Lancha pela costa da Ilha Grande com parada para snorkel na Lagoa Azul, de água verde-clara e cheia de peixes. Cerca de 5 horas.",
  },

  /* ---------- Mergulho ---------- */
  {
    slug: "batismo-mergulho-arraial-do-cabo", title: "Batismo de mergulho em Arraial do Cabo",
    location: "Arraial do Cabo, RJ", category: "mergulho", price_cents: 35000, horarios: ["08:30", "13:30"],
    description: "Mergulho com cilindro para iniciantes, com instrutor ao lado o tempo todo, numa das águas mais claras do Sudeste. Não precisa saber mergulhar, só nadar. Cerca de 3 horas.",
  },
  {
    slug: "snorkel-gales-de-maragogi", title: "Snorkel nas galés de Maragogi",
    location: "Maragogi, AL", category: "mergulho", price_cents: 16000, horarios: ["09:00"],
    description: "Catamarã até as galés, piscinas naturais formadas pelos recifes em alto-mar, para nadar de máscara e snorkel entre os peixes. Cerca de 3 horas.",
    capa: "snorkel-gales-de-maragogi", capaAlt: "Recifes e água verde-turquesa das galés de Maragogi vistos de cima",
  },
  {
    slug: "flutuacao-rio-sucuri-bonito", title: "Flutuação no Rio Sucuri, em Bonito",
    location: "Bonito, MS", category: "mergulho", price_cents: 29000, horarios: ["08:00", "13:00"],
    description: "Flutuação de máscara e snorkel num rio tão transparente que dá para ver o fundo e os peixes a metros de distância. Roupa de neoprene e colete inclusos. Cerca de 2h30.",
    capa: "flutuacao-rio-sucuri-bonito", capaAlt: "Pessoas flutuando num rio de água transparente entre a mata, em Bonito",
  },
  {
    slug: "mergulho-parque-marinho-abrolhos", title: "Mergulho no Parque Nacional Marinho dos Abrolhos",
    location: "Caravelas, BA", category: "mergulho", price_cents: 89000, horarios: ["06:30"], capacidade: 8,
    description: "Saída de barco de Caravelas até o primeiro parque nacional marinho do Brasil, com mergulho nos recifes de chapeirões. Para quem já tem certificação de mergulho. Dia inteiro.",
  },

  /* ---------- Caiaque ---------- */
  {
    slug: "caiaque-baia-de-paraty", title: "Caiaque pelas ilhas da Baía de Paraty",
    location: "Paraty, RJ", category: "caiaque", price_cents: 14000, horarios: ["09:00", "14:30"],
    description: "Remada pela baía de águas calmas, com paradas em ilhas e praias que só se alcançam pelo mar. Caiaque, colete e guia inclusos. Cerca de 3 horas.",
  },
  {
    slug: "caiaque-lagoa-da-conceicao", title: "Caiaque na Lagoa da Conceição",
    location: "Florianópolis, SC", category: "caiaque", price_cents: 9000, horarios: ["08:00", "16:00"],
    description: "Remada na lagoa mais conhecida de Florianópolis, com vista para as dunas e o morro e parada para banho. Bom para quem nunca remou. Cerca de 2 horas.",
  },

  /* ---------- Pesca ---------- */
  {
    slug: "pesca-rio-paraguai-pantanal", title: "Pesca esportiva no Rio Paraguai, no Pantanal",
    location: "Corumbá, MS", category: "pesca", price_cents: 52000, horarios: ["06:00"], capacidade: 4,
    description: "Pesca embarcada com piloteiro local no Rio Paraguai, no sistema pesque e solte, atrás de pintado, dourado e pacu. Equipamento e iscas inclusos. Dia inteiro.",
  },
  {
    slug: "pesca-robalo-cananeia", title: "Pesca de robalo no estuário de Cananéia",
    location: "Cananéia, SP", category: "pesca", price_cents: 38000, horarios: ["06:30"], capacidade: 4,
    description: "Pesca de barco pelos canais e manguezais do Lagamar, com guia local, no sistema pesque e solte. O robalo é o alvo principal. Cerca de 5 horas.",
  },

  /* ---------- Expedições ---------- */
  {
    slug: "lagoas-lencois-maranhenses", title: "Lagoas dos Lençóis Maranhenses de 4x4",
    location: "Barreirinhas, MA", category: "expedicao", price_cents: 18000, horarios: ["08:00", "14:00"],
    description: "Travessia de 4x4 até o Parque Nacional e caminhada pelas dunas até lagoas de água doce, como a Azul e a Bonita. As lagoas ficam mais cheias entre junho e setembro. Cerca de 4 horas.",
    capa: "lagoas-lencois-maranhenses", capaAlt: "Lagoa de água doce entre dunas brancas nos Lençóis Maranhenses",
  },
  {
    slug: "expedicao-arquipelago-de-mariua", title: "Expedição de barco pelo arquipélago de Mariuá",
    location: "Barcelos, AM", category: "expedicao", price_cents: 48000, horarios: ["07:00"], capacidade: 8,
    description: "Dia de barco pelo Rio Negro entre as ilhas de Mariuá, um dos maiores arquipélagos de rio do mundo, com parada em praias de areia branca. Dia inteiro.",
    capa: "expedicao-arquipelago-de-mariua", capaAlt: "Praia de areia branca de rio com a floresta ao fundo, em Barcelos",
  },
  {
    slug: "barco-alter-do-chao-tapajos", title: "Passeio de barco por Alter do Chão",
    location: "Santarém, PA", category: "expedicao", price_cents: 17000, horarios: ["09:00"],
    description: "Barco pelo Rio Tapajós até a Ilha do Amor e a Ponta do Cururu, praias de areia branca em água doce. As praias aparecem mais na seca, entre agosto e dezembro. Cerca de 5 horas.",
  },
  {
    slug: "barco-delta-do-parnaiba", title: "Passeio de barco pelo Delta do Parnaíba",
    location: "Parnaíba, PI", category: "expedicao", price_cents: 15000, horarios: ["08:00"],
    description: "Barco pelos igarapés e manguezais do único delta em mar aberto das Américas, com parada nas dunas e, no fim da tarde, a revoada dos guarás. Dia inteiro.",
  },

  /* ---------- Aquários ---------- */
  {
    slug: "aquario-de-ubatuba", title: "Visita ao Aquário de Ubatuba",
    location: "Ubatuba, SP", category: "aquario", price_cents: 7000, horarios: ["10:00", "14:00"], capacidade: 20,
    description: "Visita ao aquário da cidade, com tanques de peixes, raias e outras espécies do litoral paulista, e monitores que explicam cada ambiente. Cerca de 1h30.",
  },
  {
    slug: "oceanario-de-aracaju", title: "Visita ao Oceanário de Aracaju",
    location: "Aracaju, SE", category: "aquario", price_cents: 4000, horarios: ["10:00", "15:00"], capacidade: 20,
    description: "Visita ao oceanário do Projeto Tamar na Orla de Atalaia, com tartarugas marinhas e peixes do litoral nordestino. Cerca de 1 hora.",
  },
];

/** slug -> { src, alt } das capas estáticas. */
const CAPAS = Object.fromEntries(
  EXPERIENCIAS.filter((e) => e.capa).map((e) => [e.slug, { src: `/img/experiencias/${e.capa}.webp`, alt: e.capaAlt || "" }])
);

module.exports = { EXPERIENCIAS, CAPAS };
