#!/usr/bin/env bash
# Executa a suíte de RLS em um PostgreSQL local descartável (Docker).
# Nunca conecta em projetos remotos nem usa service_role.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="naval-rls-test-$$"

cleanup() {
    docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker é necessário para rodar os testes de RLS." >&2
    exit 1
fi

docker run -d --name "$container" \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=naval \
    postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
    if docker exec "$container" pg_isready -U postgres -d naval >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

docker cp "$root/supabase/rls_local_shim.sql" "$container:/tmp/shim.sql" >/dev/null
docker exec "$container" psql -U postgres -d naval \
    -v ON_ERROR_STOP=1 --single-transaction -q -f /tmp/shim.sql

docker cp "$root/supabase/migrations" "$container:/tmp/migrations" >/dev/null
docker exec "$container" sh -c '
    for file in $(ls /tmp/migrations/*.sql | sort); do
        psql -U postgres -d naval -v ON_ERROR_STOP=1 --single-transaction -q -f "$file" || exit 1
    done
'

docker cp "$root/supabase/rls_tests.sql" "$container:/tmp/rls-tests.sql" >/dev/null
docker exec "$container" psql -U postgres -d naval \
    -v ON_ERROR_STOP=1 -P pager=off -f /tmp/rls-tests.sql
