/* AquaTrip · inicia o VLibras (só carregado quando a pessoa liga a
   opção "Libras"). Fica num arquivo próprio porque a CSP não aceita
   script inline. Se o gov.br não responder, o site segue sem o avatar. */
(function () {
  "use strict";
  if (window.VLibras && typeof window.VLibras.Widget === "function") {
    new window.VLibras.Widget("https://vlibras.gov.br/app");
  }
})();
