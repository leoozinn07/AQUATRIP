/* ==============================================================
   AquaTrip · Home
   A vitrine usa os mesmos dados do catálogo: o que aparece no
   carrossel e no mapa é o que dá para reservar de verdade.
   ============================================================== */
const catalogRepository = require("../repositories/catalogRepository");
const { POR_CATEGORIA } = require("./catalogController");
const { COMISSAO_PADRAO } = require("../services/partnerService");
const { CAPAS } = require("../lib/catalogoOficial");

/* Ordem das categorias na home (slides horizontais). */
const ORDEM = ["mergulho", "praia", "aquario", "caiaque", "pesca", "expedicao"];

/* Aqua Score: perfil editorial da equipe AquaTrip para as
   experiências que ela mesma opera. Sem score, o cartão mostra
   quem organiza. Não é nota de cliente. */
const AQUA_SCORE = {
  "mergulho-noronha": [92, 96, 58],
  "caiaque-ilhabela": [64, 81, 89],
  "aquario-santos": [32, 70, 84],
  "pesca-rio-negro": [88, 93, 61],
};

/* Coordenadas reais das cidades onde há experiência. O mapa só
   marca o que está nesta lista; o que não estiver aparece na
   lista ao lado, sem pino. Posições já projetadas no SVG do Brasil
   (Mercator, viewBox 700x640), geradas a partir do Natural Earth. */
const LUGARES = {
  "Manaus, AM":                 { sub: "Rio Negro",          coord: "3°07′S 60°01′W",  xy: [238, 142] },
  "Fernando de Noronha, PE":    { sub: "Arquipélago",        coord: "3°51′S 32°25′W",  xy: [641, 153] },
  "Ubatuba, SP":                { sub: "Litoral norte",      coord: "23°26′S 45°05′W", xy: [456, 448] },
  "Ilhabela, SP":               { sub: "Litoral norte",      coord: "23°47′S 45°22′W", xy: [452, 454] },
  "Santos, SP":                 { sub: "Baixada Santista",   coord: "23°58′S 46°20′W", xy: [438, 457] },
  // Mesma projeção dos cinco acima (ajuste com erro de 1 px).
  "Barreirinhas, MA":           { sub: "Lençóis Maranhenses", coord: "2°45′S 42°50′W",  xy: [489, 137] },
  "Jijoca de Jericoacoara, CE": { sub: "Jericoacoara",        coord: "2°48′S 40°31′W",  xy: [523, 137] },
  "Parnaíba, PI":               { sub: "Delta do Parnaíba",   coord: "2°54′S 41°47′W",  xy: [504, 139] },
  "Barcelos, AM":               { sub: "Médio Rio Negro",     coord: "0°58′S 62°55′W",  xy: [196, 111] },
  "Santarém, PA":               { sub: "Alter do Chão",       coord: "2°30′S 54°57′W",  xy: [312, 133] },
  "Ipojuca, PE":                { sub: "Porto de Galinhas",   coord: "8°30′S 35°00′W",  xy: [603, 221] },
  "Maragogi, AL":               { sub: "Costa dos Corais",    coord: "9°01′S 35°13′W",  xy: [600, 229] },
  "Aracaju, SE":                { sub: "Orla de Atalaia",     coord: "10°57′S 37°04′W", xy: [573, 257] },
  "Mata de São João, BA":       { sub: "Praia do Forte",      coord: "12°35′S 38°00′W", xy: [560, 282] },
  "Caravelas, BA":              { sub: "Abrolhos",            coord: "17°44′S 39°16′W", xy: [541, 359] },
  "Corumbá, MS":                { sub: "Pantanal",            coord: "19°00′S 57°39′W", xy: [273, 379] },
  "Bonito, MS":                 { sub: "Serra da Bodoquena",  coord: "21°08′S 56°29′W", xy: [290, 412] },
  "Arraial do Cabo, RJ":        { sub: "Região dos Lagos",    coord: "22°58′S 42°02′W", xy: [501, 441] },
  "Angra dos Reis, RJ":         { sub: "Ilha Grande",         coord: "23°08′S 44°14′W", xy: [469, 444] },
  "Paraty, RJ":                 { sub: "Costa Verde",         coord: "23°13′S 44°43′W", xy: [462, 445] },
  "Cananéia, SP":               { sub: "Lagamar",             coord: "25°01′S 47°56′W", xy: [415, 474] },
  "Florianópolis, SC":          { sub: "Lagoa da Conceição",  coord: "27°36′S 48°28′W", xy: [407, 516] },
};

function capa(e) {
  if (e.cover_key) return { src: "/media/" + e.cover_key, alt: e.cover_alt || "" };
  if (CAPAS[e.slug]) return { ...CAPAS[e.slug] };
  const c = POR_CATEGORIA[e.category];
  return { src: c ? c.imagem : "/img/noronha-hero.webp", alt: "", ilustrativa: true };
}

async function index(req, res, next) {
  try {
    const [todas, contagem] = await Promise.all([
      catalogRepository.listAll(),
      catalogRepository.countByCategory(),
    ]);

    const destaques = todas.slice(0, 8).map((e) => ({
      ...e,
      capa: capa(e),
      score: AQUA_SCORE[e.slug] || null,
    }));

    const porLugar = new Map();
    todas.forEach((e) => {
      const nome = (e.location || "").trim();
      if (!nome) return;
      porLugar.set(nome, (porLugar.get(nome) || 0) + 1);
    });
    const lugares = [...porLugar.entries()]
      .map(([nome, n]) => ({ nome, n, ...(LUGARES[nome] || {}) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const categorias = ORDEM.map((k) => ({ chave: k, n: contagem[k] || 0, ...POR_CATEGORIA[k] }));

    res.render("pages/index", { destaques, lugares, categorias, total: todas.length, comissao: COMISSAO_PADRAO });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, AQUA_SCORE, capa };
