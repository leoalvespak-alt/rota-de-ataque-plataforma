CREATE TABLE IF NOT EXISTS "runtime_rate_limits" (
  "bucket_key" text PRIMARY KEY NOT NULL,
  "window_expires_at" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runtime_rate_limits_expiry_idx" ON "runtime_rate_limits" USING btree ("window_expires_at");
--> statement-breakpoint
ALTER TABLE "generation_jobs" DROP COLUMN IF EXISTS "bullmq_job_id";
