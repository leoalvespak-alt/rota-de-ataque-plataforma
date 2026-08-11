CREATE TABLE ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('openai-compatible','anthropic','local')),
  base_url text NOT NULL,
  api_key_encrypted text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_providers_name_unique ON ai_providers (lower(name));

CREATE TABLE ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  label text NOT NULL,
  model_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  supports_json boolean NOT NULL DEFAULT true,
  max_output_tokens integer NOT NULL DEFAULT 512 CHECK (max_output_tokens BETWEEN 64 AND 32768),
  temperature numeric NOT NULL DEFAULT 0 CHECK (temperature BETWEEN 0 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, model_id)
);

CREATE UNIQUE INDEX ai_models_single_default ON ai_models (is_default) WHERE is_default;

WITH provider AS (
  INSERT INTO ai_providers(name,kind,base_url,enabled)
  VALUES ('DeepSeek','openai-compatible','https://api.deepseek.com',false)
  RETURNING id
)
INSERT INTO ai_models(provider_id,label,model_id,enabled,is_default,max_output_tokens,temperature)
SELECT id,'DeepSeek V4 Flash','deepseek-v4-flash',true,true,2048,0 FROM provider
UNION ALL
SELECT id,'DeepSeek V4 Pro','deepseek-v4-pro',true,false,4096,0 FROM provider;

