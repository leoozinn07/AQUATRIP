/* ==============================================================
   Testes — catálogo oficial (app/lib/catalogoOficial.js)
   Confere os dados que o seed grava e que a vitrine usa: categorias
   válidas, slugs únicos, horários possíveis, capas que existem e
   todo destino com pino no mapa.
   ============================================================== */
const fs = require("fs");
const path = require("path");
const { EXPERIENCIAS, CAPAS } = require("../app/lib/catalogoOficial");
const { capa } = require("../app/controllers/homeController");
const fuso = require("../app/lib/fuso");

const CATEGORIAS = ["praia", "mergulho", "caiaque", "pesca", "expedicao", "aquario"];

describe("Catálogo oficial", () => {
  it("tem experiências nas seis categorias, com slugs únicos", () => {
    expect(EXPERIENCIAS.length).toBeGreaterThanOrEqual(20);
    const slugs = EXPERIENCIAS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATEGORIAS) {
      expect(EXPERIENCIAS.filter((e) => e.category === c).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("cada experiência tem dados que o banco aceita", () => {
    for (const e of EXPERIENCIAS) {
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(CATEGORIAS).toContain(e.category);
      expect(e.title.length).toBeLessThanOrEqual(200);
      expect(e.location).toMatch(/, [A-Z]{2}$/); // "Cidade, UF": só Brasil
      expect(Number.isInteger(e.price_cents) && e.price_cents > 0).toBe(true);
      expect(e.description.length).toBeGreaterThan(40);
      for (const h of e.horarios) expect(fuso.paraUtc("2026-10-15", h)).not.toBeNull();
    }
  });

  it("toda capa existe em app/public e vira a capa do cartão", () => {
    for (const [slug, c] of Object.entries(CAPAS)) {
      expect(fs.existsSync(path.join(__dirname, "..", "app", "public", c.src))).toBe(true);
      expect(c.alt.length).toBeGreaterThan(10);
      expect(capa({ slug, category: "praia" })).toEqual({ src: c.src, alt: c.alt });
    }
    // Capa enviada pelo painel continua tendo prioridade
    const [slug] = Object.keys(CAPAS);
    expect(capa({ slug, cover_key: "x.webp", category: "praia" }).src).toBe("/media/x.webp");
    // Sem capa: ilustração da categoria, marcada como ilustrativa
    expect(capa({ slug: "lagoa-azul-ilha-grande", category: "praia" }).ilustrativa).toBe(true);
  });

  it("todo destino do catálogo oficial tem pino no mapa da home", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "controllers", "homeController.js"), "utf8");
    for (const e of EXPERIENCIAS) expect(fonte).toContain(`"${e.location}":`);
  });
});
