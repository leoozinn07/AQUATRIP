/* ==============================================================
   Testes — favoritos (lista privada de experiências salvas)
   ============================================================== */
const request = require("supertest");
const { app, db, resetDatabase, createUser, createServiceWithSlot, loginAs } = require("./helpers");

beforeEach(resetDatabase);

async function favoritar(agent, csrf, id, favorito = true) {
  return agent.post(`/api/favoritos/${id}`).set("X-CSRF-Token", csrf).send({ favorito });
}

describe("Favoritos", () => {
  it("visitante: a API pede login e a página leva ao login", async () => {
    const { service } = await createServiceWithSlot();
    const api = await request(app).post(`/api/favoritos/${service.id}`).send({ favorito: true });
    expect(api.status).toBe(401);
    const pagina = await request(app).get("/favoritos");
    expect(pagina.status).toBe(302);
    expect(pagina.headers.location).toBe("/login?redirect=%2Ffavoritos");
  });

  it("visitante vê o botão nos cartões, marcado para ir ao login", async () => {
    await createServiceWithSlot();
    const res = await request(app).get("/reservar");
    expect(res.text).toMatch(/<button type="button" class="fav-btn" data-favorito="[0-9a-f-]{36}" aria-pressed="false"[\s\S]*?data-login>/);
  });

  it("salva, lista, marca os cartões e tira, sem duplicar", async () => {
    const { service } = await createServiceWithSlot({ title: "Mergulho de Teste Favorito" });
    const u = await createUser({ email: "fav@aquatrip.local" });
    const { agent, csrf } = await loginAs(u);

    let r = await favoritar(agent, csrf, service.id);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ favorito: true, total: 1 });
    r = await favoritar(agent, csrf, service.id); // duplo clique
    expect(r.body.total).toBe(1);

    const pagina = await agent.get("/favoritos");
    expect(pagina.status).toBe(200);
    expect(pagina.headers["x-robots-tag"]).toMatch(/noindex/);
    expect(pagina.text).toContain("Mergulho de Teste Favorito");
    expect(pagina.text).toContain(`data-favorito="${service.id}" aria-pressed="true"`);

    // O cartão do catálogo e a página da experiência já nascem marcados
    const catalogo = await agent.get("/reservar");
    expect(catalogo.text).toContain(`class="fav-btn is-on" data-favorito="${service.id}" aria-pressed="true"`);
    const exp = await agent.get(`/reservar/${service.slug}`);
    expect(exp.text).toMatch(new RegExp(`data-favorito="${service.id}" aria-pressed="true"`));

    r = await favoritar(agent, csrf, service.id, false);
    expect(r.body).toEqual({ favorito: false, total: 0 });
    const vazia = await agent.get("/favoritos");
    expect(vazia.text).not.toContain("Mergulho de Teste Favorito");
    expect(vazia.text).toMatch(/<div class="empty" id="favVazio">/);
  });

  it("a lista é de cada um: outra pessoa não vê os seus favoritos", async () => {
    const { service } = await createServiceWithSlot({ title: "Só Meu Favorito" });
    const a = await createUser({ email: "a@aquatrip.local" });
    const b = await createUser({ email: "b@aquatrip.local" });
    const sa = await loginAs(a);
    await favoritar(sa.agent, sa.csrf, service.id);
    const sb = await loginAs(b);
    const pagina = await sb.agent.get("/favoritos");
    expect(pagina.text).not.toContain("Só Meu Favorito");
  });

  it("recusa id inválido, corpo inválido, experiência fora do ar e pedido sem CSRF", async () => {
    const { service } = await createServiceWithSlot();
    const u = await createUser({ email: "val@aquatrip.local" });
    const { agent, csrf } = await loginAs(u);

    expect((await favoritar(agent, csrf, "nao-e-uuid")).status).toBe(400);
    const corpo = await agent.post(`/api/favoritos/${service.id}`).set("X-CSRF-Token", csrf).send({ favorito: "sim" });
    expect(corpo.status).toBe(422);
    const semCsrf = await agent.post(`/api/favoritos/${service.id}`).send({ favorito: true });
    expect(semCsrf.status).toBe(403);

    await db.query("UPDATE services SET active = 0 WHERE id = ?", [service.id]);
    expect((await favoritar(agent, csrf, service.id)).status).toBe(404);
  });

  it("experiência que sai do ar some da lista sem perder o favorito", async () => {
    const { service } = await createServiceWithSlot({ title: "Vai Sair do Ar" });
    const u = await createUser({ email: "sai@aquatrip.local" });
    const { agent, csrf } = await loginAs(u);
    await favoritar(agent, csrf, service.id);

    await db.query("UPDATE services SET active = 0 WHERE id = ?", [service.id]);
    expect((await agent.get("/favoritos")).text).not.toContain("Vai Sair do Ar");
    await db.query("UPDATE services SET active = 1 WHERE id = ?", [service.id]);
    expect((await agent.get("/favoritos")).text).toContain("Vai Sair do Ar");
  });
});
