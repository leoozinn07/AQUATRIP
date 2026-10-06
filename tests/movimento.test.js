/* ==============================================================
   Testes — animações: aparelho x Configurações > Animações
   O theme.js decide antes da primeira pintura se o movimento está
   liberado. Roda aqui num navegador de mentira (vm) para conferir a
   tabela inteira de decisões.
   ============================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const request = require("supertest");
const { app } = require("./helpers");

const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", "theme.js"), "utf8");

function rodar({ aparelhoReduz, preferencia }) {
  const attrs = {};
  const armazenado = preferencia ? { aquatrip_movimento: preferencia } : {};
  const window = {
    matchMedia: (q) => ({ matches: q.includes("reduce") ? aparelhoReduz : false, addEventListener() {} }),
  };
  const document = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, getAttribute: (k) => attrs[k] },
    addEventListener() {},
  };
  const localStorage = { getItem: (k) => (k in armazenado ? armazenado[k] : null), setItem() {}, removeItem() {} };
  vm.runInNewContext(fonte, { window, document, localStorage });
  return { attr: attrs["data-movimento"], ...window.AQ_MOVIMENTO };
}

describe("Animações: aparelho x escolha da pessoa", () => {
  it.each([
    // aparelho pede menos movimento?, escolha, resultado
    [false, null, "normal"],
    [true, null, "reduzido"],          // respeita o aparelho por padrão
    [true, "ligado", "normal"],        // "Sempre ligadas" vence o aparelho
    [false, "desligado", "reduzido"],  // "Sempre desligadas" desliga
    [true, "desligado", "reduzido"],
    [false, "qualquer-coisa", "normal"], // valor estranho = seguir o aparelho
  ])("aparelho reduz=%s, escolha=%s -> %s", (aparelhoReduz, preferencia, esperado) => {
    const r = rodar({ aparelhoReduz, preferencia });
    expect(r.attr).toBe(esperado);
    expect(r.reduzir).toBe(esperado === "reduzido");
    expect(r.sistemaReduz).toBe(aparelhoReduz);
  });

  it("abertura, água, bolhas, rolagem e transições leem a mesma decisão", () => {
    for (const arq of ["intro-gate", "home", "agua", "transicoes", "app-shell"]) {
      const js = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", arq + ".js"), "utf8");
      expect(js).toContain("AQ_MOVIMENTO");
    }
  });

  it("o CSS deixa 'Sempre ligadas' vencer o pedido do aparelho e 'Sempre desligadas' parar tudo", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "app", "public", "css", "design-system.css"), "utf8");
    expect(css).toContain('html:not([data-movimento="normal"]) *');
    expect(css).toMatch(/html\[data-movimento="reduzido"\] \*,[\s\S]*?animation-duration: \.01ms !important;/);
  });

  it("Configurações oferece a escolha e o diagnóstico nos três idiomas", async () => {
    const esperado = { pt: "Sempre ligadas", en: "Always on", es: "Siempre activadas" };
    for (const [lang, texto] of Object.entries(esperado)) {
      const res = await request(app).get("/configuracoes").set("Cookie", `aquatrip_lang=${lang}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain(texto);
      for (const v of ["sistema", "ligado", "desligado"]) expect(res.text).toContain(`data-movimento-set="${v}"`);
      expect(res.text).toContain('data-mov-estado="sistema-reduz"');
      expect(res.text).toContain("data-mov-webgl");
    }
  });
});
