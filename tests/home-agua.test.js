/* Água interativa na abertura: o WebGL em si é verificado no navegador
   (Playwright); aqui garantimos que o script entra só na home, é do
   próprio site (CSP) e respeita "reduzir movimento" e economia de dados. */
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("./helpers");

const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "public", "js", "agua.js"), "utf8");

describe("Água interativa da abertura", () => {
  it("a home carrega o script do próprio site, depois da foto do topo", async () => {
    const res = await request(app).get("/");
    expect(res.text).toContain('<script src="/js/agua.js" defer></script>');
    expect(res.text).toContain('id="heroImg"');
    expect(res.headers["content-security-policy"]).toMatch(/script-src 'self'(;|$)/);
    const catalogo = await request(app).get("/reservar");
    expect(catalogo.text).not.toContain("/js/agua.js");
  });

  it("desiste com reduzir movimento, economia de dados ou sem WebGL2", () => {
    expect(fonte).toMatch(/prefers-reduced-motion: reduce\)"\)\.matches\) return;/);
    expect(fonte).toMatch(/saveData\) return;/);
    expect(fonte).toMatch(/if \(!gl \|\| !gl\.getExtension\("EXT_color_buffer_float"\)\) return;/);
  });

  it("pausa fora da tela e com a aba escondida, e devolve a foto se o WebGL cair", () => {
    expect(fonte).toContain("IntersectionObserver");
    expect(fonte).toContain("visibilitychange");
    expect(fonte).toContain("webglcontextlost");
    expect(fonte).not.toMatch(/https?:\/\//); // nada de terceiros
  });
});
