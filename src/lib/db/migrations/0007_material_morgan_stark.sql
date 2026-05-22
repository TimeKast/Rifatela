CREATE TABLE "raffle_sellers" (
	"raffle_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "raffle_sellers_raffle_id_seller_id_pk" PRIMARY KEY("raffle_id","seller_id")
);
--> statement-breakpoint
ALTER TABLE "raffle_sellers" ADD CONSTRAINT "raffle_sellers_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_sellers" ADD CONSTRAINT "raffle_sellers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "raffle_sellers_seller_idx" ON "raffle_sellers" USING btree ("seller_id");