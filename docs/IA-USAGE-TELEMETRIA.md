# Telemetria de uso de IA

O Design System e os workers `classification`, `competitive-intel` e
`news-radar` espelham o consumo de IA para o Observatório da Plataforma 2.0.

O envio usa `IA_USAGE_ENDPOINT` e `IA_USAGE_KEY`. Ele é sempre *fail-open*:
falhas ou indisponibilidade do Observatório não interrompem a geração nem os
workers. O Prospector mantém `LLM_API_KEY` como contrato da chave do provedor;
o Design System usa `DEEPSEEK_API_KEY_DESIGN_SYSTEM` no ambiente de produção.

As features emitidas são `design_copy_generate`,
`prospector_classification`, `prospector_competitive_intel` e
`prospector_news_radar`.
