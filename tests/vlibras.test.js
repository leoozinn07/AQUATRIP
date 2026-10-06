/* ==============================================================
   Testes — VLibras (tradução para Libras do Governo Federal)
   Só carrega para quem liga; sem a opção, nenhum script de terceiro
   e a CSP continua fechada em 'self'.
   ============================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const request = require("supertest");
const { app, extractCsrf } = require("./helpers");

function csp(res) {
  return String(res.headers["content-security-policy"] || "");
}
function diretiva(res, nome) {
  return csp(res).split(";").map((d) => d.trim()).find((d) => d.startsWith(nome + " ")) || "";
}

describe("VLibras", () => {
  it("desligado por padrão: sem script do gov.br e CSP só com 'self'", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("vlibras.gov.br");
    expect(res.text).not.toContain("<div vw");
    expect(diretiva(res, "script-src")).toBe("script-src 'self'");
    expect(csp(res)).not.toContain("frame-src");
    // O botão de ligar está no cabeçalho, como formulário (funciona sem JS)
    expect(res.text).toMatch(/<form class="libras-form" action="\/configuracoes\/libras" method="POST">[\s\S]*?name="ligar" value="1"/);
    expect(res.text).toContain('aria-label="Ativar tradução para Libras (VLibras)"');
  });

  it("ligar grava o cookie e volta para a página; a página passa a carregar o VLibras", async () => {
    const agent = request.agent(app);
    const pagina = await agent.get("/configuracoes");
    const csrf = extractCsrf(pagina.text);
    const r = await agent.post("/configuracoes/libras").type("form").send({ ligar: "1", redirect: "/reservar", _csrf: csrf });
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe("/reservar");
    const cookie = r.headers["set-cookie"].find((c) => c.startsWith("aquatrip_libras="));
    expect(cookie).toMatch(/^aquatrip_libras=1;/);
    expect(cookie).toMatch(/HttpOnly/i);

    const res = await agent.get("/reservar");
    expect(res.text).toContain('<script src="https://vlibras.gov.br/app/vlibras-plugin.js" defer></script>');
    expect(res.text).toContain('<script src="/js/vlibras.js" defer></script>');
    expect(res.text).toContain('<div vw class="enabled">');
    expect(res.text).toMatch(/name="ligar" value="0"[\s\S]*?aria-pressed="true"/);
    const script = diretiva(res, "script-src");
    expect(script).toContain("https://vlibras.gov.br");
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(diretiva(res, "connect-src")).toContain("https://*.vlibras.gov.br");
    // O avatar da versão atual (7.x) fica num iframe de vlibras.gov.br/app/unity:
    // sem frame-src, a CSP caía no default-src 'self' e o avatar não aparecia
    expect(diretiva(res, "frame-src")).toBe("frame-src 'self' https://vlibras.gov.br https://*.vlibras.gov.br");
    // Nada além do VLibras entra na CSP
    expect(csp(res)).not.toMatch(/https:\/\/(?!vlibras\.gov\.br|\*\.vlibras\.gov\.br)[^\s;]+/);

    // Desligar volta ao site sem terceiros
    const csrf2 = extractCsrf(res.text);
    await agent.post("/configuracoes/libras").type("form").send({ ligar: "0", redirect: "/", _csrf: csrf2 });
    const depois = await agent.get("/");
    expect(depois.text).not.toContain("vlibras.gov.br");
    expect(diretiva(depois, "script-src")).toBe("script-src 'self'");
  });

  it("não aceita redirecionamento para fora do site nem pedido sem CSRF", async () => {
    const agent = request.agent(app);
    const csrf = extractCsrf((await agent.get("/configuracoes")).text);
    const fora = await agent.post("/configuracoes/libras").type("form").send({ ligar: "1", redirect: "//exemplo.com", _csrf: csrf });
    expect(fora.headers.location).toBe("/configuracoes");
    const semCsrf = await request(app).post("/configuracoes/libras").type("form").send({ ligar: "1" });
    expect(semCsrf.status).toBe(403);
  });

  it("a opção aparece em Configurações nos três idiomas", async () => {
    const esperado = { pt: "Ativar Libras", en: "Turn on Libras", es: "Activar Libras" };
    for (const [lang, texto] of Object.entries(esperado)) {
      const res = await request(app).get("/configuracoes").set("Cookie", `aquatrip_lang=${lang}`);
      expect(res.text).toContain(texto);
    }
  });

  it("ao ligar a opção, o painel do VLibras abre sozinho na página seguinte (uma vez)", () => {
    const codigo = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", "vlibras.js"), "utf8");
    function rodar(marcado) {
      const guardado = new Map(marcado ? [["aquatrip_libras_abrir", "1"]] : []);
      const chamadas = { widget: [], open: 0 };
      const window = {
        VLibras: { Widget: function (raiz) { chamadas.widget.push(raiz); window.VLibrasWidget = { open: () => { chamadas.open++; } }; } },
      };
      const sessionStorage = {
        getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
        removeItem: (k) => guardado.delete(k),
      };
      vm.runInNewContext(codigo, { window, sessionStorage });
      return { ...chamadas, sobrou: guardado.has("aquatrip_libras_abrir") };
    }
    expect(rodar(true)).toEqual({ widget: ["https://vlibras.gov.br/app"], open: 1, sobrou: false });
    expect(rodar(false)).toEqual({ widget: ["https://vlibras.gov.br/app"], open: 0, sobrou: false });

    // Quem marca o pedido é o envio do formulário de LIGAR (cabeçalho ou Configurações)
    const shell = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", "app-shell.js"), "utf8");
    expect(shell).toContain(`form.matches('form[action="/configuracoes/libras"]')`);
    expect(shell).toContain("form.elements.ligar.value !== '1'");
    expect(shell).toContain("sessionStorage.setItem('aquatrip_libras_abrir', '1')");
  });
});
