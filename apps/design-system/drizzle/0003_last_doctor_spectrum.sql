CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"handle" varchar(100) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"color_background" varchar(9) NOT NULL,
	"color_text" varchar(9) NOT NULL,
	"color_primary" varchar(9) NOT NULL,
	"color_button" varchar(9) NOT NULL,
	"font_heading" varchar(255) DEFAULT 'Rajdhani' NOT NULL,
	"font_body" varchar(255) DEFAULT 'IBM Plex Sans' NOT NULL,
	"avatar_key" varchar(1000),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "creative_projects" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_projects" ADD CONSTRAINT "creative_projects_profile_id_brand_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;