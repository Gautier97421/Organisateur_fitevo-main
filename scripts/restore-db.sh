#!/usr/bin/env bash
# Restaure un dump PostgreSQL FitEvo produit par scripts/backup.sh.
#
# ATTENTION : écrase le contenu actuel de la base. À utiliser en cas de
# restauration d'urgence (perte de données, migration ratée), pas en routine.
#
# Usage:
#   ./scripts/restore-db.sh chemin/vers/fitevo-db-20260802-030000.dump

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DUMP_FILE="${1:?Usage: ./scripts/restore-db.sh <fichier.dump>}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Fichier introuvable : $DUMP_FILE" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER manquant}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB manquant}"

read -r -p "Ceci va ÉCRASER la base '$POSTGRES_DB' avec le contenu de $DUMP_FILE. Continuer ? (oui/non) " CONFIRM
if [ "$CONFIRM" != "oui" ]; then
  echo "Annulé."
  exit 1
fi

echo "[$(date '+%F %T')] Restauration en cours..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < "$DUMP_FILE"

echo "[$(date '+%F %T')] Restauration terminée."
