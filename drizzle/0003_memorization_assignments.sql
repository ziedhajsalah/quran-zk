CREATE TABLE "memorization_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"surah_number" integer NOT NULL,
	"status" "review_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"assigned_by" text,
	"assigned_at" timestamp with time zone NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"closing_grade" "surah_grade",
	CONSTRAINT "memorization_surah_range" CHECK ("memorization_assignments"."surah_number" between 1 and 114),
	CONSTRAINT "memorization_closure" CHECK ((
      "memorization_assignments"."status" = 'open' and "memorization_assignments"."closed_at" is null and "memorization_assignments"."closing_grade" is null
    ) or (
      "memorization_assignments"."status" = 'closed' and "memorization_assignments"."closed_at" is not null and "memorization_assignments"."closing_grade" is not null
    ) or (
      "memorization_assignments"."status" = 'cancelled' and "memorization_assignments"."closed_at" is not null and "memorization_assignments"."closing_grade" is null
    ))
);
--> statement-breakpoint
ALTER TABLE "memorization_assignments" ADD CONSTRAINT "memorization_assignments_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_assignments" ADD CONSTRAINT "memorization_assignments_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_assignments" ADD CONSTRAINT "memorization_assignments_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memorization_open_unique" ON "memorization_assignments" USING btree ("student_id","surah_number") WHERE "memorization_assignments"."status" = 'open';--> statement-breakpoint
CREATE INDEX "memorization_student_status_due_idx" ON "memorization_assignments" USING btree ("student_id","status","due_at");