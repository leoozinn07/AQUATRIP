/* ==============================================================
   AquaTrip · VLibras (tradução para Libras do Governo Federal)
   ==============================================================
   O site roda sem script de terceiro (script-src 'self'). O VLibras
   é um script do gov.br que desenha um avatar 3D (Unity/WebAssembly)
   e busca as traduções nos servidores do governo, então ele só entra
   para quem LIGAR a opção (botão "Libras" no cabeçalho ou em
   Configurações). A escolha fica num cookie; sem ele, a CSP e a
   promessa da política de privacidade continuam as mesmas.

   Com a opção ligada, a CSP ganha só as origens do VLibras. O motor
   3D precisa compilar WebAssembly ('wasm-unsafe-eval') e o carregador
   antigo do Unity usa eval ('unsafe-eval'): por isso a opção é
   explícita e só vale para quem a ativou.
   ============================================================== */
const { ampliar } = require("./cspMercadoPago");

const COOKIE = "aquatrip_libras";
const RAIZ = "https://vlibras.gov.br/app";

const ORIGENS = {
  "script-src": ["https://vlibras.gov.br", "'unsafe-eval'", "'wasm-unsafe-eval'"],
  "connect-src": ["https://vlibras.gov.br", "https://*.vlibras.gov.br", "blob:", "data:"],
  "img-src": ["https://vlibras.gov.br", "https://*.vlibras.gov.br", "blob:"],
  "style-src": ["https://vlibras.gov.br"],
  "font-src": ["https://vlibras.gov.br", "data:"],
  "media-src": ["https://vlibras.gov.br", "blob:"],
  "worker-src": ["blob:"],
};

function ligado(req) {
  return /(?:^|;\s*)aquatrip_libras=1(?:;|$)/.test(req.headers.cookie || "");
}

function vlibras(req, res, next) {
  res.locals.libras = ligado(req);
  if (res.locals.libras) {
    const atual = res.getHeader("Content-Security-Policy");
    if (atual) res.setHeader("Content-Security-Policy", ampliar(atual, ORIGENS));
  }
  next();
}

module.exports = { vlibras, ligado, COOKIE, RAIZ, ORIGENS };
