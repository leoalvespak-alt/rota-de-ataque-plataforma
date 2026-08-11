CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "content_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_item_id" uuid NOT NULL,
	"thesis_id" uuid NOT NULL,
	"format" varchar(20) NOT NULL,
	"intent" varchar(100),
	"angle" varchar(100),
	"audience_stage" varchar(100),
	"hook_strategy" varchar(255),
	"core_argument" text NOT NULL,
	"supporting_points" text[] DEFAULT '{}',
	"evidence_ids" uuid[] DEFAULT '{}',
	"cta" text,
	"visual_direction" text,
	"avoid" text[] DEFAULT '{}',
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"validation_errors" text[],
	"thesis_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_item_id" uuid,
	"brief_id" uuid,
	"thesis_id" uuid NOT NULL,
	"format" varchar(20) NOT NULL,
	"copy_data" jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"template_id" varchar(100),
	"render_id" uuid,
	"quality_score" jsonb,
	"similarity_score" numeric(5, 4),
	"generation_model" varchar(255),
	"generation_cost" numeric(12, 6),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"reviewer" varchar(255) NOT NULL,
	"action" varchar(30) NOT NULL,
	"reason_code" varchar(30),
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_similarity_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"compared_to_id" uuid NOT NULL,
	"semantic_score" numeric(5, 4) NOT NULL,
	"lexical_score" numeric(5, 4),
	"ngram_overlap" numeric(5, 4),
	"layer" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"thesis_id" uuid,
	"argument_id" uuid,
	"objection_id" uuid,
	"example_id" uuid,
	"evidence_id" uuid,
	"angle_id" uuid,
	"hook_id" uuid,
	"intent_id" uuid,
	"template_used" varchar(100),
	"cta_used" text,
	"keywords" text[] DEFAULT '{}',
	"used_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"copy_data" jsonb NOT NULL,
	"template_id" varchar(100),
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_angles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"preset" varchar(100),
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_depth_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"category" varchar(30) NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"scheduled_date" date,
	"format" varchar(20) NOT NULL,
	"thesis_id" uuid NOT NULL,
	"intent_id" uuid,
	"angle_id" uuid,
	"hook_strategy" varchar(255),
	"depth_level" varchar(100),
	"audience_stage" varchar(100),
	"cta" text,
	"visual_direction" text,
	"core_argument_id" uuid,
	"template_suggestion" varchar(100),
	"sequence_position" integer,
	"status" varchar(30) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_theses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"summary" text,
	"core_statement" text NOT NULL,
	"full_text" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"weight" numeric(8, 2) DEFAULT '1' NOT NULL,
	"tone" varchar(100),
	"depth_level" varchar(100),
	"audience_stage" varchar(100),
	"allowed_cta" text[] DEFAULT '{}',
	"recommended_formats" text[] DEFAULT '{}',
	"vocabulary" text[] DEFAULT '{}',
	"forbidden_words" text[] DEFAULT '{}',
	"beliefs_to_reinforce" text[] DEFAULT '{}',
	"beliefs_to_combat" text[] DEFAULT '{}',
	"common_errors" text[] DEFAULT '{}',
	"tags" text[] DEFAULT '{}',
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_arguments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"source_url" text,
	"source_name" varchar(500),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_objections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"objection" text NOT NULL,
	"response" text NOT NULL,
	"frequency" varchar(10) DEFAULT 'medium' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_a_id" uuid NOT NULL,
	"thesis_b_id" uuid NOT NULL,
	"relation_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_thesis_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" varchar(255),
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"campaign_id" uuid,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"input_data" jsonb NOT NULL,
	"output_data" jsonb,
	"parent_job_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"provider" varchar(255),
	"model" varchar(255),
	"input_tokens" integer,
	"output_tokens" integer,
	"cost" numeric(12, 6),
	"duration_ms" integer,
	"bullmq_job_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"normalized_content" text NOT NULL,
	"chunk_type" varchar(20) NOT NULL,
	"section_path" text,
	"page_or_section" varchar(100),
	"tags" text[] DEFAULT '{}',
	"thesis_id" uuid,
	"language" varchar(20) DEFAULT 'pt-BR' NOT NULL,
	"hash" varchar(128) NOT NULL,
	"token_count" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"type" varchar(20) NOT NULL,
	"original_filename" varchar(500),
	"storage_key" varchar(1000),
	"content_text" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"language" varchar(20) DEFAULT 'pt-BR' NOT NULL,
	"thesis_id" uuid,
	"tags" text[] DEFAULT '{}',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hash" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"model_name" varchar(255) NOT NULL,
	"model_version" varchar(255) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"template" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"output_schema" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"template" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"output_schema" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_plan_item_id_editorial_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."editorial_plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_plan_item_id_editorial_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."editorial_plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_brief_id_content_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."content_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_similarity_scores" ADD CONSTRAINT "content_similarity_scores_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_similarity_scores" ADD CONSTRAINT "content_similarity_scores_compared_to_id_content_items_id_fk" FOREIGN KEY ("compared_to_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_argument_id_editorial_thesis_arguments_id_fk" FOREIGN KEY ("argument_id") REFERENCES "public"."editorial_thesis_arguments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_objection_id_editorial_thesis_objections_id_fk" FOREIGN KEY ("objection_id") REFERENCES "public"."editorial_thesis_objections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_example_id_editorial_thesis_examples_id_fk" FOREIGN KEY ("example_id") REFERENCES "public"."editorial_thesis_examples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_evidence_id_editorial_thesis_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."editorial_thesis_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_angle_id_editorial_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."editorial_angles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_hook_id_editorial_hooks_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."editorial_hooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_usage_ledger" ADD CONSTRAINT "content_usage_ledger_intent_id_editorial_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."editorial_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plan_items" ADD CONSTRAINT "editorial_plan_items_plan_id_editorial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."editorial_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plan_items" ADD CONSTRAINT "editorial_plan_items_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plan_items" ADD CONSTRAINT "editorial_plan_items_intent_id_editorial_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."editorial_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plan_items" ADD CONSTRAINT "editorial_plan_items_angle_id_editorial_angles_id_fk" FOREIGN KEY ("angle_id") REFERENCES "public"."editorial_angles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plan_items" ADD CONSTRAINT "editorial_plan_items_core_argument_id_editorial_thesis_arguments_id_fk" FOREIGN KEY ("core_argument_id") REFERENCES "public"."editorial_thesis_arguments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_plans" ADD CONSTRAINT "editorial_plans_campaign_id_editorial_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."editorial_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_arguments" ADD CONSTRAINT "editorial_thesis_arguments_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_evidence" ADD CONSTRAINT "editorial_thesis_evidence_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_examples" ADD CONSTRAINT "editorial_thesis_examples_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_objections" ADD CONSTRAINT "editorial_thesis_objections_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_relations" ADD CONSTRAINT "editorial_thesis_relations_thesis_a_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_a_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_relations" ADD CONSTRAINT "editorial_thesis_relations_thesis_b_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_b_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_thesis_versions" ADD CONSTRAINT "editorial_thesis_versions_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_plan_id_editorial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."editorial_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_campaign_id_editorial_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."editorial_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_thesis_id_editorial_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."editorial_theses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_chunk_id_knowledge_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."knowledge_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_prompt_template_id_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_items_thesis_status_format_idx" ON "content_items" USING btree ("thesis_id","status","format");--> statement-breakpoint
CREATE INDEX "content_usage_ledger_thesis_used_idx" ON "content_usage_ledger" USING btree ("thesis_id","used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_angles_name_idx" ON "editorial_angles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_depth_levels_name_idx" ON "editorial_depth_levels" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_intents_name_idx" ON "editorial_intents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "editorial_plan_items_plan_idx" ON "editorial_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "editorial_plan_items_thesis_idx" ON "editorial_plan_items" USING btree ("thesis_id");--> statement-breakpoint
CREATE INDEX "editorial_plans_campaign_status_idx" ON "editorial_plans" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_theses_slug_idx" ON "editorial_theses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "editorial_theses_status_idx" ON "editorial_theses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "editorial_theses_tags_idx" ON "editorial_theses" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_type_idx" ON "generation_jobs" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_document_position_idx" ON "knowledge_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_documents_hash_idx" ON "knowledge_documents" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_documents_tags_idx" ON "knowledge_documents" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_chunk_idx" ON "knowledge_embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_templates_name_idx" ON "prompt_templates" USING btree ("name");
