#!/usr/bin/env node
/* ==============================================================
   AquaTrip — Teste de envio de e-mail
   Manda um e-mail de teste pelo transporte configurado no .env
   (brevo, smtp ou dev) e diz o que aconteceu.
   Uso: npm run email:testar -- voce@email.com
   ============================================================== */
require("dotenv").config({ quiet: true });
const mailService = require("../app/services/mailService");
const db = require("../app/lib/db");

const destino = (process.argv[2] || "").trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
  console.error("Informe o e-mail de destino:  npm run email:testar -- voce@email.com");
  process.exit(1);
}

(async () => {
  const transporte = mailService.transportName();
  console.log(`Transporte: ${transporte}${transporte === "dev" ? " (nada é enviado de verdade; o e-mail vai para tmp/emails)" : ""}`);
  try {
    await mailService.send({
      to: destino,
      template: "teste",
      subject: "Teste de e-mail — AquaTrip",
      text: "Se você recebeu esta mensagem, o envio de e-mails do AquaTrip está funcionando.",
      html: mailService.layout("Teste de e-mail", "<p>Se você recebeu esta mensagem, o envio de e-mails do AquaTrip está funcionando.</p>", null),
    });
    console.log(transporte === "dev" ? "Gravado em tmp/emails." : `Enviado para ${destino}. Confira a caixa de entrada (e o spam).`);
  } catch (err) {
    console.error("Falhou: " + err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end().catch(() => {});
  }
})();
