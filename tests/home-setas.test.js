/* Setas dos carrosséis da página inicial: as duas numa mini caixa,
   com nome acessível nos três idiomas, apontando para o trilho certo. */
const request = require("supertest");
const { app, resetDatabase, createServiceWithSlot } = require("./helpers");

beforeEach(resetDatabase);

const NOMES = {
  pt: ["Navegar pelas categorias", "Categoria anterior", "Próxima categoria", "Navegar pelos destinos", "Destinos anteriores", "Próximos destinos"],
  en: ["Browse categories", "Previous category", "Next category", "Browse destinations", "Previous destinations", "Next destinations"],
  es: ["Navegar por las categorías", "Categoría anterior", "Categoría siguiente", "Navegar por los destinos", "Destinos anteriores", "Próximos destinos"],
};

// Cada .slider-nav da página (os botões só têm o ícone dentro)
function caixas(html) {
  return html.match(/<div class="slider-nav[^"]*"[^>]*>[\s\S]*?<\/div>/g) || [];
}

describe("Setas dos carrosséis da home", () => {
  it("categorias e destinos têm cada um a sua caixa com as duas setas", async () => {
    await createServiceWithSlot();
    const res = await request(app).get("/").set("Cookie", "aquatrip_lang=pt");
    expect(res.status).toBe(200);
    const cx = caixas(res.text);
    expect(cx).toHaveLength(2);

    const [cats, dest] = cx;
    expect(cats).toContain('class="slider-nav cats-nav"');
    expect(cats).toContain('role="group"');
    expect(cats).toMatch(/<button class="slider-btn" type="button" id="catsPrev"[^>]*aria-controls="catsTrack"/);
    expect(cats).toMatch(/<button class="slider-btn" type="button" id="catsNext"[^>]*aria-controls="catsTrack"/);
    expect(dest).toMatch(/<button class="slider-btn" type="button" id="carPrev"[^>]*aria-controls="carousel"/);
    expect(dest).toMatch(/<button class="slider-btn" type="button" id="carNext"[^>]*aria-controls="carousel"/);

    // Os trilhos que as setas controlam existem na página
    expect(res.text).toContain('id="catsTrack"');
    expect(res.text).toContain('id="carousel"');
    // As setas antigas, soltas, saíram
    expect(res.text).not.toMatch(/class="icon-btn"[^>]*id="car(Prev|Next)"/);
  });

  it("sem destinos para mostrar, não sobram setas de destinos sem carrossel", async () => {
    const res = await request(app).get("/").set("Cookie", "aquatrip_lang=pt");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('id="carousel"');
    expect(res.text).not.toContain('id="carPrev"');
    expect(res.text).not.toContain('id="carNext"');
    // As categorias continuam com as setas
    expect(caixas(res.text)).toHaveLength(1);
    expect(res.text).toContain('id="catsNext"');
  });

  it.each(Object.keys(NOMES))("nomes acessíveis das setas em %s", async (lang) => {
    await createServiceWithSlot();
    const res = await request(app).get("/").set("Cookie", `aquatrip_lang=${lang}`);
    expect(res.status).toBe(200);
    const [grupoCats, antCats, proxCats, grupoDest, antDest, proxDest] = NOMES[lang];
    const [cats, dest] = caixas(res.text);
    expect(cats).toContain(`aria-label="${grupoCats}"`);
    expect(cats).toContain(`aria-label="${antCats}"`);
    expect(cats).toContain(`aria-label="${proxCats}"`);
    expect(dest).toContain(`aria-label="${grupoDest}"`);
    expect(dest).toContain(`aria-label="${antDest}"`);
    expect(dest).toContain(`aria-label="${proxDest}"`);
  });
});
