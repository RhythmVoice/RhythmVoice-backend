CREATE TYPE "public"."provider_type" AS ENUM('email', 'google', 'line');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'user', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'inactive', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "email_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"password" varchar(100) NOT NULL,
	"is_verified_email" boolean DEFAULT false,
	"email_verification_token" varchar(255),
	"email_verification_expires" timestamp,
	"last_verification_email_sent" timestamp,
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_password_reset_sent" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "google_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"google_user_id" varchar(255) NOT NULL,
	"google_display_name" varchar(255) NOT NULL,
	"google_email" varchar(255) NOT NULL,
	"google_picture_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_users_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "google_users_google_user_id_unique" UNIQUE("google_user_id")
);
--> statement-breakpoint
CREATE TABLE "line_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"line_user_id" varchar(255) NOT NULL,
	"line_display_name" varchar(255) NOT NULL,
	"line_picture_url" text,
	"line_status_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "line_users_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "line_users_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nickname" varchar(100),
	"avatar" text,
	"birthday" date,
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"email" varchar(100),
	"role" "role" DEFAULT 'user',
	"provider_type" "provider_type" NOT NULL,
	"status" "status" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_users" ADD CONSTRAINT "email_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_users" ADD CONSTRAINT "google_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_users" ADD CONSTRAINT "line_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;