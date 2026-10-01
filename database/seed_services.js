/* ==============================================================
   AquaTrip — Seed das experiências oficiais e seus horários
   Grava o catálogo operado pelo próprio AquaTrip
   (app/lib/catalogoOficial.js) com horários nos próximos 30 dias,
   para que o fluxo de reserva possa ser testado de ponta a ponta.
   Idempotente: rodar de novo só completa a agenda. Não sobrescreve
   preço nem descrição editados depois (a descrição só entra se
   estiver vazia).
   Uso: npm run db:seed:services
   ============================================================== */
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const db = require("../app/lib/db");
const fuso = require("../app/lib/fuso");
const { EXPERIENCIAS } = require("../app/lib/catalogoOficial");

const DIAS = 30;
const CAPACIDADE = 10;

/** "AAAA-MM-DD" de hoje + N dias, no fuso de operação. */
function diaLocal(diasAFrente) {
  const [a, m, d] = fuso.localDe(new Date()).data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + diasAFrente)).toISOString().slice(0, 10);
}

async function seed() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const s of EXPERIENCIAS) {
      await client.query(
        `INSERT INTO services (id, slug, title, location, category, price_cents, description)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE title = VALUES(title),
           description = COALESCE(description, VALUES(description))`,
        [crypto.randomUUID(), s.slug, s.title, s.location, s.category, s.price_cents, s.description || null]
      );
      const { rows } = await client.query(`SELECT id, slug FROM services WHERE slug = ?`, [s.slug]);
      const serviceId = rows[0].id;

      // Horários nos próximos dias, na hora local de cada experiência.
      for (let dia = 1; dia <= DIAS; dia++) {
        for (const hora of s.horarios || ["09:00", "14:00"]) {
          const inicio = fuso.paraUtc(diaLocal(dia), hora);
          if (!inicio) continue; // hora que não existe (mudança de horário)
          await client.query(
            `INSERT IGNORE INTO service_slots (id, service_id, starts_at, capacity)
             VALUES (?, ?, ?, ?)`,
            [crypto.randomUUID(), serviceId, inicio, s.capacidade || CAPACIDADE]
          );
        }
      }
      console.log(`[seed] experiência pronta: ${rows[0].slug}`);
    }

    await client.query("COMMIT");
    console.log(`[seed] ${EXPERIENCIAS.length} experiências oficiais com horários para ${DIAS} dias.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .catch((err) => { console.error("[seed] erro:", err); process.exit(1); })
  .finally(() => db.pool.end());
