# AI

AI configuration, usage logs and generated work are split across `ai_providers`, `ai_generations`, `ai_jobs` and `ai_token_logs` in the Design database schema. The API mounts provider/configuration and generation routes under `/api/ai`; token logs have their own route group.

Editorial generation code lives in `src/server/editorial`: it builds a brief from thesis/plan context, calls a configured `TextProvider` when available, applies quality and similarity checks, and selects a template. Without a configured provider, the current pipeline can return deterministic fallback copy for internal use; that is not proof of a production provider or approval.

Provider credentials and account permissions are environment/runtime gates. Do not record secret values in these documents.
