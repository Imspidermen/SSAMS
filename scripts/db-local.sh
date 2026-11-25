#!/usr/bin/env bash
#
# Start a local PostgreSQL for SSAMS development when no external DATABASE_URL
# is provided. Used automatically by `npm start` when it detects PostgreSQL or
# Docker on the machine. Requires either:
#   - PostgreSQL installed locally (apt install postgresql / brew install postgresql), or
#   - Docker (a `postgres:16` container is used).
#
# Usage: bash scripts/db-local.sh {up|down}
#
set -euo pipefail

ACTION="${1:-up}"
PG_VERSION_DIR="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
# SSAMS_PG_BIN is supplied by the Node launcher for standard Windows installs,
# which normally do not add PostgreSQL's bin directory to PATH.
PG_BIN="${SSAMS_PG_BIN:-${PG_VERSION_DIR}}"
DATA_DIR=".ssams/pgdata"
SOCK_DIR=".ssams/pg-sockets"
PG_PORT="${SSAMS_LOCAL_DB_PORT:-5432}"
PG_USER="ssams"
PG_PASS="ssams"
PG_DB="ssams"
DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}?schema=public"

ensure_pg() {
  if [ -n "${PG_BIN}" ] && [ -x "${PG_BIN}/pg_ctl" ]; then return 0; fi
  if command -v pg_ctl >/dev/null 2>&1; then PG_BIN="$(dirname "$(command -v pg_ctl)")"; return 0; fi
  if command -v docker >/dev/null 2>&1; then return 0; fi
  echo "ERROR: PostgreSQL is not installed. Install it (apt install postgresql / brew install postgresql)" >&2
  echo "       or Docker, then retry. Alternatively set DATABASE_URL to a managed Postgres." >&2
  exit 1
}

case "$ACTION" in
  up)
    ensure_pg
    if command -v docker >/dev/null 2>&1 && { [ -z "${PG_BIN}" ] || [ ! -x "${PG_BIN}/pg_ctl" ]; }; then
      echo "Starting PostgreSQL via Docker (postgres:16)..."
      docker run -d --name ssams-pg -p "${PG_PORT}:5432" \
        -e POSTGRES_PASSWORD="${PG_PASS}" -e POSTGRES_USER="${PG_USER}" -e POSTGRES_DB="${PG_DB}" \
        postgres:16 >/dev/null
      echo "Waiting for PostgreSQL to accept connections..."
      for _ in $(seq 1 30); do
        if docker exec ssams-pg pg_isready -U "${PG_USER}" >/dev/null 2>&1; then break; fi
        sleep 1
      done
      echo "DATABASE_URL=${DATABASE_URL}"
      exit 0
    fi
    mkdir -p "${DATA_DIR}" "${SOCK_DIR}"
    if [ ! -f "${DATA_DIR}/PG_VERSION" ]; then
      echo "Initialising PostgreSQL data directory at ${DATA_DIR}..."
      "${PG_BIN}/initdb" -D "${DATA_DIR}" -U postgres --auth=trust >/dev/null
    fi
    echo "Starting PostgreSQL on port ${PG_PORT}..."
    "${PG_BIN}/pg_ctl" -D "${DATA_DIR}" -o "-p ${PG_PORT} -k ${SOCK_DIR} -c listen_addresses='localhost'" -l .ssams/pg.log start
    echo "Waiting for PostgreSQL to accept connections..."
    for _ in $(seq 1 30); do
      if "${PG_BIN}/pg_isready" -h localhost -p "${PG_PORT}" >/dev/null 2>&1; then break; fi
      sleep 1
    done
    echo "Creating role/db (ignoring errors if they already exist)..."
    PGPASSWORD=postgres "${PG_BIN}/psql" -h localhost -p "${PG_PORT}" -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1 ||
      PGPASSWORD=postgres "${PG_BIN}/psql" -h localhost -p "${PG_PORT}" -U postgres -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}' SUPERUSER;"
    PGPASSWORD=postgres "${PG_BIN}/psql" -h localhost -p "${PG_PORT}" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 ||
      PGPASSWORD=postgres "${PG_BIN}/psql" -h localhost -p "${PG_PORT}" -U postgres -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
    echo "DATABASE_URL=${DATABASE_URL}"
    ;;
  down)
    if command -v docker >/dev/null 2>&1 && docker ps -q -f name=ssams-pg >/dev/null 2>&1; then
      docker rm -f ssams-pg >/dev/null
    elif [ -n "${PG_BIN}" ] && [ -f "${DATA_DIR}/PG_VERSION" ]; then
      "${PG_BIN}/pg_ctl" -D "${DATA_DIR}" stop || true
    fi
    echo "Local PostgreSQL stopped."
    ;;
  *)
    echo "Usage: $0 {up|down}" >&2
    exit 1
    ;;
esac
