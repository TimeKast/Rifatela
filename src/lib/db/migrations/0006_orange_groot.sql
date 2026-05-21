CREATE TYPE "public"."raffle_status" AS ENUM('draft', 'open', 'drawn');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('available', 'sold');--> statement-breakpoint
CREATE TYPE "public"."admin_action_type" AS ENUM('revert_sale', 'rotate_seller_token', 'archive_raffle', 'archive_seller', 'edit_raffle');--> statement-breakpoint
CREATE TABLE "raffles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"max_tickets" integer NOT NULL,
	"draw_date" timestamp with time zone NOT NULL,
	"status" "raffle_status" DEFAULT 'open' NOT NULL,
	"winner_ticket_id" uuid,
	"rng_seed" text,
	"seed_commit" text NOT NULL,
	"drawn_at" timestamp with time zone,
	"public_slug" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "raffles_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"access_token" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "sellers_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "ticket_status" DEFAULT 'available' NOT NULL,
	"buyer_id" uuid,
	"seller_id" uuid,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" "admin_action_type" NOT NULL,
	"raffle_id" uuid,
	"ticket_id" uuid,
	"seller_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raffles_public_slug_idx" ON "raffles" USING btree ("public_slug");--> statement-breakpoint
CREATE INDEX "raffles_status_deleted_created_idx" ON "raffles" USING btree ("status","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "raffles_draw_date_idx" ON "raffles" USING btree ("draw_date");--> statement-breakpoint
CREATE UNIQUE INDEX "prizes_raffle_position_idx" ON "prizes" USING btree ("raffle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_access_token_idx" ON "sellers" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "sellers_deleted_created_idx" ON "sellers" USING btree ("deleted_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_raffle_number_idx" ON "tickets" USING btree ("raffle_id","number");--> statement-breakpoint
CREATE INDEX "tickets_raffle_status_idx" ON "tickets" USING btree ("raffle_id","status");--> statement-breakpoint
CREATE INDEX "tickets_seller_sold_idx" ON "tickets" USING btree ("seller_id") WHERE "tickets"."status" = 'sold';--> statement-breakpoint
CREATE INDEX "tickets_buyer_idx" ON "tickets" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "admin_actions_created_idx" ON "admin_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_actions_raffle_idx" ON "admin_actions" USING btree ("raffle_id");