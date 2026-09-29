-- ============================================================
-- AquaTrip — Migration 022: favoritos
-- ============================================================
-- Experiências que a pessoa salvou para ver depois. Lista privada:
-- diferente da curtida, não tem contagem pública.
-- Chave primária composta: favoritar duas vezes é impossível no banco.
CREATE TABLE IF NOT EXISTS favorites (
  user_id     CHAR(36) NOT NULL,
  service_id  CHAR(36) NOT NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, service_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE INDEX idx_favorites_service ON favorites (service_id);
