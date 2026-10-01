/* ==============================================================
   AquaTrip · Transição entre o cartão e a página da experiência
   ==============================================================
   Usa as View Transitions do próprio navegador (entre documentos):
   a foto e o título do cartão viram a capa e o título da página da
   experiência; no "voltar", o caminho inverso. Qualquer outra troca
   de página segue seca, como sempre (checkout inclusive).

   Carregado sem defer, no começo do <body>: o "pagereveal" dispara
   antes da primeira pintura da página nova, então o ouvinte precisa
   existir cedo. Navegador sem suporte (Firefox, por ora) ignora tudo
   e navega normalmente. "Reduzir movimento" desliga a animação.
   ============================================================== */
(function () {
  "use strict";
  if (!("onpagereveal" in window)) return;
  var reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
  var CHAVE = "aquatrip_vt_de";

  function limpar() {
    document.querySelectorAll("[data-vt]").forEach(function (el) {
      el.style.viewTransitionName = "";
      el.removeAttribute("data-vt");
    });
  }
  function nomear(el, nome) {
    if (!el) return;
    el.style.viewTransitionName = nome;
    el.setAttribute("data-vt", "");
  }
  // Foto e título voam; cabeçalho e barra do celular ficam parados.
  function marcar(foto, titulo) {
    nomear(foto, "vt-foto");
    nomear(titulo, "vt-titulo");
    nomear(document.querySelector(".app-header"), "vt-cabecalho");
    nomear(document.querySelector(".bottom-nav"), "vt-dock");
  }
  function slugDe(url) {
    try {
      var m = /^\/reservar\/([^/?#]+)\/?$/.exec(new URL(url, location.href).pathname);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function cartao(slug) {
    var links = document.querySelectorAll(".exp-card .exp-link");
    for (var i = 0; i < links.length; i++) {
      if (slugDe(links[i].href) === slug) return links[i].closest(".exp-card");
    }
    return null;
  }
  function marcarCartao(slug) {
    var c = cartao(slug);
    if (!c) return false;
    marcar(c.querySelector(".exp-media"), c.querySelector(".exp-title"));
    return true;
  }
  function marcarPagina() {
    var foto = document.querySelector(".xp-hero");
    if (!foto) return false;
    marcar(foto, document.querySelector(".xp-title"));
    return true;
  }

  // Página que está saindo
  window.addEventListener("pageswap", function (e) {
    try { sessionStorage.setItem(CHAVE, location.href); } catch (err) {}
    if (!e.viewTransition) return;
    limpar();
    // No "voltar" o navegador não informa o destino (url nula): a página
    // da experiência se prepara e a lista, ao chegar, confere o cartão.
    var destino = e.activation && e.activation.entry ? e.activation.entry.url : null;
    var para = destino ? slugDe(destino) : null;
    var aqui = slugDe(location.href);
    var ok = !reduzir.matches && (
      (para && !aqui && marcarCartao(para)) ||   // cartão -> experiência
      (aqui && !para && marcarPagina())          // experiência -> lista
    );
    if (!ok) e.viewTransition.skipTransition();
  });

  // Página que está chegando
  window.addEventListener("pagereveal", function (e) {
    if (!e.viewTransition) return;
    limpar();
    var origem = null;
    try { origem = sessionStorage.getItem(CHAVE); } catch (err) {}
    var de = origem ? slugDe(origem) : null;
    var aqui = slugDe(location.href);
    var ok = !reduzir.matches && origem && (
      (aqui && !de && marcarPagina()) ||         // chegou do cartão
      (de && !aqui && marcarCartao(de))          // voltou para a lista
    );
    if (!ok) { e.viewTransition.skipTransition(); return; }
    e.viewTransition.finished.finally(limpar);
  });
})();
