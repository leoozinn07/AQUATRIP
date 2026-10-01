/* ==============================================================
   AquaTrip — Serviço de e-mail
   ==============================================================
   Mesma estratégia do gateway de pagamento: uma fronteira só, para
   trocar de provedor sem mexer no resto do sistema.

   Transportes (MAIL_TRANSPORT):
     brevo  envio real pela API HTTPS da Brevo (BREVO_API_KEY). Funciona
            em qualquer hospedagem: usa a porta 443, a mesma do site. É
            o caminho no Railway, que bloqueia SMTP nos planos menores.
     smtp   envio real por SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER,
            SMTP_PASS), para servidor próprio/VPS.
     dev    grava o e-mail em ./tmp/emails/ e não envia nada. Padrão
            sem configuração: dá para testar o fluxo inteiro (inclusive
            o link com token) sem mandar e-mail para endereço real.
   Vazio = escolhe pelo que estiver configurado (Brevo > SMTP > dev).

   MAIL_FROM: remetente, "Nome <email>". Na Brevo, o e-mail precisa
   estar verificado como remetente na conta.
   ============================================================== */
const fs = require("fs");
const log = require("../lib/logger").forModule("email");
const path = require("path");
const db = require("../lib/db");
const fmt = require("../lib/datas");

const MAIL_DIR = path.join(process.cwd(), "tmp", "emails");

function transportName() {
  const explicit = (process.env.MAIL_TRANSPORT || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.BREVO_API_KEY) return "brevo";
  return process.env.SMTP_HOST ? "smtp" : "dev";
}

/** "AquaTrip <oi@site.com>" -> { name, email } */
function remetente() {
  const bruto = fromAddress();
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(bruto);
  return m ? { name: m[1].trim() || "AquaTrip", email: m[2].trim() } : { name: "AquaTrip", email: bruto.trim() };
}

/** Texto do usuário dentro do HTML do e-mail (título, nome) sempre escapado. */
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fromAddress() {
  return process.env.MAIL_FROM || "AquaTrip <nao-responda@aquatrip.local>";
}

