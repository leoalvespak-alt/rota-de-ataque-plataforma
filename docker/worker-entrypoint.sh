#!/bin/sh
set -eu

package=''
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
# um processo pnpm residente para cada um dos 41 workers. Isso reduz pela metade
# a árvore de processos e evita saturação da VPS durante o startup em massa.
worker_main="/app/workers/$package/dist/main.js"
if [ ! -f "$worker_main" ]; then
  printf '{"level":"error","worker":"%s","state":"entrypoint_missing","path":"%s"}\n' "$package" "$worker_main" >&2
  exit 1
fi
exec node --enable-source-maps "$worker_main"
