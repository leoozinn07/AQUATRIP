/* ==============================================================
   AquaTrip — Avisos de reserva por e-mail
   ==============================================================
   Quem reservou e quem organiza ficam sabendo, por e-mail, quando:
     - a reserva é confirmada (pagamento aprovado ou viagem gratuita)
     - a reserva é cancelada ou estornada
   Quem organiza = o parceiro dono da experiência, ou quem criou a
   viagem na comunidade. Experiência do próprio AquaTrip avisa a
   caixa da equipe (CONTACT_INBOX), se houver.

   Nunca derruba o fluxo que chamou: o pagamento já foi aplicado
   quando o aviso sai. Falha vira log (e linha FAILED em email_log).
   Pagamento simulado é dito com todas as letras no e-mail: nenhum
   valor real foi cobrado (PRODUCT.md, "Verdade antes de brilho").
   ============================================================== */
const db = require("../lib/db");
const fmt = require("../lib/datas");
const log = require("../lib/logger").forModule("notificacao");
const mailService = require("./mailService");
const { codigoIngresso } = require("../lib/ingresso");
const { base } = require("../middlewares/seo");

const { esc, layout } = mailService;

async function dados(bookingId) {
  const { rows } = await db.query(
    `SELECT b.id, b.status, b.quantity, b.amount_cents,
            s.starts_at, sv.title, sv.slug, sv.location,
            cli.name AS cliente_nome, cli.email AS cliente_email,
            COALESCE(pu.email, cr.email) AS org_email,
            COALESCE(pu.name, cr.name) AS org_nome,
            pa.id AS parceiro_id,
            (SELECT p.provider FROM payments p WHERE p.booking_id = b.id
              ORDER BY p.created_at DESC LIMIT 1) AS provedor
     FROM bookings b
     JOIN users cli ON cli.id = b.user_id
     JOIN service_slots s ON s.id = b.slot_id
     JOIN services sv ON sv.id = s.service_id
     LEFT JOIN partners pa ON pa.id = sv.partner_id
     LEFT JOIN users pu ON pu.id = pa.user_id
     LEFT JOIN users cr ON cr.id = sv.creator_user_id
     WHERE b.id = ?`,
    [bookingId]
  );
  return rows[0] || null;
}

