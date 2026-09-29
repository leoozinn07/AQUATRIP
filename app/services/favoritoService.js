/* ==============================================================
   AquaTrip — Favoritos
   ==============================================================
   Experiências que a pessoa salvou para ver depois. A lista é só
   dela: não tem contagem pública (para isso existe a curtida).
   Só dá para favoritar o que o público pode ver; se a experiência
   sair do ar depois, ela some da lista sem apagar o favorito.
   A chave primária (pessoa, experiência) + INSERT IGNORE deixa a
   ação idempotente: duplo clique não duplica nada.
   ============================================================== */
const db = require("../lib/db");
const catalogRepository = require("../repositories/catalogRepository");
const { visivel } = require("../lib/visibilidade");

class FavoritoError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = "FavoritoError";
    this.code = code;
    this.status = status;
  }
}

/** Marca (favoritar = true) ou desmarca a experiência. */
async function definir({ userId, serviceId, favoritar }) {
  const { rows } = await db.query(
    `SELECT sv.id FROM services sv WHERE sv.id = ? AND ${visivel("sv")}`,
    [serviceId]
  );
  if (!rows[0]) throw new FavoritoError("Experiência não encontrada.", "NOT_FOUND", 404);
  if (favoritar) {
    await db.query(`INSERT IGNORE INTO favorites (user_id, service_id) VALUES (?, ?)`, [userId, serviceId]);
  } else {
    await db.query(`DELETE FROM favorites WHERE user_id = ? AND service_id = ?`, [userId, serviceId]);
  }
  return { favorito: Boolean(favoritar), total: await contar(userId) };
}

/** Ids favoritados pela pessoa: para os cartões já nascerem marcados. */
async function ids(userId) {
  if (!userId) return new Set();
  const { rows } = await db.query(`SELECT service_id FROM favorites WHERE user_id = ?`, [userId]);
  return new Set(rows.map((r) => r.service_id));
}

async function contar(userId) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS n FROM favorites f JOIN services sv ON sv.id = f.service_id
     WHERE f.user_id = ? AND ${visivel("sv")}`,
    [userId]
  );
  return Number(rows[0].n);
}

/** Cartões da página "Favoritos" (só o que continua no ar). */
function listar(userId) {
  return catalogRepository.listFavorites(userId);
}

module.exports = { FavoritoError, definir, ids, contar, listar };
