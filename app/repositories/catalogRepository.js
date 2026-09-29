/* ==============================================================
   AquaTrip — Catálogo público
   ==============================================================
   Alimenta /praias, /mergulho, /caiaque, /pesca, /aquarios e
   /expedicoes. Antes, cada página tinha 12 a 18 experiências
   escritas à mão no HTML — com avaliações inventadas — que levavam
   a um fluxo de compra que não gravava nada.

   Só entra no catálogo o que o cliente consegue de fato reservar
   ou, no mínimo, conhecer: experiência ativa. A disponibilidade
   (próxima data, vagas) vem calculada aqui, com a mesma regra de
   ocupação do fluxo de reserva: confirmadas + pendentes vivas.
   ============================================================== */
const db = require("../lib/db");
const { visivel, semExemplo } = require("../lib/visibilidade");

const FUSO = process.env.OPERATION_TIMEZONE || "America/Sao_Paulo";

/* Consulta dos cartões: dados da experiência, capa, quem opera,
   próxima data com vaga e nota. "filtro" e "ordem" vêm só de dentro
   deste arquivo (nunca de entrada do usuário); valores vão em params. */
async function cartoes({ filtro, params, ordem, extras = "", juntar = "" }) {
  const { rows } = await db.query(
    `WITH livres AS (
       SELECT s.id, s.service_id, s.starts_at,
              s.capacity - COALESCE(SUM(CASE WHEN
                b.status = 'CONFIRMED'
                OR (b.status = 'PENDING' AND b.expires_at > NOW())
                THEN b.quantity END), 0) AS vagas
       FROM service_slots s
       LEFT JOIN bookings b ON b.slot_id = s.id
       WHERE s.starts_at > NOW()
       GROUP BY s.id
     )
     SELECT sv.id, sv.slug, sv.title, sv.location, sv.category, sv.price_cents, sv.description,
            sv.cover_alt, m.storage_key AS cover_key, pa.display_name AS operador,
            MIN(CASE WHEN l.vagas > 0 THEN l.starts_at END) AS proxima_data,
            COALESCE(SUM(CASE WHEN l.vagas > 0 THEN l.vagas END), 0) AS vagas_futuras,
            COUNT(CASE WHEN l.vagas > 0 THEN 1 END) AS horarios_com_vaga,
            (SELECT ROUND(AVG(r.rating), 1) FROM reviews r
              WHERE r.service_id = sv.id AND r.status = 'VISIBLE') AS nota_media,
            (SELECT COUNT(*) FROM reviews r
              WHERE r.service_id = sv.id AND r.status = 'VISIBLE') AS total_avaliacoes${extras}
     FROM services sv
     LEFT JOIN livres l ON l.service_id = sv.id
     LEFT JOIN media m ON m.id = sv.cover_media_id
     LEFT JOIN partners pa ON pa.id = sv.partner_id${juntar}
     WHERE ${visivel("sv")} AND ${filtro}
     GROUP BY sv.id, m.storage_key, pa.display_name
     ORDER BY ${ordem}`,
    params
  );
  return rows;
}

function listByCategory(categoria) {
  return cartoes({
    filtro: `${semExemplo("sv")} AND (? IS NULL OR sv.category = ?)`,
    params: [categoria, categoria],
    // Primeiro o que dá para reservar, pela data mais próxima.
    ordem: "proxima_data IS NULL, proxima_data, sv.title",
  });
}

/** Favoritos da pessoa, do salvo mais recente ao mais antigo. Conteúdo
    de exemplo (seed da comunidade) vem marcado, para o cartão avisar. */
function listFavorites(userId) {
  return cartoes({
    filtro: "f.user_id = ?",
    params: [userId],
    juntar: "\n     JOIN favorites f ON f.service_id = sv.id",
    extras: `, MAX(f.created_at) AS favoritado_em, NOT ${semExemplo("sv")} AS exemplo`,
    ordem: "favoritado_em DESC",
  });
}

/** Quantas experiências ativas cada categoria tem — navegação do catálogo. */
async function countByCategory() {
  const { rows } = await db.query(
    `SELECT category, COUNT(*) AS n FROM services sv WHERE ${visivel("sv")} AND ${semExemplo("sv")} GROUP BY category`
  );
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

/** Todas as experiências visíveis (home e /reservar), mesma regra de vagas. */
function listAll() {
  return listByCategory(null);
}

module.exports = { FUSO, listByCategory, listAll, listFavorites, countByCategory };
