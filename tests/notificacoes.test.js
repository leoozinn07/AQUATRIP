/* ==============================================================
   Testes — e-mails reais (Brevo/SMTP) e avisos de reserva
   ============================================================== */
const crypto = require("crypto");
const { db, resetDatabase, createUser, createServiceWithSlot, loginAs, freshCsrf } = require("./helpers");
const mailService = require("../app/services/mailService");
const bookingService = require("../app/services/bookingService");

beforeEach(resetDatabase);

const ENV = ["MAIL_TRANSPORT", "BREVO_API_KEY", "SMTP_HOST", "MAIL_FROM", "CONTACT_INBOX"];
let guardado;
beforeEach(() => { guardado = Object.fromEntries(ENV.map((k) => [k, process.env[k]])); });
afterEach(() => {
  for (const [k, v] of Object.entries(guardado)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  jest.restoreAllMocks();
});

/** Espia os envios sem gravar arquivo; espera os avisos em segundo plano. */
function espiar() {
  return jest.spyOn(mailService, "send").mockResolvedValue({ status: "SENT" });
}
async function esperar(spy, n) {
  for (let i = 0; i < 100 && spy.mock.calls.length < n; i++) await new Promise((r) => setTimeout(r, 20));
  return spy.mock.calls.map((c) => c[0]);
}

describe("Transporte de e-mail", () => {
  it("escolhe pelo que está configurado: Brevo > SMTP > dev", () => {
    delete process.env.MAIL_TRANSPORT; delete process.env.BREVO_API_KEY; delete process.env.SMTP_HOST;
    expect(mailService.transportName()).toBe("dev");
    process.env.SMTP_HOST = "smtp.exemplo.com";
    expect(mailService.transportName()).toBe("smtp");
    process.env.BREVO_API_KEY = "xkeysib-teste";
    expect(mailService.transportName()).toBe("brevo");
    process.env.MAIL_TRANSPORT = "dev";
    expect(mailService.transportName()).toBe("dev");
  });

  it("Brevo: envia pela API HTTPS com a chave no cabeçalho e registra", async () => {
    process.env.MAIL_TRANSPORT = "brevo";
    process.env.BREVO_API_KEY = "xkeysib-teste";
    process.env.MAIL_FROM = "AquaTrip <oi@aquatrip.com.br>";
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ messageId: "x" }), { status: 201 }));

    await mailService.send({ to: "lia@exemplo.com", subject: "Oi", text: "texto", html: "<p>html</p>", template: "teste" });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(opcoes.method).toBe("POST");
    expect(opcoes.headers["api-key"]).toBe("xkeysib-teste");
    expect(JSON.parse(opcoes.body)).toEqual({
      sender: { name: "AquaTrip", email: "oi@aquatrip.com.br" },
      to: [{ email: "lia@exemplo.com" }],
      subject: "Oi", textContent: "texto", htmlContent: "<p>html</p>",
    });
    const { rows } = await db.query("SELECT status FROM email_log WHERE template = 'teste'");
    expect(rows[0].status).toBe("SENT");
  });

  it("Brevo: erro do provedor vira falha registrada, sem vazar a chave", async () => {
    process.env.MAIL_TRANSPORT = "brevo";
    process.env.BREVO_API_KEY = "xkeysib-secreta";
    jest.spyOn(global, "fetch").mockResolvedValue(new Response('{"message":"sender not verified"}', { status: 400 }));

    await expect(mailService.send({ to: "a@b.com", subject: "x", text: "y", template: "falha" })).rejects.toThrow(/400/);
    const { rows } = await db.query("SELECT status, error FROM email_log WHERE template = 'falha'");
    expect(rows[0].status).toBe("FAILED");
    expect(rows[0].error).toContain("sender not verified");
    expect(rows[0].error).not.toContain("xkeysib-secreta");
  });
});