function valor(d) {
  return d.amount_cents ? fmt.brl(d.amount_cents / 100, true) : "Gratuita";
}
function primeiroNome(nome) {
  return String(nome || "").split(" ")[0] || "Olá";
}
// O provedor "mock" é o simulador: nenhum dinheiro real se move.
function avisoTeste(d) {
  return d.amount_cents && d.provedor === "mock"
    ? "Pagamento de teste: nenhum valor real foi cobrado."
    : "";
}
function linhas(d) {
  return [
    ["Experiência", d.title],
    ["Quando", fmt.dataHoraExtenso(d.starts_at)],
    ["Local", d.location || "Brasil"],
    ["Pessoas", String(d.quantity)],
    ["Valor", valor(d)],
  ];
}
function tabela(pares) {
  return `<table style="border-collapse:collapse;margin:12px 0;font-size:14px">${pares
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5f7f99">${esc(k)}</td><td style="padding:4px 0;color:#f0f8ff">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}
function texto(pares) {
  return pares.map(([k, v]) => `${k}: ${v}`).join("\n");
}
function enviar(msg) {
  return mailService.send(msg).catch((err) => log.error({ err, template: msg.template }, "aviso não enviado"));
}
function caixaDaEquipe() {
  return (process.env.CONTACT_INBOX || "").trim() || null;
}

/** Reserva confirmada: comprovante para quem reservou, aviso para quem organiza. */
async function reservaConfirmada(bookingId) {
  const d = await dados(bookingId);
  if (!d) return;
  const codigo = codigoIngresso(d.id);
  const url = `${base()}/reservas/${encodeURIComponent(d.id)}/comprovante`;
  const pares = [...linhas(d), ["Código do ingresso", codigo]];
  const teste = avisoTeste(d);

  await enviar({
    to: d.cliente_email,
    template: "reserva_confirmada",
    subject: `Reserva confirmada: ${d.title} — AquaTrip`,
    text:
      `${primeiroNome(d.cliente_nome)}, sua reserva está confirmada.\n\n${texto(pares)}\n\n` +
      `Mostre o código do ingresso na chegada. Comprovante: ${url}` + (teste ? `\n\n${teste}` : ""),
    html: layout(
      "Reserva confirmada",
      `<p>${esc(primeiroNome(d.cliente_nome))}, sua reserva está confirmada.</p>${tabela(pares)}
       <p>Mostre o <strong>código do ingresso</strong> na chegada.</p>${teste ? `<p>${esc(teste)}</p>` : ""}`,
      { url, label: "Ver comprovante" }
    ),
  });

  const org = d.org_email || caixaDaEquipe();
  if (!org) return;
  const painel = d.parceiro_id ? `${base()}/parceiro` : `${base()}/reservar/${encodeURIComponent(d.slug)}`;
  const parOrg = [["Quem reservou", d.cliente_nome], ...pares];
  await enviar({
    to: org,
    template: "reserva_nova_organizador",
    subject: `Nova reserva: ${d.title} — AquaTrip`,
    text: `Nova reserva confirmada.\n\n${texto(parOrg)}\n\nConfira o código na chegada. ${painel}` + (teste ? `\n\n${teste}` : ""),
    html: layout(
      "Nova reserva confirmada",
      `<p>Chegou uma reserva para a sua experiência.</p>${tabela(parOrg)}
       <p>Na chegada, confira o código do ingresso.</p>${teste ? `<p>${esc(teste)}</p>` : ""}`,
      { url: painel, label: d.parceiro_id ? "Abrir painel do parceiro" : "Ver experiência" }
    ),
  });
}

/** Reserva cancelada (estornada ou não), para quem reservou e quem organiza. */
async function reservaCancelada(bookingId, { estornada = false } = {}) {
  const d = await dados(bookingId);
  if (!d) return;
  const pares = linhas(d);
  const teste = avisoTeste(d);
  const devolucao = estornada
    ? `O valor de ${valor(d)} foi estornado para a forma de pagamento usada.` + (teste ? ` ${teste}` : "")
    : "";

  await enviar({
    to: d.cliente_email,
    template: "reserva_cancelada",
    subject: `Reserva cancelada: ${d.title} — AquaTrip`,
    text: `${primeiroNome(d.cliente_nome)}, sua reserva foi cancelada.\n\n${texto(pares)}` + (devolucao ? `\n\n${devolucao}` : ""),
    html: layout(
      "Reserva cancelada",
      `<p>${esc(primeiroNome(d.cliente_nome))}, sua reserva foi cancelada.</p>${tabela(pares)}${devolucao ? `<p>${esc(devolucao)}</p>` : ""}`,
      { url: `${base()}/reservar`, label: "Ver outras experiências" }
    ),
  });

  const org = d.org_email || caixaDaEquipe();
  if (!org) return;
  const parOrg = [["Quem reservou", d.cliente_nome], ...pares];
  await enviar({
    to: org,
    template: "reserva_cancelada_organizador",
    subject: `Reserva cancelada: ${d.title} — AquaTrip`,
    text: `Uma reserva foi cancelada e a vaga voltou a ficar disponível.\n\n${texto(parOrg)}`,
    html: layout(
      "Reserva cancelada",
      `<p>Uma reserva foi cancelada e a vaga voltou a ficar disponível.</p>${tabela(parOrg)}`,
      null
    ),
  });
}

/** Dispara sem segurar quem chamou (pagamento, webhook, cancelamento). */
function emSegundoPlano(fn, ...args) {
  Promise.resolve()
    .then(() => fn(...args))
    .catch((err) => log.error({ err }, "falha ao preparar aviso de reserva"));
}

module.exports = {
  reservaConfirmada,
  reservaCancelada,
  avisarConfirmacao: (id) => emSegundoPlano(reservaConfirmada, id),
  avisarCancelamento: (id, opcoes) => emSegundoPlano(reservaCancelada, id, opcoes),
};
