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
exec "$@"
