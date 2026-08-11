# Disponibilidade da WhatsApp Groups API

Status atual: **pendente de credenciais e habilitação da conta**.

A implementação de grupos permanece desligada por `WHATSAPP_GROUPS_AVAILABLE=false`. Execute `node scripts/whatsapp-groups-availability-check.mjs` com `WHATSAPP_BUSINESS_ACCOUNT_ID` e `WHATSAPP_ACCESS_TOKEN`. Somente um resultado `available: true` autoriza criar grupos ou publicar neles. Participação em grupo não equivale a opt-in para conversa individual.
