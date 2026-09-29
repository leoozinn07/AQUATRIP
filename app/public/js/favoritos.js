/* ==============================================================
   AquaTrip — Favoritos (qualquer página)
   ==============================================================
   Botões [data-favorito=id]: salva ou tira a experiência dos
   favoritos. Visitante ([data-login]) vai ao login e volta.
   A tela muda na hora e volta atrás se o servidor recusar; todos os
   botões da mesma experiência na página mudam juntos (cartão e
   página da experiência).
   ============================================================== */
(function () {
  "use strict";
  // Nem toda página tem a meta; o cabeçalho sempre tem um _csrf (sair).
  var CSRF = (document.querySelector('meta[name="csrf-token"]') || {}).content
    || (document.querySelector('input[name="_csrf"]') || {}).value || "";
  var t = function (k, v, p) { return window.AQ ? window.AQ.t(k, v, p) : p; };
  var aviso = function (m) { if (window.aquatripToast) window.aquatripToast(m); };

  function irParaLogin() {
    location.href = "/login?redirect=" + encodeURIComponent(location.pathname + location.search + location.hash);
  }

  function marcar(id, ligado) {
    document.querySelectorAll("[data-favorito]").forEach(function (b) {
      if (b.getAttribute("data-favorito") !== id) return;
      b.classList.toggle("is-on", ligado);
      b.setAttribute("aria-pressed", String(ligado));
      var rotulo = b.querySelector("[data-fav-rotulo]");
      if (rotulo) rotulo.textContent = ligado ? b.getAttribute("data-rotulo-on") : b.getAttribute("data-rotulo-off");
    });
  }

  // Na página de favoritos, o que foi desmarcado sai da lista.
  function tirarDaLista(id) {
    var lista = document.getElementById("favLista");
    if (!lista) return;
    lista.querySelectorAll("[data-favorito]").forEach(function (b) {
      if (b.getAttribute("data-favorito") !== id) return;
      var item = b.closest("li");
      if (item) item.remove();
    });
    if (!lista.querySelector("li")) {
      lista.hidden = true;
      var vazio = document.getElementById("favVazio");
      if (vazio) vazio.hidden = false;
    }
  }

  document.addEventListener("click", function (e) {
    var botao = e.target.closest("[data-favorito]");
    if (!botao) return;
    e.preventDefault();
    e.stopPropagation();
    if (botao.hasAttribute("data-login")) return irParaLogin();
    if (botao.dataset.ocupado) return;
    botao.dataset.ocupado = "1";
    var id = botao.getAttribute("data-favorito");
    var ligado = botao.getAttribute("aria-pressed") !== "true";
    marcar(id, ligado);

    fetch("/api/favoritos/" + encodeURIComponent(id), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": CSRF },
      body: JSON.stringify({ favorito: ligado }),
    })
      .then(function (res) {
        if (res.status === 401) { irParaLogin(); throw new Error("login"); }
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok) throw new Error(j.error || t("erro_tentar", null, "Não foi possível concluir."));
          return j;
        });
      })
      .then(function (j) {
        marcar(id, j.favorito);
        aviso(j.favorito ? t("fav_salvo", null, "Salvo nos seus favoritos.") : t("fav_removido", null, "Removido dos favoritos."));
        if (!j.favorito) tirarDaLista(id);
      })
      .catch(function (err) {
        if (err.message === "login") return;
        marcar(id, !ligado);
        aviso(err.message);
      })
      .then(function () { delete botao.dataset.ocupado; });
  });
})();
