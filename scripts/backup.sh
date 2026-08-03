#!/usr/bin/env bash
# Sauvegarde la base Postgres et le volume d'uploads de FitEvo (prod).
#
# Usage:
#   ./scripts/backup.sh [dossier-de-sortie]
#
# Variables d'environnement optionnelles :
#   COMPOSE_FILE     (défaut: docker-compose.prod.yml)
#   POSTGRES_USER    (défaut: lu depuis .env)
#   POSTGRES_DB      (défaut: lu depuis .env)
#   UPLOADS_VOLUME   (défaut: <nom-du-dossier-projet>_uploads_prod_data — vérifier avec
#                     `docker volume ls` si le nom du projet Docker Compose a été personnalisé)
#   RETENTION_DAYS   (défaut: 14 — les sauvegardes plus anciennes sont supprimées)
#
# À planifier via cron sur le serveur de production, par exemple tous les jours à 3h :
#   0 3 * * * cd /opt/fitevo && ./scripts/backup.sh /opt/fitevo-backups >> /var/log/fitevo-backup.log 2>&1
#
# Pour restaurer : voir scripts/restore-db.sh

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
OUT_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER manquant (défini dans .env ou en variable d'environnement)}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB manquant (défini dans .env ou en variable d'environnement)}"

mkdir -p "$OUT_DIR"

echo "[$(date '+%F %T')] Dump PostgreSQL ($POSTGRES_DB)..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$OUT_DIR/fitevo-db-$TIMESTAMP.dump"

UPLOADS_VOLUME="${UPLOADS_VOLUME:-$(basename "$(pwd)")_uploads_prod_data}"
echo "[$(date '+%F %T')] Archive du volume d'uploads ($UPLOADS_VOLUME)..."
docker run --rm \
  -v "$UPLOADS_VOLUME:/uploads:ro" \
  -v "$OUT_DIR:/backup" \
  alpine \
  tar czf "/backup/fitevo-uploads-$TIMESTAMP.tar.gz" -C /uploads .

echo "[$(date '+%F %T')] Nettoyage des sauvegardes de plus de $RETENTION_DAYS jours..."
find "$OUT_DIR" -name 'fitevo-db-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$OUT_DIR" -name 'fitevo-uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[$(date '+%F %T')] Sauvegarde terminée : $OUT_DIR/fitevo-db-$TIMESTAMP.dump, $OUT_DIR/fitevo-uploads-$TIMESTAMP.tar.gz"
