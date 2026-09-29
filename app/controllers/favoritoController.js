/* ==============================================================
   AquaTrip — Favoritos (página e API)
   ============================================================== */
const { z } = require("zod");
const favoritoService = require("../services/favoritoService");
const log = require("../lib/logger");

const UUID = z.string().uuid();

/** Marca os cartões de quem está logado. Só em GET de página: API e
    arquivos estáticos não desenham cartão. */
async function carregarIds(req, res, next) {
  res.locals.favoritos = new Set();
  const u = req.session && req.session.user;
  if (!u || req.method !== "GET" || req.path.startsWith("/api/")) return next();
  try {
    res.locals.favoritos = await favoritoService.ids(u.id);
  } catch (err) {
    // Sem os ids a página abre do mesmo jeito, só com os cartões desmarcados.
    (req.log || log).warn({ err }, "falha ao carregar favoritos");
  }
  next();
}

async function pagina(req, res, next) {
  try {
    const experiencias = await favoritoService.listar(req.session.user.id);
    res.locals.seo = { ...res.locals.seo, titulo: req.t("favoritos.titulo") + " · AquaTrip" };
    res.render("pages/favoritos", { experiencias });
  } catch (err) {
    next(err);
  }
}

async function definir(req, res, next) {
  if (!UUID.safeParse(req.params.id).success) {
    return res.status(400).json({ error: req.tm("Identificador inválido.") });
  }
  const parsed = z.object({ favorito: z.boolean() }).safeParse(req.body || {});
  if (!parsed.success) return res.status(422).json({ error: req.tm("Dados inválidos.") });
  try {
    res.json(await favoritoService.definir({
      userId: req.session.user.id, serviceId: req.params.id, favoritar: parsed.data.favorito,
    }));
  } catch (err) {
    if (err instanceof favoritoService.FavoritoError) {
      return res.status(err.status).json({ error: req.tm(err.message), codigo: err.code });
    }
    next(err);
  }
}

module.exports = { carregarIds, pagina, definir };