/** Escreve o e-mail em disco — o "provedor" do ambiente de dev. */
async function sendViaDev({ to, subject, text, html, template }) {
  fs.mkdirSync(MAIL_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(MAIL_DIR, `${stamp}_${template || "email"}.txt`);

  const conteudo = [
    `De:      ${fromAddress()}`,
    `Para:    ${to}`,
    `Assunto: ${subject}`,
    `Data:    ${fmt.dataHora(new Date())}`,
    "",
    "--- TEXTO ---",
    text || "",
    "",
    "--- HTML ---",
    html || "",
    "",
  ].join("\n");

  fs.writeFileSync(file, conteudo, "utf8");

  if (process.env.NODE_ENV !== "test") {
    log.info(`\n[mail] (modo dev, nada foi enviado de verdade)`);
    log.info(`para: ${to} | assunto: ${subject}`);
    log.info(`arquivo: ${file}\n`);
  }

  return { file };
}

/** Envio real pela API HTTPS da Brevo (porta 443). */
async function sendViaBrevo({ to, subject, text, html }) {
  const chave = process.env.BREVO_API_KEY;
  if (!chave) throw new Error("[mail] MAIL_TRANSPORT=brevo exige BREVO_API_KEY no .env.");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": chave },
    body: JSON.stringify({
      sender: remetente(),
      to: [{ email: to }],
      subject,
      textContent: text || undefined,
      htmlContent: html || undefined,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    // Corpo do erro da Brevo é curto e não contém a chave
    const detalhe = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`[mail] Brevo respondeu ${res.status}: ${detalhe}`);
  }
  return res.json().catch(() => ({}));
}

/** Envio real por SMTP (nodemailer). A conexão é reaproveitada. */
let transportadorSmtp = null;
function smtp() {
  if (!transportadorSmtp) {
    const nodemailer = require("nodemailer");
    const porta = Number(process.env.SMTP_PORT || 587);
    transportadorSmtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: porta === 465,
      requireTLS: porta !== 465, // 587: STARTTLS obrigatório, senha nunca em texto puro
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  return transportadorSmtp;
}
async function sendViaSmtp({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) throw new Error("[mail] MAIL_TRANSPORT=smtp exige SMTP_HOST no .env.");
  return smtp().sendMail({ from: fromAddress(), to, subject, text, html });
}

/**
 * Envia e registra. Uma falha de envio NÃO derruba o fluxo que a
 * originou: quem chama decide o que fazer, e o usuário recebe uma
 * mensagem genérica de qualquer forma (ver authController).
 */
async function send({ to, subject, text, html, template = null }) {
  const transporte = transportName();
  let status = "SENT";
  let erro = null;

  try {
    if (transporte === "brevo") {
      await sendViaBrevo({ to, subject, text, html });
    } else if (transporte === "smtp") {
      await sendViaSmtp({ to, subject, text, html });
    } else {
      await sendViaDev({ to, subject, text, html, template });
    }
  } catch (err) {
    status = "FAILED";
    erro = err.message;
    log.error({ err }, "falha ao enviar");
  }

  try {
    await db.query(
      `INSERT INTO email_log (to_address, subject, template, status, error)
       VALUES (?, ?, ?, ?, ?)`,
      [to, subject, template, status, erro]
    );
  } catch (err) {
    log.error({ err }, "falha ao registrar envio");
  }

  if (status === "FAILED") throw new Error(erro);
  return { status };
}

/* ==============================================================
   Templates
   ============================================================== */

function layout(titulo, corpo, cta) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#050d1a;font-family:Arial,Helvetica,sans-serif;color:#d4f0fb">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="color:#06b6d4;font-size:22px;margin:0 0 16px">AquaTrip</h1>
    <h2 style="color:#f0f8ff;font-size:18px;margin:0 0 12px">${titulo}</h2>
    <div style="font-size:14px;line-height:1.6;color:#93b3ce">${corpo}</div>
    ${
      cta
        ? `<p style="margin:24px 0">
             <a href="${cta.url}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#06b6d4;color:#00222e;font-weight:bold;text-decoration:none">${cta.label}</a>
           </p>
           <p style="font-size:12px;color:#5f7f99;word-break:break-all">
             Se o botão não funcionar, copie este endereço:<br>${cta.url}
           </p>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #16334d;margin:24px 0">
    <p style="font-size:11px;color:#5f7f99">
      Você recebeu este e-mail porque alguém usou este endereço no AquaTrip.
      Se não foi você, pode ignorar esta mensagem com segurança.
    </p>
  </div>
</body></html>`;
}

async function sendPasswordReset({ to, name, url, expiraEmMinutos }) {
  const primeiroNome = (name || "").split(" ")[0] || "Olá";
  return send({
    to,
    template: "password_reset",
    subject: "Redefinição de senha — AquaTrip",
    text:
      `${primeiroNome}, recebemos um pedido para redefinir sua senha no AquaTrip.\n\n` +
      `Abra este endereço para criar uma nova senha:\n${url}\n\n` +
      `O link vale por ${expiraEmMinutos} minutos e só pode ser usado uma vez.\n` +
      `Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.`,
    html: layout(
      "Redefinição de senha",
      `<p>${primeiroNome}, recebemos um pedido para redefinir sua senha.</p>
       <p>O link vale por <strong>${expiraEmMinutos} minutos</strong> e só pode ser usado uma vez.</p>
       <p>Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.</p>`,
      { url, label: "Criar nova senha" }
    ),
  });
}

async function sendEmailVerification({ to, name, url, expiraEmHoras }) {
  const primeiroNome = (name || "").split(" ")[0] || "Olá";
  return send({
    to,
    template: "email_verification",
    subject: "Confirme seu e-mail — AquaTrip",
    text:
      `${primeiroNome}, bem-vindo ao AquaTrip!\n\n` +
      `Confirme seu endereço de e-mail abrindo este link:\n${url}\n\n` +
      `O link vale por ${expiraEmHoras} horas.`,
    html: layout(
      "Confirme seu e-mail",
      `<p>${primeiroNome}, bem-vindo ao AquaTrip!</p>
       <p>Confirme seu endereço para garantir o acesso à sua conta.
          O link vale por <strong>${expiraEmHoras} horas</strong>.</p>`,
      { url, label: "Confirmar e-mail" }
    ),
  });
}

async function sendPasswordChanged({ to, name }) {
  const primeiroNome = (name || "").split(" ")[0] || "Olá";
  return send({
    to,
    template: "password_changed",
    subject: "Sua senha foi alterada — AquaTrip",
    text:
      `${primeiroNome}, sua senha do AquaTrip acabou de ser alterada.\n\n` +
      `Se não foi você, entre em contato conosco imediatamente.`,
    html: layout(
      "Sua senha foi alterada",
      `<p>${primeiroNome}, sua senha acabou de ser alterada.</p>
       <p><strong>Se não foi você</strong>, entre em contato conosco imediatamente.</p>`,
      null
    ),
  });
}

module.exports = {
  send,
  transportName,
  layout,
  esc,
  sendPasswordReset,
  sendEmailVerification,
  sendPasswordChanged,
  MAIL_DIR,
};
