INSERT INTO "users" ("id", "email", "name", "role")
VALUES ('00000000-0000-4000-8000-000000000001', 'operator@localhost.invalid', 'Design System Operator', 'admin')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "creative_projects" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "creative_projects" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
UPDATE "brand_profiles" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
UPDATE "ai_token_logs" SET "user_id" = '00000000-0000-4000-8000-000000000001' WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ai_token_logs" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(100) NOT NULL,
  "model_id" varchar(255) NOT NULL,
  "provider_request_id" varchar(500) NOT NULL,
  "status" varchar(30) NOT NULL,
  "status_url" text NOT NULL,
  "response_url" text NOT NULL,
  "image_url" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_provider_request_unique" ON "ai_jobs" USING btree ("provider", "provider_request_id");
--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created_idx" ON "ai_jobs" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE "api_idempotency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" varchar(100) NOT NULL,
  "key" varchar(200) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "status" varchar(30) DEFAULT 'started' NOT NULL,
  "response" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_idempotency" ADD CONSTRAINT "api_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "api_idempotency_user_scope_key_unique" ON "api_idempotency" USING btree ("user_id", "scope", "key");
--> statement-breakpoint
CREATE INDEX "api_idempotency_expires_idx" ON "api_idempotency" USING btree ("expires_at");
