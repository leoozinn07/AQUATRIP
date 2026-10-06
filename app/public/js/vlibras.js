/* AquaTrip · inicia o VLibras (só carregado quando a pessoa liga a
   opção "Libras"). Fica num arquivo próprio porque a CSP não aceita
   script inline. Se o gov.br não responder, o site segue sem o avatar.
   Logo depois de ligar a opção, o painel já abre (o app-shell.js marca
   o pedido); antes, só surgia o botãozinho azul na lateral da tela. */
(function () {
  "use strict";
  if (!window.VLibras || typeof window.VLibras.Widget !== "function") return;
  new window.VLibras.Widget("https://vlibras.gov.br/app");

  var abrir = false;
  try {
    abrir = sessionStorage.getItem("aquatrip_libras_abrir") === "1";
    sessionStorage.removeItem("aquatrip_libras_abrir");
  } catch (e) { /* armazenamento bloqueado: fica só o botão */ }
  var w = window.VLibrasWidget;
  if (abrir && w && typeof w.open === "function") w.open();
})();
