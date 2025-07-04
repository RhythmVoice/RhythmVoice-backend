import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

const emailUsersTable = pgTable("email_users", {
	id: serial().primaryKey(),
	userId: integer('user_id').unique().notNull(),     
	password: varchar({ length: 100 }).notNull(),

	isVerifiedEmail: boolean('is_verified_email').default(false),
	emailVerificationToken: varchar('email_verification_token', { length: 255 }),
	emailVerificationExpires: timestamp('email_verification_expires'),
	lastVerificationEmailSent: timestamp('last_verification_email_sent'),

	createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { emailUsersTable };