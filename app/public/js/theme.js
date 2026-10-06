/* ==============================================================
   AquaTrip · Tema claro/escuro e animações
   ==============================================================
   Carregado de forma BLOQUEANTE no <head> (sem defer): a CSP
   proíbe script inline, e um arquivo pequeno e síncrono aplica o
   data-theme antes da primeira pintura, sem piscar.

   Três escolhas: "system" (sem atributo, segue o aparelho),
   "light" e "dark". Controles:
   - [data-theme-toggle]  botão que alterna claro/escuro
   - [data-theme-set]     botões de escolha (menu e Configurações)

   Animações: "sistema" (padrão: segue o "reduzir movimento" do
   aparelho), "ligado" ou "desligado". O resultado vai para
   html[data-movimento="normal"|"reduzido"] (CSS) e para
   window.AQ_MOVIMENTO.reduzir (abertura, água, bolhas, rolagem e
   transições leem daqui). Quem pediu menos movimento no aparelho
   continua sem animação, a não ser que ligue aqui de propósito.
   - [data-movimento-set] botões de escolha (Configurações)
   ============================================================== */
(function () {
  "use strict";

  var CHAVE = "aquatrip_theme";

  function salvo() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function guardar(v) {
    try {
      if (v === "light" || v === "dark") localStorage.setItem(CHAVE, v);
      else localStorage.removeItem(CHAVE);
    } catch (e) {}
  }
  function aplicar(tema) {
    if (tema === "dark" || tema === "light") document.documentElement.setAttribute("data-theme", tema);
    else document.documentElement.removeAttribute("data-theme");
  }

  var CHAVE_MOV = "aquatrip_movimento";
  var mqMov = window.matchMedia("(prefers-reduced-motion: reduce)");
  function movSalvo() {
    try {
      var v = localStorage.getItem(CHAVE_MOV);
      return v === "ligado" || v === "desligado" ? v : "sistema";
    } catch (e) { return "sistema"; }
  }
  function guardarMov(v) {
    try {
      if (v === "ligado" || v === "desligado") localStorage.setItem(CHAVE_MOV, v);
      else localStorage.removeItem(CHAVE_MOV);
    } catch (e) {}
  }
  function aplicarMov() {
    var pref = movSalvo();
    var reduzir = pref === "desligado" || (pref === "sistema" && mqMov.matches);
    window.AQ_MOVIMENTO = { preferencia: pref, sistemaReduz: mqMov.matches, reduzir: reduzir };
    document.documentElement.setAttribute("data-movimento", reduzir ? "reduzido" : "normal");
  }

  // 1) Antes da pintura
  aplicar(salvo());
  aplicarMov();

  // 2) Depois do DOM: liga os controles
  document.addEventListener("DOMContentLoaded", function () {
    var t = (window.AQ && window.AQ.t) || function (k, v, p) { return p; };
    var alternadores = document.querySelectorAll("[data-theme-toggle]");
    var escolhas = document.querySelectorAll("[data-theme-set]");

    function temaAtual() {
      var explicito = document.documentElement.getAttribute("data-theme");
      if (explicito) return explicito;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function sincronizar() {
      var atual = temaAtual();
      var escolha = salvo() || "system";
      alternadores.forEach(function (b) {
        b.setAttribute("aria-pressed", String(atual === "dark"));
        b.setAttribute("aria-label", atual === "dark"
          ? t("tema_para_claro", null, "Mudar para tema claro")
          : t("tema_para_escuro", null, "Mudar para tema escuro"));
        var sol = b.querySelector("[data-icon-light]");
        var lua = b.querySelector("[data-icon-dark]");
        if (sol) sol.hidden = atual === "dark";
        if (lua) lua.hidden = atual !== "dark";
      });
      escolhas.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === escolha));
      });
    }

    alternadores.forEach(function (b) {
      b.addEventListener("click", function () {
        var novo = temaAtual() === "dark" ? "light" : "dark";
        aplicar(novo); guardar(novo); sincronizar();
      });
    });
    escolhas.forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-theme-set");
        aplicar(v === "system" ? null : v); guardar(v); sincronizar();
      });
    });

    sincronizar();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (!salvo()) sincronizar();
    });

    // Animações (Configurações): escolha + diagnóstico do aparelho
    var movEscolhas = document.querySelectorAll("[data-movimento-set]");
    function sincronizarMov() {
      var m = window.AQ_MOVIMENTO;
      movEscolhas.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-movimento-set") === m.preferencia));
      });
      // Mostra só a frase que explica o estado atual
      var estado = m.preferencia === "ligado" ? "forcado-ligado"
        : m.preferencia === "desligado" ? "forcado-desligado"
        : m.sistemaReduz ? "sistema-reduz" : "sistema-ok";
      document.querySelectorAll("[data-mov-estado]").forEach(function (el) {
        el.hidden = el.getAttribute("data-mov-estado") !== estado;
      });
    }
    movEscolhas.forEach(function (b) {
      b.addEventListener("click", function () {
        guardarMov(b.getAttribute("data-movimento-set"));
        aplicarMov(); sincronizarMov();
      });
    });
    mqMov.addEventListener("change", function () { aplicarMov(); sincronizarMov(); });
    if (movEscolhas.length) {
      sincronizarMov();
      // A água da abertura precisa de WebGL2 (aceleração gráfica do navegador)
      var aviso = document.querySelector("[data-mov-webgl]");
      if (aviso) {
        var gl = null;
        try { gl = document.createElement("canvas").getContext("webgl2"); } catch (e) {}
        aviso.hidden = Boolean(gl && gl.getExtension("EXT_color_buffer_float"));
      }
    }
  });
})();
