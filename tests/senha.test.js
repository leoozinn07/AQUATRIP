/* ==============================================================
   Testes — regra de senha (cadastro, redefinição e troca no perfil)
   8+ caracteres com letra, número e caractere especial.
   ============================================================== */
const request = require("supertest");
const crypto = require("crypto");
const { app, db, resetDatabase, createUser, extractCsrf, loginAs } = require("./helpers");
const senha = require("../app/lib/senha");

beforeEach(resetDatabase);

describe("Regra de senha", () => {
  it("aponta exatamente o que falta", () => {
    expect(senha.faltando("abcd1234")).toEqual(["especial"]);
    expect(senha.faltando("abcdefg!")).toEqual(["numero"]);
    expect(senha.faltando("12345678!")).toEqual(["letra"]);
    expect(senha.faltando("Ab1!")).toEqual(["tamanho"]);
    expect(senha.faltando("Abcd123!")).toEqual([]);
    expect(senha.faltando("Ação 2026#")).toEqual([]); // acento e espaço valem
    expect(senha.faltando("abcd 1234")).toEqual(["especial"]); // espaço não é especial
  });

  async function cadastrar(s) {
    const agent = request.agent(app);
    const csrf = extractCsrf((await agent.get("/cadastro")).text);
    const email = `c${crypto.randomUUID().slice(0, 8)}@aquatrip.local`;
    const res = await agent.post("/cadastro").type("form")
      .send({ nome: "Pessoa Teste", email, senha: s, "confirma-senha": s, aceite: "on", _csrf: csrf });
    const { rows } = await db.query("SELECT 1 FROM users WHERE email = ?", [email]);
    // Erro volta por redirecionamento para o formulário, com a mensagem
    const pagina = res.status === 302 && res.headers.location.startsWith("/cadastro") ? await agent.get(res.headers.location) : res;
    return { res: pagina, criou: rows.length === 1 };
  }

  it("cadastro recusa senha sem caractere especial, sem número ou sem letra, e diz o motivo", async () => {
    let r = await cadastrar("abcd1234");
    expect(r.criou).toBe(false);
    expect(r.res.text).toContain("A senha precisa ter pelo menos um caractere especial");
    r = await cadastrar("abcdefg!");
    expect(r.criou).toBe(false);
    expect(r.res.text).toContain("A senha precisa ter pelo menos um número.");
    r = await cadastrar("12345678!");
    expect(r.criou).toBe(false);
    expect(r.res.text).toContain("A senha precisa ter pelo menos uma letra.");
  });

  it("cadastro aceita senha com letra, número e caractere especial", async () => {
    expect((await cadastrar("Mergulho2026!")).criou).toBe(true);
  });

  it("o formulário de cadastro mostra a lista de requisitos", async () => {
    const res = await request(app).get("/cadastro");
    for (const regra of ["tamanho", "letra", "numero", "especial"]) expect(res.text).toContain(`data-regra="${regra}"`);
    expect(res.text).toContain("Um caractere especial");
  });

  it("a mensagem chega traduzida em inglês", async () => {
    const agent = request.agent(app);
    const csrf = extractCsrf((await agent.get("/cadastro").set("Cookie", "aquatrip_lang=en")).text);
    const post = await agent.post("/cadastro").set("Cookie", "aquatrip_lang=en").type("form")
      .send({ nome: "Ana", email: "ana-en@aquatrip.local", senha: "abcd1234", "confirma-senha": "abcd1234", aceite: "on", _csrf: csrf });
    const res = await agent.get(post.headers.location).set("Cookie", "aquatrip_lang=en");
    expect(res.text).toContain("The password must have at least one special character");
  });

  it("troca de senha no perfil segue a mesma regra", async () => {
    const user = await createUser({ email: "troca@aquatrip.local", password: "SenhaAntiga123!" });
    const { agent, csrf } = await loginAs(user);
    const fraca = await agent.post("/api/conta/senha").set("X-CSRF-Token", csrf)
      .send({ senhaAtual: "SenhaAntiga123!", novaSenha: "semespecial1", confirmaSenha: "semespecial1" });
    expect(fraca.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(fraca.body)).toContain("caractere especial");
  });

  it("login de senha antiga, criada antes da regra, continua funcionando", async () => {
    const user = await createUser({ email: "antiga@aquatrip.local", password: "senhaantiga" });
    const { agent } = await loginAs(user);
    const res = await agent.get("/minhas-reservas");
    expect(res.status).toBe(200);
  });
});
