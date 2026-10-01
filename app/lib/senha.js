/* ==============================================================
   AquaTrip — Regra de senha
   ==============================================================
   Uma regra só para todo lugar onde uma senha é CRIADA (cadastro,
   redefinição por e-mail e troca no perfil): no mínimo 8 caracteres,
   com pelo menos uma letra, um número e um caractere especial.
   Se cada formulário tivesse a sua, bastaria "esquecer a senha" para
   escapar da regra do cadastro.

   O login não usa isto: quem criou a senha antes da regra continua
   entrando normalmente.
   ============================================================== */
const { z } = require("zod");

const MIN = 8;
const MAX = 72; // limite prático do argon2/bcrypt

const MENSAGENS = {
  tamanho: "A senha precisa ter pelo menos 8 caracteres.",
  letra: "A senha precisa ter pelo menos uma letra.",
  numero: "A senha precisa ter pelo menos um número.",
  especial: "A senha precisa ter pelo menos um caractere especial (como ! @ # $ %).",
  longa: "Senha longa demais.",
};

/** Lista do que falta na senha, na ordem em que a pessoa lê a regra. */
function faltando(senha) {
  const s = String(senha || "");
  const f = [];
  if (s.length < MIN) f.push("tamanho");
  if (!/\p{L}/u.test(s)) f.push("letra");
  if (!/\p{N}/u.test(s)) f.push("numero");
  // Especial: qualquer coisa que não seja letra, número ou espaço
  if (!/[^\p{L}\p{N}\s]/u.test(s)) f.push("especial");
  return f;
}

/** Campo zod com a regra (mostra o primeiro problema). */
function schema() {
  return z.string().max(MAX, MENSAGENS.longa).superRefine((s, ctx) => {
    const f = faltando(s);
    if (f.length) ctx.addIssue({ code: "custom", message: MENSAGENS[f[0]] });
  });
}

module.exports = { MIN, MAX, MENSAGENS, faltando, schema };
