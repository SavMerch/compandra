#!/bin/bash
# Boots Postgres-backed test stack. Requires Postgres 16 and a PostgREST binary (PGRST env).
cd "$(dirname "$0")/../.."
PGRST_DB_URI=postgres://authenticator:test@localhost:54329/compandra PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET=e2e-secret-e2e-secret-e2e-secret-e2e PGRST_SERVER_PORT=3111 "${PGRST:-postgrest}" &
node tests/e2e/backend.mjs &
wait
