/* Transição cartão -> página da experiência. A animação em si é
   verificada no navegador (Playwright); aqui garantimos a ligação:
   CSS no <head> das páginas envolvidas, espera pela capa/grade antes
   da primeira pintura e o script cedo, sem defer. */
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app, resetDatabase, createServiceWithSlot } = require("./helpers");

beforeEach(resetDatabase);

function head(html) {
  return html.slice(0, html.indexOf("</head>"));
}

describe("Transição entre cartão e experiência", () => {
  it("lista e experiência carregam a transição no <head> e esperam o elemento certo", async () => {
    const { service } = await createServiceWithSlot();
    const casos = [
      ["/reservar", "#no-results"],
      ["/", "#destNota"],
      [`/reservar/${service.slug}`, "#xpHero"],
    ];
    for (const [url, alvo] of casos) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(head(res.text)).toContain('<link rel="stylesheet" href="/css/transicoes.css" />');
      expect(head(res.text)).toContain(`<link rel="expect" href="${alvo}" blocking="render">`);
      expect(res.text).toContain(`id="${alvo.slice(1)}"`);
      // Sem defer: o ouvinte de "pagereveal" precisa existir antes da 1ª pintura
      expect(res.text).toContain('<script src="/js/transicoes.js"></script>');
    }
  });

  it("o CSS só liga a transição sem 'reduzir movimento' e o script pula o resto", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "app", "public", "css", "transicoes.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}/);
    const js = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", "transicoes.js"), "utf8");
    expect(js).toContain("skipTransition()");
    expect(js).toContain('if (!("onpagereveal" in window)) return;');
  });
});
