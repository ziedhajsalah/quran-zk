CREATE TABLE "student_grade_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"surah_number" integer NOT NULL,
	"previous_grade" "surah_grade",
	"new_grade" "surah_grade",
	"actor_id" text,
	"changed_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "grade_history_surah_range" CHECK ("student_grade_history"."surah_number" between 1 and 114),
	CONSTRAINT "grade_history_transition" CHECK ("student_grade_history"."previous_grade" is distinct from "student_grade_history"."new_grade"),
	CONSTRAINT "grade_history_source" CHECK ("student_grade_history"."source" in ('grade', 'review'))
);
--> statement-breakpoint
ALTER TABLE "student_grade_history" ADD CONSTRAINT "student_grade_history_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_grade_history" ADD CONSTRAINT "student_grade_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grade_history_student_id_idx" ON "student_grade_history" USING btree ("student_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "grade_history_student_surah_id_idx" ON "student_grade_history" USING btree ("student_id","surah_number","id" DESC NULLS LAST);