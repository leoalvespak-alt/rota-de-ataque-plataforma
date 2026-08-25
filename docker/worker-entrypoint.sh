#!/bin/sh
set -eu

package=''
if [ "${1:-}" = 'supervisor' ]; then
engine="${2:-}"
printf '{"level":"info","component":"worker-supervisor","engine":"%s","state":"starting_controlled_runtime"}\n' "$engine"
exec node --import tsx --enable-source-maps /app/docker/worker-supervisor.mts "$engine"
fi

for argument in "$@"; do
  case "$argument" in
    @plataforma/worker-*) package="${argument#@plataforma/worker-}" ;;
  esac
done

if [ -z "$package" ]; then
  exec "$@"
fi

# O processo sempre sobe. O runtime consulta worker_settings e faz pause/resume
# dinâmico, para que a ação na interface controle o consumidor real sem redeploy.
printf '{"level":"info","worker":"%s","state":"starting_controlled_runtime"}\n' "$package"

# O Compose preserva o nome do pacote como contrato declarativo, mas não mantém
# um processo pnpm residente para cada um dos 41 workers. Os pacotes compartilhados
# ainda exportam TypeScript-fonte, por isso o único processo Node carrega o loader
# tsx diretamente até que todo o workspace publique exports compilados.
worker_main="/app/workers/$package/src/main.ts"
if [ ! -f "$worker_main" ]; then
  printf '{"level":"error","worker":"%s","state":"entrypoint_missing","path":"%s"}\n' "$package" "$worker_main" >&2
  exit 1
fi
exec node --import tsx --enable-source-maps "$worker_main"