describe("Avisos de reserva", () => {
  it("pagamento aprovado: comprovante para quem reservou; webhook repetido não reenvia", async () => {
    const spy = espiar();
    const user = await createUser({ email: "cliente@exemplo.com", name: "Lia Souza" });
    const { slot } = await createServiceWithSlot({ title: "Mergulho <b>Teste</b>", priceCents: 20000 });
    const booking = await bookingService.createBooking({ userId: user.id, slotId: slot.id, quantity: 2 });
    const { agent } = await loginAs(user);
    const csrf = await freshCsrf(agent, `/reservas/${booking.id}/checkout`);
    await agent.post(`/reservas/${booking.id}/pagar`).type("form")
      .send({ method: "CREDIT_CARD", cardLastFour: "4242", cardLength: 16, cardExpMonth: 12, cardExpYear: 2030, _csrf: csrf });

    const [msg] = await esperar(spy, 1);
    expect(msg.to).toBe("cliente@exemplo.com");
    expect(msg.template).toBe("reserva_confirmada");
    expect(msg.subject).toContain("Reserva confirmada");
    expect(msg.text).toMatch(/Código do ingresso: [0-9A-F]{3}-[0-9A-F]{4}/);
    expect(msg.text).toContain("Pessoas: 2");
    expect(msg.text).toContain("Pagamento de teste: nenhum valor real foi cobrado.");
    expect(msg.text).toContain(`/reservas/${booking.id}/comprovante`);
    // Título digitado vai escapado no HTML
    expect(msg.html).toContain("Mergulho &lt;b&gt;Teste&lt;/b&gt;");
    expect(msg.html).not.toContain("<b>Teste</b>");

    // O gateway manda o mesmo "aprovado" de novo: nenhum e-mail a mais
    const { rows } = await db.query("SELECT provider, provider_payment_id FROM payments WHERE booking_id = ?", [booking.id]);
    await bookingService.applyPaymentStatus({ provider: rows[0].provider, providerPaymentId: rows[0].provider_payment_id, status: "APPROVED" });
    await new Promise((r) => setTimeout(r, 150));
    expect(spy.mock.calls.filter((c) => c[0].template === "reserva_confirmada")).toHaveLength(1);
  });

  it("cancelar uma reserva paga avisa o estorno", async () => {
    const spy = espiar();
    const user = await createUser({ email: "estorno@exemplo.com" });
    const { slot } = await createServiceWithSlot({ priceCents: 15000 });
    const booking = await bookingService.createBooking({ userId: user.id, slotId: slot.id, quantity: 1 });
    const { agent } = await loginAs(user);
    let csrf = await freshCsrf(agent, `/reservas/${booking.id}/checkout`);
    await agent.post(`/reservas/${booking.id}/pagar`).type("form")
      .send({ method: "CREDIT_CARD", cardLastFour: "4242", cardLength: 16, cardExpMonth: 12, cardExpYear: 2030, _csrf: csrf });
    await esperar(spy, 1);
    csrf = await freshCsrf(agent, "/minhas-reservas");
    await agent.post(`/reservas/${booking.id}/cancelar`).type("form").send({ _csrf: csrf });

    const msgs = await esperar(spy, 2);
    const cancelada = msgs.find((m) => m.template === "reserva_cancelada");
    expect(cancelada.to).toBe("estorno@exemplo.com");
    expect(cancelada.text).toMatch(/foi estornado/);
    expect(cancelada.text).toContain("nenhum valor real foi cobrado");
  });

  it("viagem gratuita da comunidade: avisa quem vai e quem organiza, na confirmação e no cancelamento", async () => {
    const spy = espiar();
    const org = await createUser({ email: "organizadora@exemplo.com", name: "Bia Lima" });
    const cliente = await createUser({ email: "vai@exemplo.com", name: "Caio Reis" });
    const { service, slot } = await createServiceWithSlot({ slug: "trilha-gratis", priceCents: 0 });
    await db.query("UPDATE services SET creator_user_id = ? WHERE id = ?", [org.id, service.id]);

    const booking = await bookingService.createBooking({ userId: cliente.id, slotId: slot.id, quantity: 1 });
    expect(booking.status).toBe("CONFIRMED");
    let msgs = await esperar(spy, 2);
    const paraCliente = msgs.find((m) => m.template === "reserva_confirmada");
    const paraOrg = msgs.find((m) => m.template === "reserva_nova_organizador");
    expect(paraCliente.to).toBe("vai@exemplo.com");
    expect(paraCliente.text).toContain("Valor: Gratuita");
    expect(paraCliente.text).not.toContain("Pagamento de teste");
    expect(paraOrg.to).toBe("organizadora@exemplo.com");
    expect(paraOrg.text).toContain("Quem reservou: Caio Reis");

    await bookingService.cancelBooking({ bookingId: booking.id, user: { id: cliente.id, role: "USER" } });
    msgs = await esperar(spy, 4);
    expect(msgs.map((m) => m.template)).toEqual(expect.arrayContaining(["reserva_cancelada", "reserva_cancelada_organizador"]));
  });

  it("experiência do próprio AquaTrip avisa a caixa da equipe, se configurada", async () => {
    process.env.CONTACT_INBOX = "equipe@aquatrip.com.br";
    const spy = espiar();
    const cliente = await createUser({ email: "x" + crypto.randomUUID().slice(0, 6) + "@exemplo.com" });
    const { slot } = await createServiceWithSlot({ priceCents: 0 });
    await bookingService.createBooking({ userId: cliente.id, slotId: slot.id, quantity: 1 });
    const msgs = await esperar(spy, 2);
    expect(msgs.find((m) => m.template === "reserva_nova_organizador").to).toBe("equipe@aquatrip.com.br");
  });

  it("falha no envio não derruba a reserva", async () => {
    jest.spyOn(mailService, "send").mockRejectedValue(new Error("provedor fora"));
    const cliente = await createUser({ email: "resiste@exemplo.com" });
    const { slot } = await createServiceWithSlot({ priceCents: 0 });
    const booking = await bookingService.createBooking({ userId: cliente.id, slotId: slot.id, quantity: 1 });
    expect(booking.status).toBe("CONFIRMED");
    await new Promise((r) => setTimeout(r, 100));
    const { rows } = await db.query("SELECT status FROM bookings WHERE id = ?", [booking.id]);
    expect(rows[0].status).toBe("CONFIRMED");
  });
});

